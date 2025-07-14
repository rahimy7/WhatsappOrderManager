/**
 * Sistema de autenticación multi-tenant
 * Maneja diferentes niveles de acceso según la arquitectura correcta
 * 
 * 🚨 CORRECCIÓN CRÍTICA: Super admins están en tabla `users`, NO en `system_users`
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
 * 🔥 FUNCIÓN CORREGIDA: Autenticación para usuarios globales (super admin, etc.)
 * AHORA BUSCA EN LA TABLA CORRECTA: schema.users
 */
export async function authenticateGlobalUser(username: string, password: string): Promise<AuthUser | null> {
  try {
    // ✅ CORREGIDO: Buscar super admins en tabla `users` con columnas específicas
    const [user] = await masterDb
      .select({
        id: schema.users.id,
        username: schema.users.username,
        password: schema.users.password,
        name: schema.users.name,
        role: schema.users.role,
        status: schema.users.status,
        isActive: schema.users.isActive
      })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (!user) {
      console.log(`Global user '${username}' not found in users table`);
      return null;
    }

    // Verificar que el usuario tiene rol de super admin
    if (user.role !== 'super_admin' && user.role !== 'system_admin') {
      console.log(`User '${username}' found but role '${user.role}' is not super_admin`);
      return null;
    }

    // Verificar que el usuario está activo
    if (!user.isActive) {
      console.log(`Super admin '${username}' is not active`);
      return null;
    }

    // Verificar contraseña
    const bcrypt = await import('bcrypt');
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log(`Invalid password for super admin '${username}'`);
      return null;
    }

    console.log(`✅ Super admin '${username}' authenticated successfully from users table`);
    
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
 * ESTA FUNCIÓN YA ESTÁ CORRECTA - busca en system_users
 */
export async function authenticateStoreUser(username: string, password: string): Promise<AuthUser | null> {
  try {
    const bcrypt = await import('bcrypt');
    
    const [user] = await masterDb
      .select()
      .from(schema.systemUsers)  // ← CORRECTO para store users
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
      storeId: user.storeId !== null ? user.storeId : undefined,
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
 * 🚀 FUNCIÓN PRINCIPAL: Autenticación universal que intenta todos los niveles
 * La validación de tienda se hace en el endpoint de login
 */
export async function authenticateUser(username: string, password: string, storeId?: number): Promise<AuthUser | null> {
  console.log(`🔍 Attempting authentication for username: ${username}`);
  
  // 1. Intentar autenticación global (super admin puede acceder a cualquier tienda)
  console.log('1️⃣ Trying global authentication (users table)...');
  let user = await authenticateGlobalUser(username, password);
  if (user) {
    console.log('✅ Global authentication successful');
    return user;
  }

  // 2. Intentar autenticación de tienda (system_users table)
  console.log('2️⃣ Trying store authentication (system_users table)...');
  user = await authenticateStoreUser(username, password);
  if (user) {
    console.log('✅ Store authentication successful');
    return user;
  }

  // 3. Si se proporciona storeId, intentar autenticación de tenant
  if (storeId) {
    console.log('3️⃣ Trying tenant authentication (store schemas)...');
    user = await authenticateTenantUser(username, password, storeId);
    if (user) {
      console.log('✅ Tenant authentication successful');
      return user;
    }
  }

  console.log('❌ Authentication failed for all levels');
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