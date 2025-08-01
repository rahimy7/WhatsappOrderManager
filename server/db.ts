// server/db.ts - Configuración corregida para @neondatabase/serverless

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// 🔧 CONFIGURACIÓN CORREGIDA DEL POOL PARA NEON
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  
  // ✅ PROPIEDADES VÁLIDAS para @neondatabase/serverless
  max: parseInt(process.env.DB_POOL_MAX || '20'),           // Conexiones máximas
  min: parseInt(process.env.DB_POOL_MIN || '2'),            // Conexiones mínimas
  maxUses: parseInt(process.env.DB_MAX_USES || '7500'),     // Usos por conexión
  maxLifetimeSeconds: parseInt(process.env.DB_MAX_LIFETIME || '600'), // 10 min
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'), // 30 seg
  allowExitOnIdle: false,
  
  // ❌ REMOVIDAS - No válidas para Neon:
  // acquireTimeoutMillis: NO EXISTE
  // connectionTimeoutMillis: NO EXISTE
  // reconnect: NO EXISTE
  // reconnectTries: NO EXISTE
  
  // ✅ CONFIGURACIÓN DE LOG (opcional)
  log: (message: string) => {
    if (message.includes('error') || message.includes('failed') || message.includes('warn')) {
      console.error('🔴 Neon Pool:', message);
    } else if (process.env.NODE_ENV === 'development') {
      console.log('🔵 Neon Pool:', message);
    }
  }
});

// 🛡️ MANEJO DE EVENTOS DEL POOL
pool.on('error', (err) => {
  console.error('🚨 Neon Database pool error:', {
    message: err.message,
    code: err.code,
    timestamp: new Date().toISOString()
  });
  
  // 📊 Log adicional para debugging
  if (err.code === '57P01') {
    console.error('💀 Admin shutdown detected - investigating connection usage');
  }
});

pool.on('connect', () => {
  console.log('✅ Nueva conexión Neon establecida');
});

// 🔧 CONFIGURACIÓN DEL DRIZZLE
export const db = drizzle({ client: pool, schema });
export const masterDb = db; // Alias para compatibilidad
export { schema };

// 🚀 FUNCIÓN DE HEALTH CHECK ESPECÍFICA PARA NEON
export async function testNeonConnection(): Promise<{
  connected: boolean;
  latency: number;
  error?: string;
  poolInfo?: any;
}> {
  const startTime = Date.now();
  
  try {
    // Test básico de conectividad
    const result = await db.execute('SELECT 1 as test, current_timestamp as now');
    const latency = Date.now() - startTime;
    
    // Información del pool (si está disponible)
    const poolInfo = {
      totalCount: pool.totalCount || 'unknown',
      idleCount: pool.idleCount || 'unknown',
      waitingCount: pool.waitingCount || 'unknown'
    };
    
    console.log('✅ Neon connection test passed:', {
      latency: `${latency}ms`,
      poolInfo
    });
    
    return {
      connected: true,
      latency,
      poolInfo
    };
    
  } catch (error: any) {
    const latency = Date.now() - startTime;
    
    console.error('❌ Neon connection test failed:', {
      error: error.message,
      code: error.code,
      latency: `${latency}ms`
    });
    
    return {
      connected: false,
      latency,
      error: error.message
    };
  }
}

// 🔄 VERSIÓN SIMPLIFICADA DEL RESILIENT DATABASE PARA NEON
export class NeonResilientDatabase {
  private pool: Pool;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Ejecuta operación con retry automático adaptado para Neon
   */
  async executeWithRetry<T>(
    operation: (client: any) => Promise<T>,
    context: string = 'database operation'
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      let client;
      
      try {
        console.log(`🔄 ${context} (intento ${attempt}/${this.maxRetries})`);
        
        // ⏱️ Obtener cliente del pool
        client = await this.pool.connect();
        
        // ⚡ Ejecutar operación con timeout manual
        const result = await this.withTimeout(
          operation(client),
          30000,
          `${context} timeout after 30s`
        );
        
        console.log(`✅ ${context} completado`);
        return result;
        
      } catch (error: any) {
        lastError = error;
        console.error(`❌ Error en ${context} (intento ${attempt}):`, error.message);
        
        // 🔍 Verificar si es error recuperable para Neon
        if (this.isNeonRetryableError(error)) {
          if (attempt < this.maxRetries) {
            console.log(`⏳ Reintentando en ${this.retryDelay}ms...`);
            await this.delay(this.retryDelay);
            this.retryDelay *= 1.5;
            continue;
          }
        } else {
          console.error(`🚫 Error no recuperable: ${error.message}`);
          throw error;
        }
        
      } finally {
        // 🔒 CRÍTICO: Liberar cliente
        if (client) {
          try {
            client.release();
          } catch (releaseError) {
            console.error('⚠️ Error liberando cliente Neon:', releaseError);
          }
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * Determina si un error de Neon es recuperable
   */
  private isNeonRetryableError(error: any): boolean {
    const retryableCodes = [
      '57P01', // admin_shutdown (tu error principal)
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08006', // connection_failure
      '53300', // too_many_connections
      'ECONNRESET',
      'ETIMEDOUT'
    ];

    const errorCode = error.code || error.errno;
    const errorMessage = error.message?.toLowerCase() || '';
    
    return retryableCodes.includes(errorCode) ||
           errorMessage.includes('connection') ||
           errorMessage.includes('timeout') ||
           errorMessage.includes('websocket') ||
           errorMessage.includes('network');
  }

  /**
   * Wrapper de timeout manual
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(message)), ms);
      })
    ]);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check específico para Neon
   */
  async healthCheck(): Promise<{ 
    healthy: boolean; 
    latency: number; 
    activeConnections: number;
    poolStats?: any;
  }> {
    const startTime = Date.now();
    
    try {
      const result = await this.executeWithRetry(async (client) => {
        const [row] = await client.query(`
          SELECT 
            current_database() as database,
            current_user as user,
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
        `);
        return row;
      }, 'health check');
      
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency,
        activeConnections: parseInt(result.active_connections || '0'),
        poolStats: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount
        }
      };
      
    } catch (error) {
      console.error('❌ Neon health check failed:', error);
      return {
        healthy: false,
        latency: Date.now() - startTime,
        activeConnections: -1
      };
    }
  }
}

// 🚀 INSTANCIA GLOBAL DEL RESILIENT DATABASE
export const resilientDb = new NeonResilientDatabase(pool);

// 🧪 FUNCIÓN DE TEST PARA VALIDAR CONFIGURACIÓN
export async function validateNeonSetup(): Promise<boolean> {
  try {
    console.log('🧪 Validando configuración de Neon...');
    
    // Test 1: Conexión básica
    const connectionTest = await testNeonConnection();
    if (!connectionTest.connected) {
      throw new Error(`Connection test failed: ${connectionTest.error}`);
    }
    
    // Test 2: ResilientDatabase
    const health = await resilientDb.healthCheck();
    if (!health.healthy) {
      throw new Error('ResilientDatabase health check failed');
    }
    
    // Test 3: Operación con retry
    await resilientDb.executeWithRetry(async (client) => {
      await client.query('SELECT 1');
    }, 'validation test');
    
    console.log('✅ Configuración de Neon validada exitosamente');
    return true;
    
  } catch (error) {
    console.error('❌ Validación de Neon falló:', error);
    return false;
  }
}

// 🔧 EXPORTACIONES PARA COMPATIBILIDAD
export default db;