// utils/db-resilient.ts
import { Pool } from '@neondatabase/serverless';

export class ResilientDatabase {
  private pool: Pool;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Ejecuta una operación de base de datos con retry automático
   * y manejo robusto de errores
   */
  async executeWithRetry<T>(
    operation: (client: any) => Promise<T>,
    context: string = 'database operation'
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const client = await this.acquireClient();
      
      try {
        console.log(`🔄 Ejecutando ${context} (intento ${attempt}/${this.maxRetries})`);
        
        // ⏱️ Timeout de 30 segundos por operación
        const result = await Promise.race([
          operation(client),
          this.createTimeout(30000, `${context} timeout`)
        ]);
        
        console.log(`✅ ${context} completado exitosamente`);
        return result;
        
      } catch (error: any) {
        lastError = error;
        console.error(`❌ Error en ${context} (intento ${attempt}):`, error.message);
        
        // 🔍 Analizar tipo de error
        if (this.isRetryableError(error)) {
          if (attempt < this.maxRetries) {
            console.log(`⏳ Reintentando en ${this.retryDelay}ms...`);
            await this.delay(this.retryDelay);
            this.retryDelay *= 1.5; // Backoff exponencial
            continue;
          }
        } else {
          // Error no recuperable, fallar inmediatamente
          console.error(`🚫 Error no recuperable en ${context}:`, error.message);
          throw error;
        }
        
      } finally {
        // 🔒 CRÍTICO: Siempre liberar la conexión
        if (client) {
          try {
            client.release();
            console.log(`📤 Conexión liberada para ${context}`);
          } catch (releaseError) {
            console.error('⚠️ Error liberando conexión:', releaseError);
          }
        }
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    console.error(`💀 Todos los intentos fallaron para ${context}`);
    throw lastError!;
  }

  /**
   * Determina si un error es recuperable con retry
   */
  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      '57P01', // admin_shutdown
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '53300', // too_many_connections
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND'
    ];

    const errorCode = error.code || error.errno;
    const errorMessage = error.message?.toLowerCase() || '';
    
    return retryableCodes.includes(errorCode) ||
           errorMessage.includes('connection') ||
           errorMessage.includes('timeout') ||
           errorMessage.includes('network');
  }

  /**
   * Adquiere una conexión del pool con timeout
   */
  private async acquireClient(): Promise<any> {
    try {
      return await Promise.race([
        this.pool.connect(),
        this.createTimeout(5000, 'Pool connection timeout')
      ]);
    } catch (error) {
      console.error('🔥 Error adquiriendo conexión del pool:', error);
      throw error;
    }
  }

  /**
   * Crea un timeout promise
   */
  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Delay con Promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ejecuta una transacción completa con manejo de errores
   */
  async executeTransaction<T>(
    transactionFn: (client: any) => Promise<T>,
    context: string = 'transaction'
  ): Promise<T> {
    return this.executeWithRetry(async (client) => {
      await client.query('BEGIN');
      
      try {
        const result = await transactionFn(client);
        await client.query('COMMIT');
        console.log(`✅ Transacción ${context} confirmada`);
        return result;
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`🔙 Transacción ${context} revertida:`, error);
        throw error;
      }
    }, `transaction: ${context}`);
  }

  /**
   * Verifica el estado de salud de la base de datos
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number; activeConnections: number }> {
    const startTime = Date.now();
    
    try {
      const result = await this.executeWithRetry(async (client) => {
        const [connectionResult] = await client.query(`
          SELECT 
            current_database() as database,
            current_user as user,
            version() as version,
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
        `);
        
        return connectionResult;
      }, 'health check');
      
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency,
        activeConnections: parseInt(result.active_connections)
      };
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        healthy: false,
        latency: Date.now() - startTime,
        activeConnections: -1
      };
    }
  }
}

// 📊 Ejemplo de uso en tus operaciones
export async function safeWebhookOperation<T>(
  resilientDb: ResilientDatabase,
  operation: (client: any) => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await resilientDb.executeWithRetry(operation, context);
  } catch (error: any) {
    // Log detallado del error
    console.error(`💥 Operación ${context} falló completamente:`, {
      error: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 3)
    });
    
    // Decidir si re-lanzar o manejar graciosamente
    throw error;
  }
}