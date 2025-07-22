// server/storage/index.ts
// Funciones helper y exports principales - CORRECCIÓN COMPLETA

import { StorageFactory } from './storage-factory';
import { UnifiedStorage } from './unified-storage';
import {
  MasterStorage,
  TenantStorage,
  UnifiedStorageInterface
} from '../interfaces/storage';

// ========================================
// FACTORY INSTANCE
// ========================================

export const storageFactory = StorageFactory.getInstance();

// ========================================
// FUNCIONES DE CONVENIENCIA PARA USO DIRECTO
// ========================================

/**
 * Obtiene Master Storage para operaciones globales
 */
export const getMasterStorage = (): MasterStorage => {
  return storageFactory.getMasterStorage();
};

/**
 * Obtiene Tenant Storage para operaciones específicas de tienda
 */
export const getTenantStorage = (storeId: number): Promise<TenantStorage> => {
  return storageFactory.getTenantStorage(storeId);
};

/**
 * Obtiene storage compatible con funciones legacy del storage original
 */
export const getLegacyStorage = (storeId: number) => {
  return storageFactory.getLegacyCompatibleStorage(storeId);
};

/**
 * ✅ CORRECCIÓN: Obtiene tenant storage para un usuario autenticado
 */
export const getTenantStorageForUser = async (user: { storeId?: number }) => {
  if (!user.storeId) {
    throw new Error('User does not have a valid store ID');
  }
  return await getTenantStorage(user.storeId);
};

/**
 * Valida acceso a una tienda específica
 */
export const validateTenantAccess = async (storeId: number): Promise<boolean> => {
  if (!storeId || storeId <= 0) {
    throw new Error('Invalid store ID');
  }
  
  const masterStorage = getMasterStorage();
  const store = await masterStorage.getVirtualStore(storeId);
  
  if (!store) {
    throw new Error(`Store with ID ${storeId} not found`);
  }
  
  if (!store.isActive) {
    throw new Error(`Store with ID ${storeId} is not active`);
  }
  
  return true;
};

// ========================================
// UNIFIED STORAGE CREATORS
// ========================================

/**
 * Crea una instancia de Unified Storage para una tienda específica
 */
export const createUnifiedStorage = (storeId: number): UnifiedStorageInterface => {
  return new UnifiedStorage(storeId);
};

/**
 * Crea una instancia de Unified Storage solo para operaciones master
 */
export const createMasterOnlyStorage = (): UnifiedStorageInterface => {
  return new UnifiedStorage(); // Sin storeId
};

// ========================================
// FUNCIONES DE GESTIÓN DE CACHE
// ========================================

/**
 * Limpia cache de tenant storages
 */
export const clearTenantCache = (storeId?: number): void => {
  storageFactory.clearTenantCache(storeId);
};

/**
 * Refresca el storage de un tenant específico
 */
export const refreshTenantStorage = async (storeId: number): Promise<TenantStorage> => {
  return await storageFactory.refreshTenantStorage(storeId);
};

// ========================================
// UTILIDADES DE MIGRACIÓN Y VALIDACIÓN
// ========================================

/**
 * Valida que una tienda esté correctamente migrada al nuevo sistema
 */
export const validateStoreMigration = async (storeId: number) => {
  try {
    const masterStorage = getMasterStorage();
    const store = await masterStorage.getVirtualStore(storeId);
    
    if (!store) {
      return {
        valid: false,
        error: 'Store not found in master storage',
        storeId
      };
    }

    if (!store.databaseUrl?.includes('schema=')) {
      return {
        valid: false,
        error: 'Store not configured for tenant storage',
        storeId,
        storeName: store.name,
        needsMigration: true
      };
    }

    // Test tenant storage connection
    const tenantStorage = await getTenantStorage(storeId);
    await tenantStorage.getAllProducts(); // Test query
    
    return {
      valid: true,
      storeId,
      storeName: store.name,
      schemaConfigured: true,
      connectionTested: true
    };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId
    };
  }
};

// ========================================
// HEALTH CHECK Y DEBUGGING
// ========================================

/**
 * Verifica el estado de health del sistema de storage
 */
export const healthCheck = async () => {
  return await storageFactory.healthCheck();
};

/**
 * Información de debug del factory
 */
export const debugStorageFactory = () => {
  return storageFactory.debugStorageFactory();
};

/**
 * ✅ CORRECCIÓN: Función que obtiene storage para usuario (compatible con routes)
 */
export const getStorageForUser = async (user: { storeId?: number }) => {
  if (!user.storeId) {
    throw new Error('User must have a store ID for this operation');
  }
  return await getLegacyStorage(user.storeId);
};

// ========================================
// FUNCIONES DEPRECADAS (PARA COMPATIBILIDAD)
// ========================================

/**
 * @deprecated Use getTenantStorage() instead.
 */
export const getStoreSpecificStorage = async (storeId: number) => {
  console.warn('getStoreSpecificStorage is deprecated. Use getTenantStorage() instead.');
  return await getTenantStorage(storeId);
};

// ========================================
// EXPORTS PRINCIPALES
// ========================================

// Exportar clases principales
export { StorageFactory } from './storage-factory';
export { UnifiedStorage } from './unified-storage';
export { MasterStorageService } from './master-storage';

// Exportar tipos
export type {
  MasterStorage,
  TenantStorage,
  UnifiedStorageInterface
} from '../interfaces/storage';

// ================================
// DEFAULT EXPORT
// ================================

export default {
  // Funciones principales
  getMasterStorage,
  getTenantStorage,
  getTenantStorageForUser,
  validateTenantAccess,
  
  // Unified Storage
  createUnifiedStorage,
  createMasterOnlyStorage,
  
  // Cache management
  clearTenantCache,
  refreshTenantStorage,
  
  // Utilities
  healthCheck,
  debugStorageFactory,
  getStorageForUser,
  validateStoreMigration,
  
  // Factory instance
  storageFactory
};

// ================================
// INICIALIZACIÓN
// ================================

console.log('✅ Multi-tenant storage system initialized');
console.log('📦 Available exports: getMasterStorage, getTenantStorage, getTenantStorageForUser, createUnifiedStorage');
console.log('🏭 Storage Factory ready for multi-tenant operations');