// server/storage/storage-factory.ts
// Factory pattern para gestionar instancias de storage con cache

import { MasterStorageService } from './master-storage';
import { TenantStorageService } from './tenant-storage';
import {
  MasterStorage,
  TenantStorage,
  StorageFactory as IStorageFactory
} from '../interfaces/storage';

export class StorageFactory implements IStorageFactory {
  private static instance: StorageFactory | null = null;
  private static masterStorage: MasterStorageService | null = null;
  private static tenantStorageCache = new Map<number, TenantStorageService>();
  private static connectionCache = new Map<number, any>();

  // Singleton pattern para el factory
  static getInstance(): StorageFactory {
    if (!this.instance) {
      this.instance = new StorageFactory();
    }
    return this.instance;
  }

  /**
   * Obtiene la instancia del Master Storage (singleton)
   * Maneja todas las operaciones del sistema global
   */
  getMasterStorage(): MasterStorage {
    if (!StorageFactory.masterStorage) {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL must be set for master storage');
      }

      StorageFactory.masterStorage = new MasterStorageService(process.env.DATABASE_URL);
      console.log('✅ Master Storage instance created');
    }

    return StorageFactory.masterStorage;
  }

  /**
   * Obtiene la instancia del Tenant Storage para una tienda específica
   * Utiliza cache para reutilizar conexiones
   */
  async getTenantStorage(storeId: number): Promise<TenantStorage> {
    try {
      // Verificar cache
      if (StorageFactory.tenantStorageCache.has(storeId)) {
        const cachedStorage = StorageFactory.tenantStorageCache.get(storeId)!;
        console.log(`🔄 Using cached tenant storage for store ${storeId}`);
        return cachedStorage;
      }

      // Validar que la tienda existe y está activa
      const masterStorage = this.getMasterStorage();
      const store = await masterStorage.getVirtualStore(storeId);
      
      if (!store) {
        throw new Error(`Store with ID ${storeId} not found`);
      }

      if (!store.isActive) {
        throw new Error(`Store with ID ${storeId} is not active`);
      }

      console.log(`🔄 Creating new tenant storage for store ${storeId}: ${store.name}`);

      // Obtener conexión tenant
      const tenantDb = await this.getTenantConnection(storeId, store.databaseUrl);

      // Crear instancia de TenantStorage
      const tenantStorage = new TenantStorageService(tenantDb, storeId);

      // Almacenar en cache
      StorageFactory.tenantStorageCache.set(storeId, tenantStorage);
      
      console.log(`✅ Tenant storage created and cached for store ${storeId}`);
      return tenantStorage;

    } catch (error) {
      console.error(`❌ Error creating tenant storage for store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene o crea la conexión de base de datos para un tenant específico
   */
  private async getTenantConnection(storeId: number, databaseUrl: string): Promise<any> {
    try {
      // Verificar cache de conexiones
      if (StorageFactory.connectionCache.has(storeId)) {
        console.log(`♻️ Reusing cached connection for store ${storeId}`);
        return StorageFactory.connectionCache.get(storeId);
      }

      // Importar dependencias de manera dinámica para evitar circular dependencies
      const { getTenantDb } = await import('../multi-tenant-db');
      const tenantDb = await getTenantDb(storeId);

      // Validar conexión con query simple
      await this.validateTenantConnection(tenantDb, storeId);

      // Almacenar en cache
      StorageFactory.connectionCache.set(storeId, tenantDb);
      
      console.log(`✅ Tenant connection established and cached for store ${storeId}`);
      return tenantDb;

    } catch (error) {
      console.error(`❌ Error establishing tenant connection for store ${storeId}:`, error);
      throw error;
    }
  }

  /**
   * Valida que la conexión tenant funciona correctamente
   */
  private async validateTenantConnection(tenantDb: any, storeId: number): Promise<void> {
    try {
      // Test query simple para verificar la conexión
      await tenantDb.execute('SELECT 1 as test');
      
      // Verificar que al menos existe la tabla products (indicador de schema inicializado)
      const result = await tenantDb.execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'products' 
        LIMIT 1
      `);

      if (!result.rows || result.rows.length === 0) {
        console.warn(`⚠️ Store ${storeId} schema may not be fully initialized (no products table found)`);
      }

      console.log(`✅ Tenant connection validated for store ${storeId}`);
    } catch (error) {
      console.error(`❌ Tenant connection validation failed for store ${storeId}:`, error);
      throw new Error(`Invalid tenant database configuration for store ${storeId}`);
    }
  }

  /**
   * Limpia el cache de tenant storage
   * Útil cuando una tienda se actualiza o se desactiva
   */
  clearTenantCache(storeId?: number): void {
    if (storeId !== undefined) {
      // Limpiar cache específico
      if (StorageFactory.tenantStorageCache.has(storeId)) {
        StorageFactory.tenantStorageCache.delete(storeId);
        console.log(`🧹 Cleared tenant storage cache for store ${storeId}`);
      }

      if (StorageFactory.connectionCache.has(storeId)) {
        // Cerrar conexión antes de eliminar del cache
        this.closeTenantConnection(storeId);
        StorageFactory.connectionCache.delete(storeId);
        console.log(`🧹 Cleared tenant connection cache for store ${storeId}`);
      }
    } else {
      // Limpiar todo el cache
      const storeIds = Array.from(StorageFactory.tenantStorageCache.keys());
      
      storeIds.forEach(id => {
        this.closeTenantConnection(id);
      });

      StorageFactory.tenantStorageCache.clear();
      StorageFactory.connectionCache.clear();
      
      console.log(`🧹 Cleared all tenant storage cache (${storeIds.length} stores)`);
    }
  }

  /**
   * Cierra una conexión tenant específica de manera segura
   */
  private closeTenantConnection(storeId: number): void {
    try {
      const connection = StorageFactory.connectionCache.get(storeId);
      if (connection && typeof connection.end === 'function') {
        connection.end();
      }
    } catch (error) {
      console.warn(`⚠️ Error closing tenant connection for store ${storeId}:`, error);
    }
  }

  /**
   * Invalida y refresca el cache para una tienda específica
   * Útil cuando se actualizan configuraciones
   */
  async refreshTenantStorage(storeId: number): Promise<TenantStorage> {
    console.log(`🔄 Refreshing tenant storage for store ${storeId}`);
    
    // Limpiar cache existente
    this.clearTenantCache(storeId);
    
    // Crear nueva instancia
    return await this.getTenantStorage(storeId);
  }

  /**
   * Verifica el estado de salud de todas las conexiones en cache
   */
  async healthCheck(): Promise<{
    master: { status: 'healthy' | 'error'; error?: string };
    tenants: Array<{ storeId: number; status: 'healthy' | 'error'; error?: string }>;
  }> {
    const result = {
      master: { status: 'healthy' as const },
      tenants: [] as Array<{ storeId: number; status: 'healthy' | 'error'; error?: string }>
    };

    // Check master storage
    try {
      const masterStorage = this.getMasterStorage();
      await masterStorage.getAllVirtualStores(); // Test query
      result.master.status = 'healthy';
    } catch (error) {
      result.master.status = 'error';
      result.master.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check tenant storages
    const cachedStoreIds = Array.from(StorageFactory.tenantStorageCache.keys());
    
    for (const storeId of cachedStoreIds) {
      try {
        const tenantStorage = StorageFactory.tenantStorageCache.get(storeId);
        if (tenantStorage) {
          await tenantStorage.getAllProducts(); // Test query
          result.tenants.push({ storeId, status: 'healthy' });
        }
      } catch (error) {
        result.tenants.push({ 
          storeId, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return result;
  }

  /**
   * Obtiene estadísticas del cache
   */
  getCacheStats(): {
    masterStorage: { created: boolean };
    tenantStorages: { count: number; storeIds: number[] };
    connections: { count: number; storeIds: number[] };
  } {
    return {
      masterStorage: {
        created: StorageFactory.masterStorage !== null
      },
      tenantStorages: {
        count: StorageFactory.tenantStorageCache.size,
        storeIds: Array.from(StorageFactory.tenantStorageCache.keys())
      },
      connections: {
        count: StorageFactory.connectionCache.size,
        storeIds: Array.from(StorageFactory.connectionCache.keys())
      }
    };
  }

  /**
   * Precargar tenant storages para tiendas activas
   * Útil durante el startup de la aplicación
   */
  async preloadActiveTenants(): Promise<void> {
    try {
      console.log('🚀 Preloading active tenant storages...');
      
      const masterStorage = this.getMasterStorage();
      const stores = await masterStorage.getAllVirtualStores();
      const activeStores = stores.filter(store => store.isActive);

      console.log(`Found ${activeStores.length} active stores to preload`);

      const preloadPromises = activeStores.map(async (store) => {
        try {
          await this.getTenantStorage(store.id);
          console.log(`✅ Preloaded tenant storage for ${store.name} (ID: ${store.id})`);
        } catch (error) {
          console.error(`❌ Failed to preload tenant storage for ${store.name} (ID: ${store.id}):`, error);
        }
      });

      await Promise.allSettled(preloadPromises);
      
      const stats = this.getCacheStats();
      console.log(`🎉 Preload completed. ${stats.tenantStorages.count} tenant storages ready.`);

    } catch (error) {
      console.error('❌ Error during tenant preload:', error);
    }
  }

  /**
   * Cierra todas las conexiones de manera limpia
   * Debe llamarse durante el shutdown de la aplicación
   */
  async shutdown(): Promise<void> {
    try {
      console.log('🔄 Shutting down Storage Factory...');

      // Cerrar todas las conexiones tenant
      const storeIds = Array.from(StorageFactory.connectionCache.keys());
      for (const storeId of storeIds) {
        this.closeTenantConnection(storeId);
      }

      // Limpiar caches
      StorageFactory.tenantStorageCache.clear();
      StorageFactory.connectionCache.clear();
      StorageFactory.masterStorage = null;
      StorageFactory.instance = null;

      console.log(`✅ Storage Factory shutdown completed. Closed ${storeIds.length} tenant connections.`);
    } catch (error) {
      console.error('❌ Error during Storage Factory shutdown:', error);
    }
  }
}

// ================================
// EXPORTS Y INSTANCIA SINGLETON
// ================================

// Instancia singleton del factory
export const storageFactory = StorageFactory.getInstance();

// Funciones de conveniencia para uso directo
export const getMasterStorage = () => storageFactory.getMasterStorage();
export const getTenantStorage = (storeId: number) => storageFactory.getTenantStorage(storeId);
export const clearTenantCache = (storeId?: number) => storageFactory.clearTenantCache(storeId);
export const refreshTenantStorage = (storeId: number) => storageFactory.refreshTenantStorage(storeId);

// ================================
// CONFIGURACIÓN GLOBAL DE CIERRE
// ================================

// Manejar cierre limpio de la aplicación
process.on('SIGINT', async () => {
  console.log('📢 Received SIGINT, shutting down Storage Factory...');
  await storageFactory.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('📢 Received SIGTERM, shutting down Storage Factory...');
  await storageFactory.shutdown();
  process.exit(0);
});

// ================================
// UTILITIES PARA DEBUGGING
// ================================

/**
 * Función de debugging para inspeccionar el estado del factory
 */
export function debugStorageFactory(): void {
  const stats = storageFactory.getCacheStats();
  
  console.log('=== STORAGE FACTORY DEBUG INFO ===');
  console.log('Master Storage:', stats.masterStorage.created ? '✅ Created' : '❌ Not created');
  console.log(`Tenant Storages: ${stats.tenantStorages.count} cached`);
  console.log('Cached Store IDs:', stats.tenantStorages.storeIds);
  console.log(`Connections: ${stats.connections.count} active`);
  console.log('================================');
}

/**
 * Función para forzar recarga de todas las configuraciones
 */
export async function reloadAllStorages(): Promise<void> {
  console.log('🔄 Reloading all storage configurations...');
  
  const stats = storageFactory.getCacheStats();
  const storeIds = stats.tenantStorages.storeIds;
  
  // Limpiar todo el cache
  storageFactory.clearTenantCache();
  
  // Recargar storages activos
  for (const storeId of storeIds) {
    try {
      await storageFactory.getTenantStorage(storeId);
      console.log(`✅ Reloaded storage for store ${storeId}`);
    } catch (error) {
      console.error(`❌ Failed to reload storage for store ${storeId}:`, error);
    }
  }
  
  console.log('✅ Storage reload completed');
}