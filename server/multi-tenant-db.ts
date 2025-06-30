import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
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
 * Esto incluye crear el esquema completo y configuraciones predeterminadas
 */
export async function createTenantDatabase(store: VirtualStore): Promise<string> {
  try {
    // Generar URL de base de datos (en producción, esto sería una nueva base de datos)
    const databaseUrl = process.env.DATABASE_URL + `?schema=store_${store.id}`;
    
    // Copiar configuraciones predeterminadas desde la base de datos maestra
    await copyDefaultConfigurationsToTenant(store.id);
    
    console.log(`Database created for store: ${store.name} with default configurations`);
    return databaseUrl;
  } catch (error) {
    console.error(`Failed to create database for store ${store.id}:`, error);
    throw error;
  }
}

/**
 * Copia configuraciones predeterminadas (respuestas automáticas, productos base, etc.)
 * desde la base de datos maestra a una nueva tienda
 */
export async function copyDefaultConfigurationsToTenant(storeId: number): Promise<void> {
  try {
    // Obtener respuestas automáticas predeterminadas de la base de datos maestra
    const defaultAutoResponses = await masterDb.select().from(schema.autoResponses);
    
    // Obtener la conexión de la tienda específica
    const tenantDb = await getTenantDb(storeId);
    
    // Copiar respuestas automáticas a la nueva tienda
    if (defaultAutoResponses.length > 0) {
      const responsesToInsert = defaultAutoResponses.map(response => ({
        name: response.name,
        trigger: response.trigger,
        isActive: response.isActive,
        priority: response.priority,
        messageText: response.messageText.replace(
          /https:\/\/[^\/]*\.replit\.dev/g, 
          `https://${process.env.REPL_SLUG || 'localhost:5000'}.replit.dev`
        ), // Actualizar URLs con el dominio correcto
        requiresRegistration: response.requiresRegistration,
        menuOptions: response.menuOptions,
        nextAction: response.nextAction,
        menuType: response.menuType,
        showBackButton: response.showBackButton,
        allowFreeText: response.allowFreeText,
        responseTimeout: response.responseTimeout,
        maxRetries: response.maxRetries,
        fallbackMessage: response.fallbackMessage,
        conditionalDisplay: response.conditionalDisplay,
      }));
      
      await tenantDb.insert(schema.autoResponses).values(responsesToInsert);
      console.log(`Copied ${responsesToInsert.length} auto responses to store ${storeId}`);
    }
    
    // Copiar productos base/plantilla (opcional)
    const defaultProducts = await masterDb.select().from(schema.products).limit(3); // Solo productos base
    if (defaultProducts.length > 0) {
      const productsToInsert = defaultProducts.map(product => ({
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        type: product.type,
        isActive: product.isActive,
        sku: `${storeId}-${product.sku}`, // Hacer SKU único por tienda
        stock: product.stock,
        imageUrl: product.imageUrl,
        specifications: product.specifications,
        installationCost: product.installationCost,
        warrantyMonths: product.warrantyMonths,
      }));
      
      await tenantDb.insert(schema.products).values(productsToInsert);
      console.log(`Copied ${productsToInsert.length} base products to store ${storeId}`);
    }
    
    // Crear configuración inicial de la tienda
    const defaultSettings = {
      storeWhatsAppNumber: store.whatsappNumber || '+52 55 0000 0000',
      businessHours: '09:00-18:00',
      deliveryRadius: '50', // km
      baseSiteUrl: `https://${process.env.REPL_SLUG || 'localhost:5000'}.replit.dev`,
      enableNotifications: true,
      autoAssignOrders: true,
    };
    
    // Obtener información de la tienda desde la base de datos maestra
    const [storeInfo] = await masterDb
      .select()
      .from(schema.virtualStores)
      .where(eq(schema.virtualStores.id, storeId))
      .limit(1);
    
    if (storeInfo) {
      await tenantDb.insert(schema.storeSettings).values({
        key: 'general_settings',
        value: JSON.stringify(defaultSettings),
      });
      
      console.log(`Created default settings for store ${storeId}`);
    }
    
  } catch (error) {
    console.error(`Failed to copy default configurations to store ${storeId}:`, error);
    throw error;
  }
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