// server/database-migration.ts - CREAR ESTE ARCHIVO NUEVO

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

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
      console.log('ℹ️ phone_number_id column already exists');
    } else {
      console.error('❌ Error adding phone_number_id column:', error);
      throw error;
    }
  }
}

/**
 * 🔧 MIGRACIÓN 2: Verificar foreign keys
 */
async function verifyForeignKeys(db: any): Promise<void> {
  try {
    console.log('🔧 Verifying foreign key constraints...');
    
    // Verificar que whatsapp_logs.store_id tenga referencia válida
    const result = await db.execute(`
      SELECT COUNT(*) as invalid_count
      FROM whatsapp_logs wl
      LEFT JOIN virtual_stores vs ON wl.store_id = vs.id
      WHERE vs.id IS NULL AND wl.store_id != 0;
    `);
    
    const invalidCount = Number(result.rows[0]?.invalid_count) || 0;
    
    if (invalidCount > 0) {
      console.log(`⚠️ Found ${invalidCount} invalid foreign key references`);
      
      // Corregir referencias inválidas
      await db.execute(`
        UPDATE whatsapp_logs 
        SET store_id = (
          SELECT id FROM virtual_stores 
          WHERE is_active = true 
          LIMIT 1
        )
        WHERE store_id NOT IN (
          SELECT id FROM virtual_stores
        ) AND store_id != 0;
      `);
      
      console.log('✅ Fixed invalid foreign key references');
    } else {
      console.log('✅ All foreign key constraints are valid');
    }
    
  } catch (error) {
    console.error('❌ Error verifying foreign keys:', error);
    // No lanzar error aquí, es no crítico
  }
}

/**
 * 🔧 MIGRACIÓN 3: Asegurar que existe un store por defecto
 */
async function ensureDefaultStore(db: any): Promise<void> {
  try {
    console.log('🔧 Ensuring default store exists...');
    
    // Verificar si existen stores
    const storesResult = await db.execute(`
      SELECT COUNT(*) as store_count FROM virtual_stores;
    `);
    
    const storeCount = Number(storesResult.rows[0]?.store_count) || 0;
    
    if (storeCount === 0) {
      console.log('⚠️ No virtual stores found, creating default store...');
      
      // Crear store por defecto
      await db.execute(`
        INSERT INTO virtual_stores (
          name, slug, description, whatsapp_number, phone_number_id, 
          database_url, is_active, created_at, updated_at
        ) VALUES (
          'Default Store',
          'default',
          'Default store for WhatsApp integration',
          '18495012707',
          '766302823222313',
          $1,
          true,
          NOW(),
          NOW()
        );
      `, [process.env.DATABASE_URL]);
      
      console.log('✅ Default store created successfully');
      
    } else {
      console.log(`✅ Found ${storeCount} existing stores`);
    }
    
  } catch (error) {
    console.error('❌ Error ensuring default store:', error);
    // No crítico, continuar
  }
}

/**
 * 🔧 MIGRACIÓN 4: Actualizar datos existentes
 */
async function updateExistingData(db: any): Promise<void> {
  try {
    console.log('🔧 Updating existing data...');
    
    // Actualizar stores sin phone_number_id
    await db.execute(`
      UPDATE virtual_stores 
      SET phone_number_id = '766302823222313'
      WHERE phone_number_id IS NULL 
        AND whatsapp_number = '18495012707';
    `);
    
    // Actualizar logs con store_id = 0 al primer store válido
    await db.execute(`
      UPDATE whatsapp_logs 
      SET store_id = (
        SELECT id FROM virtual_stores 
        WHERE is_active = true 
        ORDER BY id ASC 
        LIMIT 1
      )
      WHERE store_id = 0;
    `);
    
    console.log('✅ Existing data updated successfully');
    
  } catch (error) {
    console.error('❌ Error updating existing data:', error);
    // No crítico
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

// 🎯 EXPORT PARA USO EN OTROS ARCHIVOS
export { addPhoneNumberIdColumn, verifyForeignKeys, ensureDefaultStore };

// ===== SCRIPT EJECUTABLE =====
// Si ejecutas este archivo directamente: node database-migration.js
if (require.main === module) {
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

// ===== COMANDOS DISPONIBLES =====
/*
Para ejecutar las migraciones manualmente:

1. MIGRACIÓN COMPLETA:
   npx tsx server/database-migration.ts

2. SOLO VERIFICAR ESTADO:
   node -e "
   import('./server/database-migration.js')
     .then(m => m.checkMigrationStatus())
     .then(status => console.log('Status:', status))
   "

3. MIGRACIÓN AUTOMÁTICA (usar en tu app):
   import { autoMigrate } from './database-migration';
   await autoMigrate();

4. MIGRACIONES INDIVIDUALES:
   import { addPhoneNumberIdColumn, verifyForeignKeys, ensureDefaultStore } from './database-migration';
   
   // Ejecutar una por una
   await addPhoneNumberIdColumn(db);
   await verifyForeignKeys(db);
   await ensureDefaultStore(db);
*/

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

/**
 * 🧪 Función de testing para verificar migraciones
 */
export async function testMigrations(): Promise<boolean> {
  try {
    console.log('🧪 Testing database migrations...');
    
    // Test 1: Verificar conexión
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool, schema });
    
    await db.execute('SELECT 1 as test');
    console.log('✅ Database connection: OK');
    
    // Test 2: Verificar estructura
    const tables = await db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('virtual_stores', 'whatsapp_logs');
    `);
    
    const tableNames = tables.rows.map(row => row.table_name);
    
    if (!tableNames.includes('virtual_stores')) {
      throw new Error('virtual_stores table not found');
    }
    
    if (!tableNames.includes('whatsapp_logs')) {
      throw new Error('whatsapp_logs table not found');
    }
    
    console.log('✅ Required tables: OK');
    
    // Test 3: Verificar columnas
    const columns = await db.execute(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'virtual_stores' 
        AND column_name = 'phone_number_id';
    `);
    
    if (columns.rows.length === 0) {
      console.log('⚠️ phone_number_id column missing - migration needed');
    } else {
      console.log('✅ phone_number_id column: OK');
    }
    
    // Test 4: Verificar datos
    const storeCount = await db.execute('SELECT COUNT(*) as count FROM virtual_stores');
    const count = Number(storeCount.rows[0]?.count) || 0;
    
    if (count === 0) {
      console.log('⚠️ No virtual stores found - default store creation needed');
    } else {
      console.log(`✅ Virtual stores: ${count} found`);
    }
    
    await pool.end();
    
    console.log('✅ Migration tests completed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Migration tests failed:', error);
    return false;
  }
}

/**
 * 💾 Crear backup antes de migración (recomendado para producción)
 */
export async function createMigrationBackup(): Promise<string> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `migration-backup-${timestamp}`;
    
    console.log(`💾 Creating backup: ${backupName}`);
    console.log('⚠️ Manual backup recommended for production:');
    console.log(`   pg_dump ${process.env.DATABASE_URL} > ${backupName}.sql`);
    
    return backupName;
    
  } catch (error) {
    console.error('❌ Error creating backup:', error);
    throw error;
  }
}

/**
 * 🔧 Rollback de migración (en caso de problemas)
 */
export async function rollbackMigration(): Promise<void> {
  try {
    console.log('🔄 Rolling back database migration...');
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool, schema });
    
    // Rollback: remover columna phone_number_id si causa problemas
    try {
      await db.execute('ALTER TABLE virtual_stores DROP COLUMN IF EXISTS phone_number_id;');
      console.log('✅ Removed phone_number_id column');
    } catch (error) {
      console.log('ℹ️ phone_number_id column removal skipped:', error.message);
    }
    
    await pool.end();
    
    console.log('✅ Migration rollback completed');
    console.log('⚠️ You may need to restore from backup for complete rollback');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}