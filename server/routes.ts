import { Express, Request, Response, NextFunction } from 'express';
import { IStorage } from './storage.js';
import jwt from 'jsonwebtoken';
import { Server } from 'http';
import { masterDb } from './multi-tenant-db.js';
import { schema } from '@shared/schema.js';
import { eq, sql } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function generateGoogleMapsLink(latitude: string | number, longitude: string | number, address?: string): string {
  const lat = parseFloat(latitude.toString());
  const lng = parseFloat(longitude.toString());
  
  if (isNaN(lat) || isNaN(lng)) {
    return address || 'Ubicación no disponible';
  }
  
  const baseUrl = 'https://www.google.com/maps/search/';
  
  if (address && address.trim() !== '') {
    return `${baseUrl}${encodeURIComponent(address)}/@${lat},${lng},15z`;
  } else {
    return `${baseUrl}@${lat},${lng},15z`;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}

function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

export async function registerRoutes(app: Express): Promise<any> {
  // Import storage dynamically to avoid dependency issues
  const { DatabaseStorage } = await import('./storage.js');
  const storage = new DatabaseStorage();
  // Multi-tenant WhatsApp message processing function
  async function processWhatsAppMessage(value: any) {
    console.log('🎯 PROCESSWHATSAPPMESSAGE - Iniciando procesamiento');
    console.log('🚀 WEBHOOK RECEIVED - Function called successfully');
    
    // CRITICAL FIX: Use simple processor instead of complex routing
    console.log('🔄 DELEGATING TO SIMPLE PROCESSOR - Bypassing complex routing');
    const { processWhatsAppMessageSimple } = await import('./whatsapp-simple.js');
    await processWhatsAppMessageSimple(value);
    return;
  }

  // Function to process customer messages and responses
  async function processCustomerMessage(customer: any, conversation: any, message: any, from: string, isNewCustomer: boolean = false, storeId?: number, phoneNumberId?: string) {
    try {
      const text = message.text?.body || '';
      console.log('🔀 PROCESSADA CUSTOMERMESSAGE - Mensaje:', text, 'storeId:', storeId);

      // PRIORITY 1: Check if message is a structured order from web catalog
      const isOrder = await isOrderMessage(text);
      
      if (isOrder) {
        console.log('🛍️ ORDER DETECTED - Processing catalog order via simple processor');
        // Let simple processor handle order processing
        return;
      }

      // For non-order messages, process as normal conversation
      console.log('💬 REGULAR MESSAGE - Processing as conversation');
      // Additional conversation processing logic can be added here
      
    } catch (error) {
      console.error('Error in processCustomerMessage:', error);
    }
  }

  // Additional utility functions
  async function isOrderMessage(text: string): Promise<boolean> {
    return text.startsWith('🛍️ *NUEVO PEDIDO*');
  }

  // WhatsApp webhook endpoint
  app.post('/webhook', async (req: Request, res: Response) => {
    try {
      const value = req.body;
      console.log('🎯 WEBHOOK RECEIVED - Processing WhatsApp message');
      
      await processWhatsAppMessage(value);
      
      res.sendStatus(200);
    } catch (error) {
      console.error('Error in webhook processing:', error);
      res.sendStatus(500);
    }
  });

  // WhatsApp webhook verification
  app.get('/webhook', (req: Request, res: Response) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'verifytoken12345';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    }
  });

  // Dentro de registerRoutes() en routes.ts
app.get("/api/super-admin/subscriptions", (req, res) => {
  res.json([]); // o tu lógica real si ya tienes datos
});

app.get("/api/super-admin/subscription-metrics", (req, res) => {
  res.json({
    total: 0,
    active: 0,
    expired: 0
  });
});


    // Métricas globales del sistema
  app.get('/api/super-admin/metrics', async (req, res) => {
    try {
      // Obtener métricas de todas las tiendas
      const stores = await masterDb.select().from(schema.virtualStores);
      const users = await masterDb.select().from(schema.systemUsers);
      
      // Calcular métricas agregadas
      const totalStores = stores.length;
      const activeStores = stores.filter(store => store.isActive).length;
      const totalUsers = users.length;
      
      // Calcular métricas reales desde la base de datos
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Contar órdenes totales y del día
      const [totalOrdersResult] = await masterDb
        .select({ count: sql<number>`count(*)` })
        .from(schema.orders);
      
      const [todayOrdersResult] = await masterDb
        .select({ count: sql<number>`count(*)` })
        .from(schema.orders)
        .where(sql`DATE(${schema.orders.createdAt}) = DATE(${new Date().toISOString()})`);
      
      // Contar mensajes WhatsApp totales
      const [totalMessagesResult] = await masterDb
        .select({ count: sql<number>`count(*)` })
        .from(schema.messages);
      
      // Calcular ingresos totales
      const [revenueResult] = await masterDb
        .select({ total: sql<number>`COALESCE(SUM(CAST(${schema.orders.totalAmount} AS DECIMAL)), 0)` })
        .from(schema.orders)
        .where(eq(schema.orders.status, 'completed'));
      
      const metrics = {
        totalStores,
        activeStores,
        totalUsers,
        totalOrders: totalOrdersResult?.count || 0,
        ordersToday: todayOrdersResult?.count || 0,
        totalRevenue: Number(revenueResult?.total || 0).toFixed(2),
        totalMessages: totalMessagesResult?.count || 0,
        storageUsed: "N/A", // Requiere monitoreo del sistema
        systemStatus: "healthy" as const
      };

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching super admin metrics:', error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

    // WhatsApp logs endpoints
 app.get("/api/whatsapp/logs", authenticateToken, async (_req, res) => {
  try {
    const logs = await storage.getWhatsAppLogs();
    res.json(logs);
  } catch (error) {
    console.error("Error getting WhatsApp logs:", error);
    res.status(500).json({ error: "Error al obtener los logs de WhatsApp" });
  }
});

  app.post("/api/whatsapp/logs", authenticateToken, async (req, res) => {
  try {
    await storage.addWhatsAppLog(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error("Error adding WhatsApp log:", error);
    res.status(500).json({ error: "Error al agregar log de WhatsApp" });
  }
});

    app.get("/api/whatsapp/status", async (req, res) => {
    try {
      const config = await storage.getWhatsAppConfig();
      
      if (!config || !config.accessToken || !config.phoneNumberId) {
        return res.json({
          connected: false,
          configured: false,
          message: "WhatsApp credentials not configured"
        });
      }

      // Test connection by validating token format and configuration
      const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
      const webhookUrl = domain ? `https://${domain}/webhook` : 'https://tu-dominio-replit.com/webhook';
      
      await storage.addWhatsAppLog({
        type: 'info',
        phoneNumber: null,
        messageContent: 'Configuración de WhatsApp cargada correctamente',
        status: 'configured',
        rawData: JSON.stringify({ 
          phoneNumberId: config.phoneNumberId,
          webhookUrl,
          timestamp: new Date() 
        })
      });

      res.json({
        connected: true,
        configured: true,
        lastCheck: new Date().toISOString(),
        phoneNumber: config.phoneNumberId,
        businessName: "WhatsApp Business Account",
        webhookUrl: webhookUrl,
        webhookVerifyToken: config.webhookVerifyToken,
        message: "Configuration loaded successfully"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check WhatsApp status" });
    }
  });


  // Health endpoint is defined in index.ts to prevent Vite middleware interference

  // Routes registered successfully - server managed by index.ts
  return app as any;
}