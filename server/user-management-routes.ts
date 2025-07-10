/**
 * Rutas específicas para gestión de usuarios multi-tenant
 * Separadas de routes.ts para mejor organización
 */

import { Express, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { eq, and } from 'drizzle-orm';
import { masterDb } from './multi-tenant-db.js';
import * as schema from '../shared/schema.ts';
import { AuthUser } from './auth-types.js';

// Middleware de autenticación simplificado
function authenticateToken(req: Request, res: Response, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Middleware para verificar super admin
function requireSuperAdmin(req: Request, res: Response, next: any) {
  const user = req.user as AuthUser;
  if (!user || user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

export function registerUserManagementRoutes(app: Express) {
  
  // ============= GESTIÓN DE USUARIOS GLOBALES (system_users) =============
  
  // Obtener todos los usuarios de tienda (system_users)
  app.get('/api/super-admin/users', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const users = await masterDb
        .select({
          id: schema.systemUsers.id,
          username: schema.systemUsers.username,
          name: schema.systemUsers.name,
          email: schema.systemUsers.email,
          role: schema.systemUsers.role,
          isActive: schema.systemUsers.isActive,
          storeId: schema.systemUsers.storeId,
          createdAt: schema.systemUsers.createdAt,
          storeName: schema.virtualStores.name
        })
        .from(schema.systemUsers)
        .leftJoin(schema.virtualStores, eq(schema.systemUsers.storeId, schema.virtualStores.id));

      res.json(users);
    } catch (error) {
      console.error('Error fetching system users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Crear nuevo usuario de tienda (system_users)
  app.post('/api/super-admin/users', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { name, email, role, storeId, username, password } = req.body;

      // Validar que la tienda existe
      const [store] = await masterDb
        .select()
        .from(schema.virtualStores)
        .where(eq(schema.virtualStores.id, storeId))
        .limit(1);

      if (!store) {
        return res.status(400).json({ error: 'Store not found' });
      }

      // Verificar si el email ya existe
      const [existingUser] = await masterDb
        .select()
        .from(schema.systemUsers)
        .where(eq(schema.systemUsers.email, email))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear usuario
      const [newUser] = await masterDb
        .insert(schema.systemUsers)
        .values({
          name,
          username,
          email,
          password: hashedPassword,
          role,
          storeId,
          isActive: true
        })
        .returning();

      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        storeId: newUser.storeId,
        isActive: newUser.isActive
      });
    } catch (error) {
      console.error('Error creating system user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // Actualizar usuario de tienda
  app.put('/api/super-admin/users/:id', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { name, email, role, storeId, isActive } = req.body;

      const [updatedUser] = await masterDb
        .update(schema.systemUsers)
        .set({
          name,
          email,
          role,
          storeId,
          isActive,
          updatedAt: new Date()
        })
        .where(eq(schema.systemUsers.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating system user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Eliminar usuario de tienda
  app.delete('/api/super-admin/users/:id', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);

      const [deletedUser] = await masterDb
        .delete(schema.systemUsers)
        .where(eq(schema.systemUsers.id, userId))
        .returning();

      if (!deletedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted successfully', user: deletedUser });
    } catch (error) {
      console.error('Error deleting system user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // Reset password para usuario de tienda
  app.post('/api/super-admin/users/:id/reset-password', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ error: 'New password is required' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const [updatedUser] = await masterDb
        .update(schema.systemUsers)
        .set({
          password: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(schema.systemUsers.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // Métricas de usuarios
  app.get('/api/super-admin/user-metrics', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      // Contar usuarios del sistema
      const totalUsers = await masterDb
        .select({ count: schema.systemUsers.id })
        .from(schema.systemUsers);

      const activeUsers = await masterDb
        .select({ count: schema.systemUsers.id })
        .from(schema.systemUsers)
        .where(eq(schema.systemUsers.isActive, true));

      // Contar por roles
      const roleStats = await masterDb
        .select({
          role: schema.systemUsers.role,
          count: schema.systemUsers.id
        })
        .from(schema.systemUsers)
        .groupBy(schema.systemUsers.role);

      res.json({
        totalUsers: totalUsers.length,
        activeUsers: activeUsers.length,
        inactiveUsers: totalUsers.length - activeUsers.length,
        roleDistribution: roleStats.reduce((acc: any, curr: any) => {
          acc[curr.role] = curr.count;
          return acc;
        }, {})
      });
    } catch (error) {
      console.error('Error fetching user metrics:', error);
      res.status(500).json({ error: 'Failed to fetch user metrics' });
    }
  });

  // ============= GESTIÓN DE USUARIOS OPERACIONALES (schemas de tienda) =============

  // Obtener usuarios operacionales de una tienda específica
  app.get('/api/stores/:storeId/users', authenticateToken, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const user = req.user as AuthUser;

      // Verificar permisos: super admin o usuario de la tienda específica
      if (user.role !== 'super_admin' && user.storeId !== storeId) {
        return res.status(403).json({ error: 'Access denied to this store' });
      }

      // Obtener información de la tienda
      const [store] = await masterDb
        .select()
        .from(schema.virtualStores)
        .where(eq(schema.virtualStores.id, storeId))
        .limit(1);

      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      // Extraer schema de la URL
      const schemaMatch = store.databaseUrl.match(/schema=([^&?]+)/);
      if (!schemaMatch) {
        return res.status(500).json({ error: 'Invalid store configuration' });
      }

      const schemaName = schemaMatch[1];

      // Obtener usuarios del schema específico
      const result = await masterDb.execute(`
        SELECT id, username, name, email, role, status, is_active, department, hire_date, created_at
        FROM ${schemaName}.users 
        ORDER BY created_at DESC
      `);

      res.json(result.rows || []);
    } catch (error) {
      console.error('Error fetching store users:', error);
      res.status(500).json({ error: 'Failed to fetch store users' });
    }
  });

  // Crear usuario operacional en schema de tienda
  app.post('/api/stores/:storeId/users', authenticateToken, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const user = req.user as AuthUser;
      const { username, name, email, role, department, password } = req.body;

      // Verificar permisos
      if (user.role !== 'super_admin' && user.storeId !== storeId) {
        return res.status(403).json({ error: 'Access denied to this store' });
      }

      // Obtener información de la tienda
      const [store] = await masterDb
        .select()
        .from(schema.virtualStores)
        .where(eq(schema.virtualStores.id, storeId))
        .limit(1);

      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      const schemaMatch = store.databaseUrl.match(/schema=([^&?]+)/);
      if (!schemaMatch) {
        return res.status(500).json({ error: 'Invalid store configuration' });
      }

      const schemaName = schemaMatch[1];
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insertar usuario en schema específico
      const result = await masterDb.execute(`
        INSERT INTO ${schemaName}.users (username, name, email, password, role, status, is_active, department)
        VALUES ($1, $2, $3, $4, $5, 'active', true, $6)
        RETURNING id, username, name, email, role, department, is_active
      `, [username, name, email, hashedPassword, role, department]);

      res.status(201).json(result.rows?.[0] || {});
    } catch (error) {
      console.error('Error creating store user:', error);
      res.status(500).json({ error: 'Failed to create store user' });
    }
  });

}