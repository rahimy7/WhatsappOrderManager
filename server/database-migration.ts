// server/database-migration.ts - FIXED VERSION

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current file path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurar WebSocket para Neon
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = ws;
}

/**
 * 🔧 Script principal de migración de base de datos
 */
export async function fixDatabaseSchema(): Promise<void> {
  console.log('🔧 ===== STARTING DATABASE MIGRATION =====');
  
  try {
    // Crear conexión directa a la base de datos
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool, schema });
    
    console.log('✅ Database connection established');
    
    // ✅ MIGRACIÓN 1: Agregar phone_number_id a virtual_stores
    await addPhoneNumberIdColumn(db);
    
    // ✅ MIGRACIÓN 2: Verificar foreign keys
    await verifyForeignKeys(db);
    
    // ✅ MIGRACIÓN 3: Crear store por defecto si no existe
    await ensureDefaultStore(db);
    
    // ✅ MIGRACIÓN 4: Actualizar datos existentes
    await updateExistingData(db);
    
    // Cerrar conexión
    await pool.end();
    
    console.log('✅ ===== DATABASE MIGRATION COMPLETED =====');
    
  } catch (error) {
    console.error('💥 Database migration failed:', error);
    throw error;
  }
}

/**
 * 🔧 MIGRACIÓN 1: Agregar columna phone_number_id
 */
async function addPhoneNumberIdColumn(db: any): Promise<void> {
  try {
    console.log('🔧 Adding phone_number_id column to virtual_stores...');
    
    await db.execute(`
      ALTER TABLE virtual_stores 
      ADD COLUMN IF NOT EXISTS phone_number_id TEXT;
    `);
    
    console.log('✅ phone_number_id column added successfully');
    
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('ℹ️ phone_number_id column already exists, skipping...');
    } else {
      console.error('❌ Error adding phone_number_id column:', error);
      throw error;
    }
  }
}

/**
 * 🔗 MIGRACIÓN 2: Verificar y arreglar foreign keys
 */
async function verifyForeignKeys(db: any): Promise<void> {
  try {
    console.log('🔗 Verifying foreign key constraints...');
    
    // Verificar registros huérfanos en whatsapp_logs
    const orphanedLogs = await db.execute(`
      SELECT COUNT(*) as count 
      FROM whatsapp_logs wl 
      LEFT JOIN virtual_stores vs ON wl.store_id = vs.id 
      WHERE vs.id IS NULL AND wl.store_id != 0;
    `);
    
    const orphanCount = Number(orphanedLogs.rows[0]?.count) || 0;
    
    if (orphanCount > 0) {
      console.log(`🔧 Found ${orphanCount} orphaned records, fixing...`);
      
      // Asignar al store por defecto (ID = 1) o crear uno
      await db.execute(`
        UPDATE whatsapp_logs 
        SET store_id = 1 
        WHERE store_id NOT IN (SELECT id FROM virtual_stores) 
          AND store_id != 0;
      `);
      
      console.log('✅ Fixed orphaned foreign key references');
    } else {
      console.log('✅ No foreign key issues found');
    }
    
  } catch (error) {
    console.error('❌ Error verifying foreign keys:', error);
    throw error;
  }
}

/**
 * 🏪 MIGRACIÓN 3: Asegurar que existe un store por defecto
 */
async function ensureDefaultStore(db: any): Promise<void> {
  try {
    console.log('🏪 Ensuring default store exists...');
    
    const existingStores = await db.execute('SELECT COUNT(*) as count FROM virtual_stores WHERE is_active = true;');
    const activeStoreCount = Number(existingStores.rows[0]?.count) || 0;
    
    if (activeStoreCount === 0) {
      console.log('🔧 Creating default store...');
      
      await db.execute(`
        INSERT INTO virtual_stores (
          name, 
          description, 
          is_active, 
          phone_number_id,
          created_at,
          updated_at
        ) VALUES (
          'Default Store', 
          'Auto-created default store for WhatsApp integration', 
          true,
          '766302823222313',
          NOW(),
          NOW()
        ) ON CONFLICT DO NOTHING;
      `);
      
      console.log('✅ Default store created successfully');
    } else {
      console.log(`✅ Found ${activeStoreCount} active stores`);
    }
    
  } catch (error) {
    console.error('❌ Error ensuring default store:', error);
    throw error;
  }
}

/**
 * 🔄 MIGRACIÓN 4: Actualizar datos existentes
 */
async function updateExistingData(db: any): Promise<void> {
  try {
    console.log('🔄 Updating existing data...');
    
    // Actualizar phone_number_id en stores que no lo tengan
    await db.execute(`
      UPDATE virtual_stores 
      SET phone_number_id = '766302823222313' 
      WHERE phone_number_id IS NULL OR phone_number_id = '';
    `);
    
    console.log('✅ Updated existing data successfully');
    
  } catch (error) {
    console.error('⚠️ Error updating existing data:', error);
    // No crítico
  }
}

/**
 * 🚀 Ejecutar migración automática al iniciar
 */
export async function autoMigrate(): Promise<void> {
  try {
    console.log('🚀 Starting automatic database migration...');
    
    // Verificar estado actual
    const status = await checkMigrationStatus();
    
    if (!status.success) {
      console.log('⚠️ Migration issues found:', status.issues);
      console.log('🔧 Running automatic fixes...');
      
      // Ejecutar migración
      await fixDatabaseSchema();
      
      // Verificar nuevamente
      const newStatus = await checkMigrationStatus();
      if (newStatus.success) {
        console.log('✅ Automatic migration completed successfully');
      } else {
        console.log('⚠️ Some issues remain:', newStatus.issues);
        console.log('📋 Recommendations:', newStatus.recommendations);
      }
    } else {
      console.log('✅ Database schema is up to date');
    }
    
  } catch (error) {
    console.error('❌ Automatic migration failed:', error);
    // No lanzar error para permitir que la app continúe
  }
}

/**
 * 🔍 Verificar el estado de la migración
 */
export async function checkMigrationStatus(): Promise<{
  success: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool, schema });
    
    // Verificar columna phone_number_id
    try {
      await db.execute(`SELECT phone_number_id FROM virtual_stores LIMIT 1;`);
    } catch (error) {
      issues.push('Column phone_number_id missing in virtual_stores');
      recommendations.push('Run: ALTER TABLE virtual_stores ADD COLUMN phone_number_id TEXT;');
    }
    
    // Verificar stores válidos
    const storesResult = await db.execute(`SELECT COUNT(*) as count FROM virtual_stores WHERE is_active = true;`);
    const activeStores = Number(storesResult.rows[0]?.count) || 0;
    
    if (activeStores === 0) {
      issues.push('No active virtual stores found');
      recommendations.push('Create at least one active store');
    }
    
    // Verificar foreign keys
    const invalidFkResult = await db.execute(`
      SELECT COUNT(*) as count 
      FROM whatsapp_logs wl 
      LEFT JOIN virtual_stores vs ON wl.store_id = vs.id 
      WHERE vs.id IS NULL AND wl.store_id != 0;
    `);
    
    const invalidFks = Number(invalidFkResult.rows[0]?.count) || 0;
    if (invalidFks > 0) {
      issues.push(`${invalidFks} invalid foreign key references in whatsapp_logs`);
      recommendations.push('Run database migration to fix foreign keys');
    }
    
    await pool.end();
    
    return {
      success: issues.length === 0,
      issues,
      recommendations
    };
    
  } catch (error) {
    issues.push(`Migration check failed: ${error.message}`);
    return { success: false, issues, recommendations };
  }
}

// 🎯 EXPORT PARA USO EN OTROS ARCHIVOS
export { addPhoneNumberIdColumn, verifyForeignKeys, ensureDefaultStore };

// ===== SCRIPT EJECUTABLE (ES MODULE VERSION) =====
// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🎯 Running database migration script directly...');
  
  fixDatabaseSchema()
    .then(() => {
      console.log('🎉 Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

// ===== CONFIGURACIÓN PARA DIFERENTES ENTORNOS =====
export const migrationConfig = {
  development: {
    autoMigrate: true,
    verbose: true,
    createDefaultData: true
  },
  production: {
    autoMigrate: false, // Ejecutar manualmente en producción
    verbose: false,
    createDefaultData: false
  },
  test: {
    autoMigrate: true,
    verbose: true,
    createDefaultData: true
  }
};

/**
 * 🌍 Obtener configuración según el entorno
 */
export function getMigrationConfig() {
  const env = process.env.NODE_ENV || 'development';
  return migrationConfig[env as keyof typeof migrationConfig] || migrationConfig.development;
}

/**
 * 🔄 Función de migración inteligente que respeta el entorno
 */
export async function smartMigrate(): Promise<void> {
  const config = getMigrationConfig();
  
  if (config.autoMigrate) {
    console.log(`🚀 Auto-migration enabled for ${process.env.NODE_ENV || 'development'} environment`);
    await autoMigrate();
  } else {
    console.log(`ℹ️ Auto-migration disabled for ${process.env.NODE_ENV} environment`);
    
    // Solo verificar estado
    const status = await checkMigrationStatus();
    if (!status.success) {
      console.log('⚠️ Database migration needed:');
      status.issues.forEach(issue => console.log(`  - ${issue}`));
      console.log('📋 Recommendations:');
      status.recommendations.forEach(rec => console.log(`  - ${rec}`));
      console.log('💡 Run migration manually: npx tsx server/database-migration.ts');
    }
  }
}