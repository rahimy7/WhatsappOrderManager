import { ResilientDatabase } from "utils/db-resilient";

// monitoring/db-monitor.ts
export class DatabaseMonitor {
  private healthCheckInterval: NodeJS.Timeout;
  private errorCounts: Map<string, number> = new Map();
  private lastHealthCheck: { healthy: boolean; timestamp: number } = { healthy: true, timestamp: Date.now() };

  constructor(private resilientDb: ResilientDatabase) {
    this.startHealthMonitoring();
  }

  /**
   * Inicia monitoreo continuo de salud de la base de datos
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.resilientDb.healthCheck();
        
        if (!health.healthy && this.lastHealthCheck.healthy) {
          // Base de datos se volvió no saludable
          console.error('🚨 ALERTA: Base de datos no saludable!', health);
          await this.triggerDatabaseAlert('unhealthy', health);
        } else if (health.healthy && !this.lastHealthCheck.healthy) {
          // Base de datos se recuperó
          console.log('✅ Base de datos recuperada', health);
          await this.triggerDatabaseAlert('recovered', health);
        }

        // Alertas por latencia alta
        if (health.latency > 5000) {
          console.warn('⚠️ Latencia alta en base de datos:', health.latency + 'ms');
        }

        // Alertas por muchas conexiones activas
        if (health.activeConnections > 15) {
          console.warn('⚠️ Muchas conexiones activas:', health.activeConnections);
        }

        this.lastHealthCheck = { healthy: health.healthy, timestamp: Date.now() };
        
      } catch (error) {
        console.error('❌ Error en health check:', error);
      }
    }, 30000); // Cada 30 segundos
  }

  /**
   * Registra un error y verifica si necesita alertas
   */
  async logError(error: any, context: string): Promise<void> {
    const errorKey = `${error.code || 'unknown'}_${context}`;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);

    // Alerta si hay muchos errores del mismo tipo
    if (currentCount + 1 >= 5) {
      console.error(`🚨 ALERTA: ${currentCount + 1} errores ${errorKey} en corto tiempo`);
      await this.triggerErrorAlert(errorKey, currentCount + 1, error);
      
      // Reset contador después de alerta
      this.errorCounts.set(errorKey, 0);
    }

    // Log estructurado del error
    console.error(`💥 ERROR ${context}:`, {
      code: error.code,
      message: error.message,
      count: currentCount + 1,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Dispara alerta de base de datos
   */
  private async triggerDatabaseAlert(type: 'unhealthy' | 'recovered', health: any): Promise<void> {
    try {
      // Aquí puedes integrar con servicios como Slack, Discord, email, etc.
      const alertMessage = {
        type: 'database_alert',
        status: type,
        timestamp: new Date().toISOString(),
        data: health,
        message: type === 'unhealthy' 
          ? '🚨 Base de datos no disponible' 
          : '✅ Base de datos recuperada'
      };

      // Ejemplo: Enviar a webhook de alertas
      if (process.env.ALERT_WEBHOOK_URL) {
        await fetch(process.env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertMessage)
        });
      }

      // Log local siempre
      console.log('📢 ALERTA ENVIADA:', alertMessage);

    } catch (error) {
      console.error('❌ Error enviando alerta:', error);
    }
  }

  /**
   * Dispara alerta de errores repetitivos
   */
  private async triggerErrorAlert(errorKey: string, count: number, error: any): Promise<void> {
    const alertMessage = {
      type: 'error_alert',
      errorKey,
      count,
      timestamp: new Date().toISOString(),
      error: {
        code: error.code,
        message: error.message
      },
      message: `🚨 Error repetitivo: ${errorKey} (${count} veces)`
    };

    if (process.env.ALERT_WEBHOOK_URL) {
      try {
        await fetch(process.env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertMessage)
        });
      } catch (alertError) {
        console.error('❌ Error enviando alerta de errores:', alertError);
      }
    }

    console.log('📢 ALERTA DE ERROR ENVIADA:', alertMessage);
  }

  /**
   * Obtiene métricas actuales
   */
  getMetrics(): any {
    return {
      lastHealthCheck: this.lastHealthCheck,
      errorCounts: Object.fromEntries(this.errorCounts),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Para el monitoreo
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

// 📊 Middleware para Express que agrega métricas
export function createMetricsMiddleware(monitor: DatabaseMonitor) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      // Log de requests lentos
      if (duration > 5000) {
        console.warn(`⏰ Request lento: ${req.method} ${req.path} - ${duration}ms`);
      }
      
      // Log de errores HTTP
      if (res.statusCode >= 500) {
        console.error(`🔥 Error HTTP ${res.statusCode}: ${req.method} ${req.path}`);
      }
    });
    
    next();
  };
}

// 🔧 Configuración de uso
export function setupMonitoring(resilientDb: ResilientDatabase, app: any) {
  const monitor = new DatabaseMonitor(resilientDb);
  
  // Middleware de métricas
  app.use(createMetricsMiddleware(monitor));
  
  // Endpoint de métricas
  app.get('/api/metrics', (req: any, res: any) => {
    res.json(monitor.getMetrics());
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('🛑 Parando monitoreo...');
    monitor.stop();
    process.exit(0);
  });
  
  return monitor;
}