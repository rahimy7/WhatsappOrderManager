import { eq } from 'drizzle-orm';
import { masterDb, getTenantDb, createTenantDatabase, copyDefaultConfigurationsToTenant } from './multi-tenant-db';
import * as schema from "@shared/schema";

/**
 * Sistema de reparación automática del ecosistema multi-tenant
 * Detecta y corrige problemas arquitectónicos en las tiendas virtuales
 */

export interface EcosystemValidationResult {
  storeId: number;
  storeName: string;
  isValid: boolean;
  issues: string[];
  recommendations: string[];
  architecture: {
    hasSeparateDatabase: boolean;
    usingGlobalDatabase: boolean;
    databaseUrl: string | null;
  };
  tables: {
    global: string[];
    tenant: string[];
  };
  configurations: {
    autoResponses: number;
    products: number;
    settings: boolean;
  };
}

/**
 * Valida completamente el ecosistema de una tienda
 */
export async function validateStoreEcosystem(storeId: number): Promise<EcosystemValidationResult> {
  console.log(`🔍 Iniciando validación completa del ecosistema para tienda ID: ${storeId}`);
  
  // 1. Obtener información básica de la tienda
  const [store] = await masterDb
    .select()
    .from(schema.virtualStores)
    .where(eq(schema.virtualStores.id, storeId))
    .limit(1);

  if (!store) {
    throw new Error(`Tienda con ID ${storeId} no encontrada`);
  }

  const result: EcosystemValidationResult = {
    storeId,
    storeName: store.name,
    isValid: true,
    issues: [],
    recommendations: [],
    architecture: {
      hasSeparateDatabase: false,
      usingGlobalDatabase: true,
      databaseUrl: store.databaseUrl,
    },
    tables: {
      global: [],
      tenant: [],
    },
    configurations: {
      autoResponses: 0,
      products: 0,
      settings: false,
    },
  };

  try {
    // 2. Verificar arquitectura de base de datos
    console.log(`📊 Analizando arquitectura de BD para ${store.name}`);
    
    if (!store.databaseUrl || store.databaseUrl === process.env.DATABASE_URL) {
      result.architecture.hasSeparateDatabase = false;
      result.architecture.usingGlobalDatabase = true;
      result.issues.push("❌ CRÍTICO: Tienda usa base de datos global en lugar de BD separada");
      result.recommendations.push("Crear base de datos separada para la tienda");
      result.isValid = false;
    } else {
      result.architecture.hasSeparateDatabase = true;
      result.architecture.usingGlobalDatabase = false;
    }

    // 3. Obtener lista de tablas globales
    const globalTables = await masterDb.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    result.tables.global = globalTables.rows.map((row: any) => row.table_name as string);

    // 4. Verificar base de datos de la tienda
    if (result.architecture.hasSeparateDatabase) {
      try {
        const tenantDb = await getTenantDb(storeId);
        
        const tenantTables = await tenantDb.execute(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name
        `);
        result.tables.tenant = tenantTables.rows.map((row: any) => row.table_name as string);

        // Verificar configuraciones en BD de tienda
        const autoResponses = await tenantDb.select().from(schema.autoResponses);
        result.configurations.autoResponses = autoResponses.length;

        const products = await tenantDb.select().from(schema.products);
        result.configurations.products = products.length;

        const settings = await tenantDb.select().from(schema.storeSettings).limit(1);
        result.configurations.settings = settings.length > 0;

        if (result.configurations.autoResponses === 0) {
          result.issues.push("⚠️ No hay respuestas automáticas configuradas");
          result.recommendations.push("Copiar respuestas automáticas predeterminadas");
        }

        if (result.configurations.products === 0) {
          result.issues.push("⚠️ No hay productos en el catálogo");
          result.recommendations.push("Crear productos base para la tienda");
        }

        if (!result.configurations.settings) {
          result.issues.push("⚠️ No hay configuraciones de tienda");
          result.recommendations.push("Crear configuraciones predeterminadas");
        }

      } catch (error) {
        result.issues.push(`❌ Error al acceder a BD de tienda: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.isValid = false;
      }
    }

    // 5. Verificar datos problemáticos en BD global
    if (result.architecture.usingGlobalDatabase) {
      // Buscar productos que deberían estar en BD de tienda
      const globalProducts = await masterDb
        .select()
        .from(schema.products)
        .where(eq(schema.products.storeId, storeId));
      
      if (globalProducts.length > 0) {
        result.issues.push(`❌ Encontrados ${globalProducts.length} productos en BD global que deberían estar en BD de tienda`);
        result.recommendations.push("Migrar productos de BD global a BD de tienda");
      }

      // Buscar conversaciones en BD global
      const globalConversations = await masterDb
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.storeId, storeId));
      
      if (globalConversations.length > 0) {
        result.issues.push(`❌ Encontradas ${globalConversations.length} conversaciones en BD global`);
        result.recommendations.push("Migrar conversaciones a BD de tienda");
      }
    }

    console.log(`✅ Validación completada para ${store.name}. Issues: ${result.issues.length}`);
    return result;

  } catch (error) {
    console.error(`❌ Error durante validación de ${store.name}:`, error);
    result.issues.push(`Error crítico durante validación: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.isValid = false;
    return result;
  }
}

/**
 * Repara automáticamente el ecosistema de una tienda
 */
export async function repairStoreEcosystem(storeId: number): Promise<{
  success: boolean;
  message: string;
  actions: string[];
  errors: string[];
}> {
  console.log(`🔧 Iniciando reparación automática del ecosistema para tienda ID: ${storeId}`);
  
  const actions: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Validar estado actual
    const validation = await validateStoreEcosystem(storeId);
    
    if (validation.isValid) {
      return {
        success: true,
        message: `Ecosistema de ${validation.storeName} ya está correctamente configurado`,
        actions: ["No se requieren acciones - ecosistema saludable"],
        errors: [],
      };
    }

    // 2. Obtener información de la tienda
    const [store] = await masterDb
      .select()
      .from(schema.virtualStores)
      .where(eq(schema.virtualStores.id, storeId))
      .limit(1);

    if (!store) {
      throw new Error(`Tienda con ID ${storeId} no encontrada`);
    }

    // 3. Crear base de datos separada si no existe
    if (!validation.architecture.hasSeparateDatabase) {
      console.log(`📦 Creando base de datos separada para ${store.name}`);
      
      try {
        const newDatabaseUrl = await createTenantDatabase(store);
        actions.push(`✅ Base de datos separada creada: ${newDatabaseUrl.substring(0, 50)}...`);
        
        // Actualizar URL en la tienda
        await masterDb
          .update(schema.virtualStores)
          .set({ databaseUrl: newDatabaseUrl })
          .where(eq(schema.virtualStores.id, storeId));
        
        actions.push(`✅ URL de base de datos actualizada en configuración de tienda`);
      } catch (error) {
        const errorMsg = `Error creando base de datos separada: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // 4. Copiar configuraciones predeterminadas
    if (validation.configurations.autoResponses === 0 || validation.configurations.products === 0) {
      console.log(`⚙️ Copiando configuraciones predeterminadas para ${store.name}`);
      
      try {
        await copyDefaultConfigurationsToTenant(storeId);
        actions.push(`✅ Configuraciones predeterminadas copiadas (respuestas automáticas y productos)`);
      } catch (error) {
        const errorMsg = `Error copiando configuraciones: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // 5. Migrar datos de BD global a BD de tienda (si existen)
    if (validation.architecture.usingGlobalDatabase) {
      console.log(`🚚 Migrando datos de BD global a BD de tienda para ${store.name}`);
      
      try {
        // Migrar productos
        const globalProducts = await masterDb
          .select()
          .from(schema.products)
          .where(eq(schema.products.storeId, storeId));
        
        if (globalProducts.length > 0) {
          const tenantDb = await getTenantDb(storeId);
          
          // Preparar productos para insertar (sin storeId ya que están en BD separada)
          const productsToInsert = globalProducts.map(product => ({
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            type: product.type,
            isActive: product.isActive,
            sku: product.sku,
            stock: product.stock,
            imageUrl: product.imageUrl,
            images: product.images,
            specifications: product.specifications,
            installationCost: product.installationCost,
            warrantyMonths: product.warrantyMonths,
            brand: product.brand,
            model: product.model,
            weight: product.weight,
            dimensions: product.dimensions,
            powerConsumption: product.powerConsumption,
            // Nota: storeId no se incluye porque los productos están en BD separada por tienda
          }));
          
          await tenantDb.insert(schema.products).values(productsToInsert);
          actions.push(`✅ ${globalProducts.length} productos migrados de BD global a BD de tienda`);
          
          // Eliminar productos de BD global después de migrar
          await masterDb
            .delete(schema.products)
            .where(eq(schema.products.storeId, storeId));
          actions.push(`✅ Productos eliminados de BD global (limpieza post-migración)`);
        }
        
      } catch (error) {
        const errorMsg = `Error durante migración de datos: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // 6. Verificar reparación exitosa
    const finalValidation = await validateStoreEcosystem(storeId);
    
    const success = errors.length === 0 && finalValidation.isValid;
    const message = success 
      ? `🎉 Ecosistema de ${store.name} reparado exitosamente`
      : `⚠️ Reparación de ${store.name} completada con algunos errores`;

    console.log(`${success ? '✅' : '⚠️'} Reparación completada para ${store.name}`);
    
    return {
      success,
      message,
      actions,
      errors,
    };

  } catch (error) {
    const errorMsg = `Error crítico durante reparación: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMsg);
    
    return {
      success: false,
      message: `❌ Fallo crítico en reparación del ecosistema`,
      actions,
      errors: [...errors, errorMsg],
    };
  }
}

/**
 * Valida todos los ecosistemas de tiendas activas
 */
export async function validateAllStoreEcosystems(): Promise<EcosystemValidationResult[]> {
  console.log(`🌐 Iniciando validación masiva de todos los ecosistemas de tiendas`);
  
  const activeStores = await masterDb
    .select()
    .from(schema.virtualStores)
    .where(eq(schema.virtualStores.isActive, true));

  const results: EcosystemValidationResult[] = [];
  
  for (const store of activeStores) {
    try {
      const validation = await validateStoreEcosystem(store.id);
      results.push(validation);
    } catch (error) {
      console.error(`Error validando tienda ${store.name}:`, error);
      results.push({
        storeId: store.id,
        storeName: store.name,
        isValid: false,
        issues: [`Error crítico: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: ["Revisar configuración de tienda manualmente"],
        architecture: {
          hasSeparateDatabase: false,
          usingGlobalDatabase: true,
          databaseUrl: store.databaseUrl,
        },
        tables: { global: [], tenant: [] },
        configurations: { autoResponses: 0, products: 0, settings: false },
      });
    }
  }

  console.log(`📊 Validación masiva completada: ${results.length} tiendas analizadas`);
  return results;
}