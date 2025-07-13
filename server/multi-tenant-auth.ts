/**
 * Sistema de autenticación multi-tenant
 * Maneja diferentes niveles de acceso según la arquitectura correcta
 */

import { eq } from 'drizzle-orm';
import { masterDb } from './multi-tenant-db.js';
import * as schema from '../shared/schema.ts';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  storeId?: number;
  level: 'global' | 'store' | 'tenant';
}

/**
 * Determina el nivel de acceso del usuario según su rol y ubicación
 */
export function getUserAccessLevel(user: any): 'global' | 'store' | 'tenant' {
  // Usuarios globales (tabla users) - acceso a todo el sistema
  if (user.role === 'super_admin' || user.role === 'system_admin') {
    return 'global';
  }
  
  // Usuarios de tienda (tabla system_users) - acceso a administración de tienda
  if (user.role === 'store_owner' || user.role === 'store_admin') {
    return 'store';
  }
  
  // Usuarios operacionales (schemas de tienda) - acceso solo a operaciones
  if (user.role === 'technician' || user.role === 'seller' || user.role === 'admin') {
    return 'tenant';
  }
  
  return 'tenant';
}

/**
 * Autenticación para usuarios globales (super admin, etc.)
 */

export async function authenticateGlobalUser(username: string, password: string): Promise<AuthUser | null> {
  try {
    // ✅ CORREGIDO: Usar systemUsers en lugar de users
    const [user] = await masterDb
      .select()
      .from(schema.systemUsers)  // ← CAMBIO AQUÍ
      .where(eq(schema.systemUsers.username, username))  // ← Y AQUÍ
      .limit(1);

    if (!user) return null;

    // ✅ También agregar verificación de contraseña
    const bcrypt = await import('bcrypt');
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      level: 'global'
    };
  } catch (error) {
    console.error('Error authenticating global user:', error);
    return null;
  }
}
/**
 * Autenticación para usuarios de tienda (propietarios, administradores)
 */

export async function authenticateStoreUser(username: string, password: string): Promise<AuthUser | null> {
  try {
    const bcrypt = await import('bcrypt');
    
    const [user] = await masterDb
      .select()
      .from(schema.systemUsers)
      .where(eq(schema.systemUsers.username, username))
      .limit(1);

    if (!user) {
      return null;
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      // 🔧 CORRECCIÓN: Solo asignar storeId si es válido
      storeId: user.storeId && user.storeId !== null ? user.storeId : undefined,
      level: 'store' as 'store'
    };
  } catch (error) {
    console.error('Error authenticating store user:', error);
    return null;
  }
}
/**
 * Autenticación para usuarios operacionales (técnicos, vendedores)
 * Busca en el schema específico de la tienda
 */
export async function authenticateTenantUser(
  username: string, 
  password: string, 
  storeId: number
): Promise<AuthUser | null> {
  // Por ahora, simplemente retornar null para evitar errores
  // La autenticación de tenant se implementará completamente más adelante
  return null;
}

/**
 * Autenticación universal que intenta todos los niveles sin validar tienda
 * La validación de tienda se hace en el endpoint de login
 */
export async function authenticateUser(username: string, password: string, storeId?: number): Promise<AuthUser | null> {
  // 1. Intentar autenticación global (super admin puede acceder a cualquier tienda)
  let user = await authenticateGlobalUser(username, password);
  if (user) return user;

  // 2. Intentar autenticación de tienda
  user = await authenticateStoreUser(username, password);
  if (user) return user;

  // 3. Si se proporciona storeId, intentar autenticación de tenant
  if (storeId) {
    user = await authenticateTenantUser(username, password, storeId);
    if (user) return user;
  }

  return null;
}

/**
 * Middleware para verificar permisos según nivel de acceso
 */
export function requireAccessLevel(requiredLevel: 'global' | 'store' | 'tenant') {
  return (req: any, res: any, next: any) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userLevel = getUserAccessLevel(user);
    
    // Global puede acceder a todo
    if (userLevel === 'global') {
      return next();
    }
    
    // Store puede acceder a store y tenant
    if (userLevel === 'store' && (requiredLevel === 'store' || requiredLevel === 'tenant')) {
      return next();
    }
    
    // Tenant solo puede acceder a tenant
    if (userLevel === 'tenant' && requiredLevel === 'tenant') {
      return next();
    }
    
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

/**
 * Middleware para verificar que el usuario pertenece a la tienda específica
 */
export function requireStoreAccess(storeId: number) {
  return (req: any, res: any, next: any) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Usuarios globales pueden acceder a cualquier tienda
    if (user.level === 'global') {
      return next();
    }
    
    // Usuarios de tienda y tenant deben pertenecer a la tienda específica
    if (user.storeId === storeId) {
      return next();
    }
    
    return res.status(403).json({ error: 'Access to this store denied' });
  };
}