/**
 * Validación específica para tiendas con arquitectura multi-tenant migrada
 * Reconoce cuando las tablas están correctamente separadas en schemas independientes
 */

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
import * as schema from "@shared/schema";
import { masterDb, getTenantDb } from './multi-tenant-db';

export interface MigrationValidationResult {
  storeId: number;
  storeName: string;
  isValidMigration: boolean;
  migrationStatus: 'completed' | 'partial' | 'not_started';
  schemaName: string | null;
  tablesInTenantSchema: string[];
  missingTables: string[];
  summary: string;
  recommendations: string[];
}

const CRITICAL_TENANT_TABLES = [
  'users', 'customers', 'products', 'orders', 'order_items',
  'conversations', 'messages', 'auto_responses', 'store_settings',
  'whatsapp_settings', 'notifications', 'assignment_rules',
  'customer_history', 'shopping_cart', 'whatsapp_logs'
];

/**
 * Valida si una tienda ha sido migrada correctamente a schema separado
 */
export async function validateMigratedStore(storeId: number): Promise<MigrationValidationResult> {
  try {
    // 1. Obtener información de la tienda
    const [store] = await masterDb
      .select()
      .from(schema.virtualStores)
      .where(eq(schema.virtualStores.id, storeId))
      .limit(1);

    if (!store) {
      throw new Error(`Store with ID ${storeId} not found`);
    }

    const result: MigrationValidationResult = {
      storeId,
      storeName: store.name,
      isValidMigration: false,
      migrationStatus: 'not_started',
      schemaName: null,
      tablesInTenantSchema: [],
      missingTables: [],
      summary: '',
      recommendations: []
    };

    // 2. Extraer schema name de la URL de la tienda
    const schemaMatch = store.databaseUrl?.match(/schema=([^&]+)/);
    if (!schemaMatch) {
      result.summary = `${store.name} no tiene schema separado configurado`;
      result.recommendations.push("Configurar database_url con schema separado");
      return result;
    }

    result.schemaName = schemaMatch[1];

    // 3. Verificar tablas en el schema de la tienda
    try {
      const tenantDb = await getTenantDb(storeId);
      
      const tenantTables = await tenantDb.execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = '${result.schemaName}' 
        ORDER BY table_name
      `);
      
      result.tablesInTenantSchema = tenantTables.rows.map((row: any) => row.table_name as string);

      // 4. Verificar qué tablas críticas están presentes
      const tenantTablesSet = new Set(result.tablesInTenantSchema);
      result.missingTables = CRITICAL_TENANT_TABLES.filter(table => !tenantTablesSet.has(table));

      // 5. Determinar estado de migración
      if (result.missingTables.length === 0) {
        result.isValidMigration = true;
        result.migrationStatus = 'completed';
        result.summary = `✅ MIGRACIÓN COMPLETA: ${store.name} tiene todas las ${CRITICAL_TENANT_TABLES.length} tablas en schema separado ${result.schemaName}`;
        result.recommendations.push("✅ Arquitectura multi-tenant operacional");
      } else if (result.tablesInTenantSchema.length > 0) {
        result.migrationStatus = 'partial';
        result.summary = `⚠️ MIGRACIÓN PARCIAL: ${store.name} tiene ${result.tablesInTenantSchema.length} tablas migradas, faltan ${result.missingTables.length}`;
        result.recommendations.push(`Migrar tablas faltantes: ${result.missingTables.join(', ')}`);
      } else {
        result.migrationStatus = 'not_started';
        result.summary = `❌ MIGRACIÓN NO INICIADA: ${store.name} no tiene tablas en schema separado`;
        result.recommendations.push("Ejecutar migración completa de tablas");
      }

      // 6. Verificar datos de ejemplo para confirmar funcionalidad
      if (result.isValidMigration) {
        try {
          const products = await tenantDb.select().from(schema.products).limit(1);
          const customers = await tenantDb.select().from(schema.customers).limit(1);
          
          if (products.length > 0 || customers.length > 0) {
            result.summary += " y con datos operacionales";
          }
        } catch (error) {
          result.recommendations.push("Verificar integridad de datos en schema migrado");
        }
      }

    } catch (error) {
      result.summary = `❌ ERROR: No se puede acceder al schema ${result.schemaName} para ${store.name}`;
      result.recommendations.push(`Verificar connectividad a schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;

  } catch (error) {
    return {
      storeId,
      storeName: 'Unknown',
      isValidMigration: false,
      migrationStatus: 'not_started',
      schemaName: null,
      tablesInTenantSchema: [],
      missingTables: CRITICAL_TENANT_TABLES,
      summary: `❌ ERROR CRÍTICO: ${error instanceof Error ? error.message : 'Unknown error'}`,
      recommendations: ['Verificar configuración de tienda y base de datos']
    };
  }
}

/**
 * Valida todas las tiendas activas
 */
export async function validateAllMigratedStores(): Promise<MigrationValidationResult[]> {
  try {
    const stores = await masterDb
      .select()
      .from(schema.virtualStores)
      .where(eq(schema.virtualStores.isActive, true));

    const results = await Promise.all(
      stores.map(store => validateMigratedStore(store.id))
    );

    return results;
  } catch (error) {
    console.error('Error validating all stores:', error);
    return [];
  }
}