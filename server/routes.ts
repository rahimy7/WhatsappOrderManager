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

// ==========================================
// 🧪 RUTAS HTTP PARA PRUEBAS AUTO-RESPUESTAS (CORREGIDAS)
// ==========================================

// Verificar estado completo de la tienda
app.get('/api/test/store-status/:storeId', async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    
    console.log(`🧪 TESTING AUTO-RESPONSES - Store ID: ${storeId}`);
    
    // ✅ CORRECCIÓN: Obtener tenantDb primero, luego crear storage
    const { getTenantDb } = await import('./multi-tenant-db.js');
    const { createTenantStorage } = await import('./tenant-storage.js');
    const tenantDb = await getTenantDb(storeId);
    const tenantStorage = createTenantStorage(tenantDb);
    
    // Verificar auto-respuestas en base de datos
    const autoResponses = await tenantStorage.getAllAutoResponses();
    
    console.log(`📋 AUTO-RESPONSES FOUND: ${autoResponses.length}`);
    
    // Verificar configuración de WhatsApp
    const whatsappConfig = await storage.getWhatsAppConfig(storeId);
    
    // Verificar respuesta de bienvenida
    const welcomeResponse = autoResponses.find((resp: any) => 
      resp.isActive && resp.trigger === 'welcome'
    );
    
    res.json({
      success: true,
      storeId,
      autoResponsesCount: autoResponses.length,
      autoResponses: autoResponses.map((r: any) => ({
        id: r.id,
        name: r.name,
        trigger: r.trigger,
        isActive: r.isActive,
        messagePreview: r.messageText.substring(0, 50) + "..."
      })),
      whatsappConfigured: !!whatsappConfig,
      phoneNumberId: whatsappConfig?.phoneNumberId || null,
      hasWelcomeResponse: !!welcomeResponse,
      readyForMessages: !!(whatsappConfig && welcomeResponse)
    });
    
  } catch (error) {
    console.error('❌ ERROR TESTING AUTO-RESPONSES:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Simular webhook de mensaje
app.post('/api/test/simulate-webhook/:storeId', async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    const { phoneNumber = '18494553242', messageText = 'Hola' } = req.body;
    
    console.log(`🎭 SIMULATING MESSAGE WEBHOOK - Store: ${storeId}, Phone: ${phoneNumber}, Message: "${messageText}"`);
    
    // Obtener configuración de WhatsApp
    const whatsappConfig = await storage.getWhatsAppConfig(storeId);
    
    if (!whatsappConfig) {
      return res.json({
        success: false,
        error: "No WhatsApp config found - Cannot simulate webhook"
      });
    }
    
    // Crear webhook simulado
    const simulatedWebhook = {
      object: "whatsapp_business_account",
      entry: [{
        id: "TEST_BUSINESS_ACCOUNT_ID",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: whatsappConfig.phoneNumberId,
              phone_number_id: whatsappConfig.phoneNumberId
            },
            messages: [{
              from: phoneNumber,
              id: `test_${Date.now()}`,
              timestamp: Math.floor(Date.now() / 1000).toString(),
              text: {
                body: messageText
              },
              type: "text"
            }]
          },
          field: "messages"
        }]
      }]
    };
    
    console.log(`📤 PROCESSING SIMULATED WEBHOOK...`);
    
    // Procesar webhook simulado
    const { processWhatsAppMessageSimple } = await import('./whatsapp-simple.js');
    await processWhatsAppMessageSimple(simulatedWebhook);
    
    console.log(`✅ WEBHOOK SIMULATION COMPLETED`);
    
    res.json({
      success: true,
      message: "Webhook simulado exitosamente",
      details: {
        storeId,
        phoneNumber,
        messageText,
        phoneNumberId: whatsappConfig.phoneNumberId
      }
    });
    
  } catch (error) {
    console.error('❌ ERROR SIMULATING WEBHOOK:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Crear respuesta de bienvenida por defecto
app.post('/api/test/create-welcome/:storeId', async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId);
    
    console.log(`🏗️ CREATING DEFAULT WELCOME RESPONSE - Store ID: ${storeId}`);
    
    // ✅ CORRECCIÓN: Obtener tenantDb primero, luego crear storage
    const { getTenantDb } = await import('./multi-tenant-db.js');
    const { createTenantStorage } = await import('./tenant-storage.js');
    const tenantDb = await getTenantDb(storeId);
    const tenantStorage = createTenantStorage(tenantDb);
    
    // Verificar si ya existe
    const autoResponses = await tenantStorage.getAllAutoResponses();
    const welcomeExists = autoResponses.find((resp: any) => resp.trigger === 'welcome');
    
    if (welcomeExists) {
      return res.json({
        success: true,
        message: "Welcome response already exists",
        response: {
          id: welcomeExists.id,
          name: welcomeExists.name,
          trigger: welcomeExists.trigger
        }
      });
    }
    
    // Crear respuesta de bienvenida usando el tenantDb directamente
    const welcomeResponse = {
      name: "Bienvenida",
      trigger: "welcome",
      isActive: true,
      priority: 1,
      messageText: `¡Hola! 👋 Bienvenido a MAS QUE SALUD

¿En qué puedo ayudarte hoy?

💊 Ver productos
📞 Contactar con soporte
📍 Ubicación de tienda
🕒 Horarios de atención

Simplemente escribe lo que necesitas y te ayudaré.`,
      requiresRegistration: false,
      menuOptions: "Ver productos,Contactar soporte,Ubicación,Horarios",
      nextAction: null,
      menuType: "buttons",
      showBackButton: false,
      allowFreeText: true,
      responseTimeout: 300,
      maxRetries: 3,
      fallbackMessage: "Lo siento, no entendí tu mensaje. ¿Podrías repetirlo?",
      conditionalDisplay: null
    };
    
    // Insertar usando tenantDb
    const { schema } = await import('../shared/schema.js');
    const [newResponse] = await tenantDb.insert(schema.autoResponses)
      .values(welcomeResponse)
      .returning();
    
    console.log(`✅ DEFAULT WELCOME RESPONSE CREATED: "${newResponse.name}" (ID: ${newResponse.id})`);
    
    res.json({
      success: true,
      message: "Default welcome response created successfully",
      response: {
        id: newResponse.id,
        name: newResponse.name,
        trigger: newResponse.trigger
      }
    });
    
  } catch (error) {
    console.error('❌ ERROR CREATING WELCOME RESPONSE:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});






  // Health endpoint is defined in index.ts to prevent Vite middleware interference

  // Routes registered successfully - server managed by index.ts
  return app as any;
}

