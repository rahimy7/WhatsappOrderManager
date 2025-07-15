// shared/types/users.ts - Tipos actualizados para sistema multi-nivel

import * as schema from "@shared/schema";

// ========================================
// TIPOS BASE DESDE SCHEMA
// ========================================

// Usuarios globales (super admins, system admins)
export type GlobalUser = typeof schema.users.$inferSelect;
export type InsertGlobalUser = typeof schema.users.$inferInsert;

// Usuarios de tienda (store owners, store admins)
export type StoreUser = typeof schema.systemUsers.$inferSelect;
export type InsertStoreUser = typeof schema.systemUsers.$inferInsert;

// Usuarios operacionales (workers en schema de tienda)
export interface TenantUser {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  isActive: boolean;
  department?: string;
  hireDate?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

export interface InsertTenantUser {
  username: string;
  name: string;
  email: string;
  password: string;
  role: string;
  status?: 'active' | 'inactive' | 'suspended';
  isActive?: boolean;
  department?: string;
  hireDate?: Date;
}

// ========================================
// TIPOS EXTENDIDOS CON RELACIONES
// ========================================

// Usuario de tienda con información de la tienda
export interface StoreUserWithStore extends StoreUser {
  storeName?: string;
  storeSlug?: string;
  storeStatus?: 'active' | 'inactive' | 'trial' | 'suspended';
  subscriptionStatus?: 'active' | 'trial' | 'expired' | 'cancelled';
}

// Usuario operacional con información de contexto
export interface TenantUserWithContext extends TenantUser {
  storeId: number;
  storeName: string;
  schemaName: string;
}

// ========================================
// TIPOS PARA AUTENTICACIÓN
// ========================================

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  level: 'global' | 'store' | 'tenant';
  storeId?: number;
  schemaName?: string;
}

// Resultado de búsqueda universal
export interface UserSearchResult {
  user: GlobalUser | StoreUser | TenantUser | null;
  level: 'global' | 'store' | 'tenant' | null;
  storeId?: number;
  schemaName?: string;
}

// ========================================
// TIPOS PARA FORMULARIOS Y API
// ========================================

// Formulario para crear usuario global
export interface CreateGlobalUserForm {
  name: string;
  username: string;
  email: string;
  password: string;
  role: 'super_admin' | 'system_admin';
  confirmPassword: string;
}

// Formulario para crear usuario de tienda
export interface CreateStoreUserForm {
  name: string;
  email: string;
  phone?: string;
  username?: string;
  password?: string;
  role: 'store_owner' | 'store_admin';
  storeId: number;
  sendInvitation: boolean;
  invitationMessage?: string;
}

// Formulario para crear usuario operacional
export interface CreateTenantUserForm {
  username: string;
  name: string;
  email: string;
  password: string;
  role: 'technician' | 'seller' | 'supervisor' | 'assistant';
  department?: string;
  hireDate?: Date;
}

// ========================================
// TIPOS PARA RESPUESTAS DE API
// ========================================

// Respuesta de creación exitosa con credenciales
export interface UserCreationResponse {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  level: 'global' | 'store' | 'tenant';
  storeId?: number;
  storeName?: string;
  tempPassword?: string;
  invitationSent: boolean;
  message: string;
}

// Métricas de usuarios
export interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  globalUsers: number;
  storeUsers: number;
  tenantUsers: number;
  storeOwners: number;
  superAdmins: number;
  suspendedUsers: number;
  newUsersThisMonth: number;
  usersByRole: Record<string, number>;
  usersByLevel: {
    global: number;
    store: number;
    tenant: number;
  };
}

// ========================================
// TIPOS PARA VALIDACIÓN Y REGLAS
// ========================================

// Niveles de usuario permitidos
export const USER_LEVELS = ['global', 'store', 'tenant'] as const;
export type UserLevel = typeof USER_LEVELS[number];

// Roles por nivel
export const GLOBAL_ROLES = ['super_admin', 'system_admin'] as const;
export const STORE_ROLES = ['store_owner', 'store_admin'] as const;
export const TENANT_ROLES = ['technician', 'seller', 'supervisor', 'assistant'] as const;

export type GlobalRole = typeof GLOBAL_ROLES[number];
export type StoreRole = typeof STORE_ROLES[number];
export type TenantRole = typeof TENANT_ROLES[number];

// Configuración de permisos por rol
export interface RolePermissions {
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canViewAllStores: boolean;
  canManageStore: boolean;
  canAccessTenantData: boolean;
  maxStoresAccess: number | 'unlimited';
}

export const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  super_admin: {
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canViewAllStores: true,
    canManageStore: true,
    canAccessTenantData: true,
    maxStoresAccess: 'unlimited'
  },
  system_admin: {
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: false,
    canViewAllStores: true,
    canManageStore: true,
    canAccessTenantData: true,
    maxStoresAccess: 'unlimited'
  },
  store_owner: {
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canViewAllStores: false,
    canManageStore: true,
    canAccessTenantData: true,
    maxStoresAccess: 1
  },
  store_admin: {
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: false,
    canViewAllStores: false,
    canManageStore: true,
    canAccessTenantData: true,
    maxStoresAccess: 1
  },
  technician: {
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canViewAllStores: false,
    canManageStore: false,
    canAccessTenantData: false,
    maxStoresAccess: 1
  },
  seller: {
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canViewAllStores: false,
    canManageStore: false,
    canAccessTenantData: false,
    maxStoresAccess: 1
  }
};

// ========================================
// TIPOS PARA OPERACIONES DE BASE DE DATOS
// ========================================

// Parámetros para búsquedas y filtros
export interface UserFilterParams {
  level?: UserLevel;
  role?: string;
  storeId?: number;
  status?: 'active' | 'inactive' | 'suspended';
  searchTerm?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'username' | 'email' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// Resultado paginado
export interface PaginatedUsersResult<T> {
  users: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ========================================
// TIPOS LEGACY (Para compatibilidad)
// ========================================

/**
 * @deprecated Usar GlobalUser | StoreUser | TenantUser según el contexto
 */
export type User = GlobalUser;

/**
 * @deprecated Usar InsertGlobalUser | InsertStoreUser | InsertTenantUser según el contexto
 */
export type InsertUser = InsertStoreUser;