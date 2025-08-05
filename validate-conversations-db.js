// validate-conversations-db.js
// Script para validar la estructura de la base de datos de conversaciones

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function validateConversationsDatabase() {
  console.log('🔍 VALIDANDO ESTRUCTURA DE BASE DE DATOS PARA CONVERSACIONES\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 5000
  });
  
  try {
    // 1. Verificar conexión
    console.log('1️⃣ Verificando conexión a la base de datos...');
    await pool.query('SELECT NOW()');
    console.log('   ✅ Conexión exitosa');
    
    // 2. Verificar tablas requeridas
    console.log('\n2️⃣ Verificando tablas requeridas...');
    
    const requiredTables = ['conversations', 'messages', 'customers'];
    const existingTables = [];
    
    for (const table of requiredTables) {
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `, [table]);
        
        const exists = result.rows[0].exists;
        console.log(`   ${exists ? '✅' : '❌'} Tabla ${table}: ${exists ? 'EXISTS' : 'MISSING'}`);
        
        if (exists) {
          existingTables.push(table);
        }
      } catch (error) {
        console.log(`   ❌ Error verificando tabla ${table}:`, error.message);
      }
    }
    
    // 3. Verificar estructura de tablas existentes
    console.log('\n3️⃣ Verificando estructura de tablas...');
    
    for (const table of existingTables) {
      try {
        const result = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table]);
        
        console.log(`\n   📋 Estructura de ${table}:`);
        result.rows.forEach(col => {
          console.log(`      - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });
        
      } catch (error) {
        console.log(`   ❌ Error obteniendo estructura de ${table}:`, error.message);
      }
    }
    
    // 4. Verificar datos de muestra
    console.log('\n4️⃣ Verificando datos de muestra...');
    
    for (const table of existingTables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        console.log(`   📊 ${table}: ${count} registros`);
        
        // Mostrar muestra de datos si hay registros
        if (count > 0) {
          const sampleResult = await pool.query(`SELECT * FROM ${table} LIMIT 3`);
          console.log(`   📋 Muestra de ${table}:`);
          sampleResult.rows.forEach((row, index) => {
            console.log(`      ${index + 1}. ${JSON.stringify(row)}`);
          });
        }
      } catch (error) {
        console.log(`   ❌ Error contando registros en ${table}:`, error.message);
      }
    }
    
    // 5. Verificar índices importantes
    console.log('\n5️⃣ Verificando índices...');
    
    try {
      const indexResult = await pool.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename IN ('conversations', 'messages', 'customers')
        ORDER BY tablename, indexname
      `);
      
      console.log(`   📊 Índices encontrados: ${indexResult.rows.length}`);
      indexResult.rows.forEach(idx => {
        console.log(`   - ${idx.tablename}.${idx.indexname}`);
      });
      
    } catch (error) {
      console.log('   ⚠️ Error verificando índices:', error.message);
    }
    
    // 6. Generar recomendaciones
    console.log('\n6️⃣ Recomendaciones...');
    
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.log('   ⚠️ Tablas faltantes:');
      missingTables.forEach(table => {
        console.log(`      - ${table}`);
      });
      console.log('   📋 Ejecutar migración SQL para crear tablas faltantes');
    }
    
    if (existingTables.length === requiredTables.length) {
      console.log('   ✅ Todas las tablas requeridas están presentes');
    }
    
    console.log('\n🎉 VALIDACIÓN COMPLETADA!');
    
  } catch (error) {
    console.error('❌ Error durante la validación:', error);
  } finally {
    await pool.end();
  }
}

// Función para crear tablas faltantes
async function createMissingTables() {
  console.log('🔧 CREANDO TABLAS FALTANTES...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 5000
  });
  
  try {
    // SQL para crear tablas
    const createTablesSQL = `
      -- Tabla de conversaciones
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        conversation_type TEXT DEFAULT 'initial',
        status TEXT DEFAULT 'active',
        last_message_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Tabla de mensajes
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER,
        sender_type TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        whatsapp_message_id TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      -- Índices para mejorar rendimiento
      CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
      CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);
    `;
    
    await pool.query(createTablesSQL);
    console.log('✅ Tablas creadas exitosamente');
    
  } catch (error) {
    console.error('❌ Error creando tablas:', error);
  } finally {
    await pool.end();
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--create-tables')) {
    await createMissingTables();
  } else {
    await validateConversationsDatabase();
    console.log('\n📋 Para crear tablas faltantes ejecutar:');
    console.log('node validate-conversations-db.js --create-tables');
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  validateConversationsDatabase,
  createMissingTables
};
