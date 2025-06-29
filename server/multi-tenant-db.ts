import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { VirtualStore } from "@shared/schema";

// Configurar WebSocket para Neon
// @ts-ignore
globalThis.WebSocket = ws;

// Cache de conexiones de base de datos por tienda
const dbConnections = new Map<number, any>();

// Pool principal para la base de datos maestra (sistema multi-tenant)
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const masterPool = new Pool({ connectionString: process.env.DATABASE_URL });
export const masterDb = drizzle({ client: masterPool, schema });

/**
 * Obtiene la conexión de base de datos para una tienda específica
 * Si no existe, la crea y la almacena en caché
 */
export async function getTenantDb(storeId: number): Promise<any> {
  // Verificar si ya tenemos la conexión en caché
  if (dbConnections.has(storeId)) {
    return dbConnections.get(storeId);
  }

  // Obtener información de la tienda desde la base de datos maestra
  const [store] = await masterDb
    .select()
    .from(schema.virtualStores)
    .where(schema.virtualStores.id.eq(storeId))
    .limit(1);

  if (!store) {
    throw new Error(`Store with ID ${storeId} not found`);
  }

  if (!store.isActive) {
    throw new Error(`Store with ID ${storeId} is not active`);
  }

  // Crear conexión a la base de datos específica de la tienda
  const tenantPool = new Pool({ connectionString: store.databaseUrl });
  const tenantDb = drizzle({ client: tenantPool, schema });

  // Almacenar en caché
  dbConnections.set(storeId, tenantDb);

  return tenantDb;
}

/**
 * Crea una nueva base de datos para una tienda virtual
 * Esto incluye crear el esquema completo
 */
export async function createTenantDatabase(store: VirtualStore): Promise<string> {
  // En un entorno real, aquí crearías una nueva base de datos
  // Por simplicidad, usaremos la misma base de datos con un prefijo de tabla
  
  // Generar URL de base de datos (en producción, esto sería una nueva base de datos)
  const databaseUrl = process.env.DATABASE_URL + `?schema=store_${store.id}`;
  
  // En un entorno real, ejecutarías las migraciones aquí
  // await runMigrationsForTenant(databaseUrl);
  
  return databaseUrl;
}

/**
 * Cierra todas las conexiones de base de datos
 */
export async function closeAllConnections(): Promise<void> {
  for (const [storeId, db] of dbConnections.entries()) {
    try {
      await db.$client.end();
      dbConnections.delete(storeId);
    } catch (error) {
      console.error(`Error closing connection for store ${storeId}:`, error);
    }
  }
}

/**
 * Invalida la conexión en caché para una tienda específica
 */
export async function invalidateTenantConnection(storeId: number): Promise<void> {
  if (dbConnections.has(storeId)) {
    const db = dbConnections.get(storeId);
    try {
      await db.$client.end();
    } catch (error) {
      console.error(`Error closing connection for store ${storeId}:`, error);
    }
    dbConnections.delete(storeId);
  }
}

/**
 * Middleware para extraer el storeId de la sesión/header y configurar la base de datos
 */
export function tenantMiddleware() {
  return async (req: any, res: any, next: any) => {
    try {
      const storeId = req.headers['x-store-id'] || req.session?.storeId;
      
      if (storeId) {
        req.tenantDb = await getTenantDb(parseInt(storeId));
        req.storeId = parseInt(storeId);
      } else {
        // Usar base de datos maestra si no hay storeId
        req.tenantDb = masterDb;
        req.storeId = null;
      }
      
      next();
    } catch (error) {
      console.error('Tenant middleware error:', error);
      res.status(400).json({ error: 'Invalid store configuration' });
    }
  };
}

/**
 * Obtiene información de la tienda desde la base de datos maestra
 */
export async function getStoreInfo(storeId: number): Promise<VirtualStore | null> {
  const [store] = await masterDb
    .select()
    .from(schema.virtualStores)
    .where(schema.virtualStores.id.eq(storeId))
    .limit(1);
    
  return store || null;
}

/**
 * Verifica si una tienda está activa y configurada correctamente
 */
export async function validateStore(storeId: number): Promise<boolean> {
  const store = await getStoreInfo(storeId);
  return store !== null && store.isActive && !!store.databaseUrl;
}