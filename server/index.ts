import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { registerRoutes } from "./routes";
import { registerUserManagementRoutes } from "./user-management-routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedAutoResponses } from "./seed-auto-responses";
import { seedAssignmentRules } from "./seed-assignment-rules";
import { getStoreInfo, getTenantDb, masterDb, tenantMiddleware } from "./multi-tenant-db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest, AuthUser } from './auth-types';
import { WebSocketServer } from 'ws';
import { authenticateToken } from './authMiddleware.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

// Get the __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRITICAL: Parse JSON bodies globally BEFORE any routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CRITICAL: Create a high-priority router for API endpoints
const apiRouter = express.Router();

// Health endpoint - MUST be first and simple
apiRouter.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || process.env.RAILWAY_PORT || 5000
  });
});

// Login endpoint
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { authenticateUser } = await import('./multi-tenant-auth.js');
    const { username, password, companyId, storeId } = req.body;
    
    // Convert companyId to storeId for compatibility
    const targetStoreId = storeId || companyId;
    
    const user = await authenticateUser(username, password, targetStoreId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }

    // Validate store access if storeId is provided
    if (targetStoreId && user.level !== 'global') {
      if (!user.storeId || user.storeId !== parseInt(targetStoreId)) {
        return res.status(403).json({
          success: false,
          code: 'STORE_ACCESS_DENIED',
          message: 'No tienes acceso a esta tienda'
        });
      }
    }

    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        storeId: user.storeId,
        level: user.level
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '24h' }
    );

    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        storeId: user.storeId,
        level: user.level
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Auth verification endpoint
apiRouter.get('/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    
    res.setHeader('Content-Type', 'application/json');
    res.json({
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      storeId: decoded.storeId,
      level: decoded.level
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// Auto-responses endpoints
apiRouter.get('/store-responses', async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    // Extract user from token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthUser;
    
    // Get store-specific auto responses
    const responses = await storage.getAllAutoResponses();
    res.setHeader('Content-Type', 'application/json');
    res.json(responses);
  } catch (error) {
    console.error('Error fetching auto-responses:', error);
    res.status(500).json({ error: 'Failed to fetch auto-responses' });
  }
});

apiRouter.post('/store-responses', async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    // Extract user from token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthUser;
    
    const data = {
      ...req.body,
      storeId: payload.storeId
    };
    
    const response = await storage.createAutoResponse(data);
    res.setHeader('Content-Type', 'application/json');
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating auto-response:', error);
    res.status(500).json({ error: 'Failed to create auto-response' });
  }
});

apiRouter.put('/store-responses/:id', async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    // Extract user from token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthUser;
    
    const id = parseInt(req.params.id);
    const response = await storage.updateAutoResponse(id, req.body, payload.storeId);
    
    res.setHeader('Content-Type', 'application/json');
    res.json(response);
  } catch (error) {
    console.error('Error updating auto-response:', error);
    res.status(500).json({ error: 'Failed to update auto-response' });
  }
});

apiRouter.delete('/store-responses/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();

    const user = req.user as AuthUser;

    const id = parseInt(req.params.id);
    await storage.deleteAutoResponse(id, user.storeId);

    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting auto-response:', error);
    res.status(500).json({ error: 'Failed to delete auto-response' });
  }
});

apiRouter.post('/store-responses/reset-defaults', async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    // Extract user from token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(token, process.env.JWT_SECRET || 'dev-secret');
    
    await storage.resetAutoResponsesToDefault(payload.storeId);
    res.setHeader('Content-Type', 'application/json');
    res.json({ success: true, message: 'Auto-responses reset to defaults' });
  } catch (error) {
    console.error('Error resetting auto-responses:', error);
    res.status(500).json({ error: 'Failed to reset auto-responses' });
  }
});

// Super Admin WhatsApp Management endpoints
apiRouter.get('/super-admin/whatsapp-configs', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const configs = await storage.getAllWhatsAppConfigs();
    const stores = await storage.getAllVirtualStores();
    
    // Enrich configs with store names
    const enrichedConfigs = configs.map(config => ({
      ...config,
      storeName: stores.find(store => store.id === config.storeId)?.name || `Tienda ${config.storeId}`
    }));
    
    res.json(enrichedConfigs);
  } catch (error) {
    console.error("Error getting WhatsApp configs:", error);
    res.status(500).json({ error: "Error al obtener configuraciones de WhatsApp" });
  }
});

apiRouter.post('/super-admin/whatsapp-configs', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { z } = await import('zod');
    const configData = z.object({
      storeId: z.number(),
      accessToken: z.string().min(1, "Token de acceso requerido"),
      phoneNumberId: z.string().min(1, "Phone Number ID requerido"),
      webhookVerifyToken: z.string().min(1, "Webhook verify token requerido"),
      businessAccountId: z.string().optional(),
      appId: z.string().optional(),
      isActive: z.boolean().default(true)
    }).parse(req.body);

    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    const config = await storage.updateWhatsAppConfig(configData, configData.storeId);
    res.json({ success: true, config });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Datos de configuración inválidos", details: error.errors });
    }
    console.error("Error creating WhatsApp config:", error);
    res.status(500).json({ error: "Error al crear configuración de WhatsApp" });
  }
});

apiRouter.put('/super-admin/whatsapp-configs/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const id = parseInt(req.params.id);
    const { z } = await import('zod');
    const configData = z.object({
      storeId: z.number(),
      accessToken: z.string().min(1, "Token de acceso requerido"),
      phoneNumberId: z.string().min(1, "Phone Number ID requerido"),
      webhookVerifyToken: z.string().min(1, "Webhook verify token requerido"),
      businessAccountId: z.string().optional(),
      appId: z.string().optional(),
      isActive: z.boolean().default(true)
    }).parse(req.body);

    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    const config = await storage.updateWhatsAppConfigById(id, configData);
    res.json({ success: true, config });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Datos de configuración inválidos", details: error.errors });
    }
    console.error("Error updating WhatsApp config:", error);
    res.status(500).json({ error: "Error al actualizar configuración de WhatsApp" });
  }
});

apiRouter.delete('/super-admin/whatsapp-configs/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const id = parseInt(req.params.id);
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    const success = await storage.deleteWhatsAppConfig(id);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Configuración no encontrada" });
    }
  } catch (error) {
    console.error("Error deleting WhatsApp config:", error);
    res.status(500).json({ error: "Error al eliminar configuración de WhatsApp" });
  }
});

apiRouter.post('/super-admin/whatsapp-test', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { storeId } = req.body;
    
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    const config = await storage.getWhatsAppConfig(storeId);
    
    if (!config) {
      return res.json({
        success: false,
        error: "NO_CONFIG",
        message: "No se encontró configuración de WhatsApp para esta tienda"
      });
    }

    // Validar campos obligatorios
    const missingFields = [];
    if (!config.accessToken) missingFields.push("accessToken");
    if (!config.phoneNumberId) missingFields.push("phoneNumberId");
    
    if (missingFields.length > 0) {
      return res.json({
        success: false,
        error: "MISSING_CREDENTIALS",
        message: "Faltan credenciales obligatorias",
        missingFields
      });
    }

    // Test básico de configuración
    res.json({
      success: true,
      message: "Configuración válida",
      details: {
        storeId,
        phoneNumberId: config.phoneNumberId,
        hasToken: !!config.accessToken,
        hasBusinessAccountId: !!config.businessAccountId,
        isActive: config.isActive
      }
    });
  } catch (error) {
    console.error("Error testing WhatsApp config:", error);
    res.status(500).json({ error: "Error al probar configuración" });
  }
});

apiRouter.get('/super-admin/stores', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    const stores = await storage.getAllVirtualStores();
    
    res.json(stores);
  } catch (error) {
    console.error("Error getting stores:", error);
    res.status(500).json({ error: "Error al obtener tiendas" });
  }
});

// Additional Super Admin WhatsApp endpoints
apiRouter.get('/super-admin/global-whatsapp-settings', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const globalSettings = {
      webhook: {
        url: process.env.RAILWAY_STATIC_URL 
          ? `${process.env.RAILWAY_STATIC_URL}/webhook`
          : 'https://tu-dominio.railway.app/webhook',
        verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'default_verify_token_12345',
        isConfigured: !!process.env.RAILWAY_STATIC_URL
      },
      meta: {
        appId: process.env.META_APP_ID || '',
        appSecret: process.env.META_APP_SECRET || '',
        isConfigured: !!process.env.META_APP_ID && !!process.env.META_APP_SECRET
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        railwayUrl: process.env.RAILWAY_STATIC_URL || 'Not configured',
        isProduction: process.env.NODE_ENV === 'production'
      }
    };

    res.json(globalSettings);
  } catch (error) {
    console.error("Error getting global WhatsApp settings:", error);
    res.status(500).json({ error: "Error al obtener configuración global" });
  }
});

apiRouter.put('/super-admin/global-whatsapp-settings', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { webhook, meta } = req.body;

    // In a real implementation, you would save these settings
    // For now, we'll just validate and return success
    if (webhook?.verifyToken) {
      process.env.WEBHOOK_VERIFY_TOKEN = webhook.verifyToken;
    }
    if (meta?.appId) {
      process.env.META_APP_ID = meta.appId;
    }
    if (meta?.appSecret) {
      process.env.META_APP_SECRET = meta.appSecret;
    }

    res.json({
      success: true,
      message: "Configuración global actualizada",
      settings: {
        webhook: {
          url: webhook?.url || process.env.RAILWAY_STATIC_URL,
          verifyToken: process.env.WEBHOOK_VERIFY_TOKEN,
          isConfigured: true
        },
        meta: {
          appId: process.env.META_APP_ID,
          appSecret: process.env.META_APP_SECRET ? '***' : '',
          isConfigured: !!process.env.META_APP_ID && !!process.env.META_APP_SECRET
        }
      }
    });
  } catch (error) {
    console.error("Error updating global WhatsApp settings:", error);
    res.status(500).json({ error: "Error al actualizar configuración global" });
  }
});

apiRouter.post('/super-admin/test-webhook', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { storeId, phoneNumberId } = req.body;

    // Simulate webhook test
    const testMessage = {
      object: "whatsapp_business_account",
      entry: [{
        id: "TEST_BUSINESS_ACCOUNT_ID",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: phoneNumberId,
              phone_number_id: phoneNumberId
            },
            messages: [{
              from: "521234567890",
              id: `test_${Date.now()}`,
              timestamp: Math.floor(Date.now() / 1000).toString(),
              text: {
                body: "Test message from super admin panel"
              },
              type: "text"
            }]
          },
          field: "messages"
        }]
      }]
    };

    // Process test message
    const { processWhatsAppMessage } = await import('./routes.js');
    await processWhatsAppMessage(testMessage);

    res.json({
      success: true,
      message: "Webhook test ejecutado",
      details: {
        storeId,
        phoneNumberId,
        testMessageId: testMessage.entry[0].changes[0].value.messages[0].id
      }
    });
  } catch (error) {
    console.error("Error testing webhook:", error);
    res.status(500).json({ error: "Error al probar webhook" });
  }
});

apiRouter.get('/super-admin/webhook-info', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const webhookUrl = process.env.RAILWAY_STATIC_URL 
      ? `${process.env.RAILWAY_STATIC_URL}/webhook`
      : 'https://tu-dominio.railway.app/webhook';

    res.json({
      webhook: {
        url: webhookUrl,
        verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'default_verify_token_12345',
        method: 'POST for messages, GET for verification',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'SHA256 signature for validation'
        }
      },
      configuration: {
        step1: "Copy the webhook URL above",
        step2: "Go to Meta for Developers > Your App > WhatsApp > Configuration",
        step3: "Paste the URL in 'Callback URL' field",
        step4: "Enter the verify token",
        step5: "Subscribe to 'messages' webhook field",
        step6: "Save changes"
      }
    });
  } catch (error) {
    console.error("Error getting webhook info:", error);
    res.status(500).json({ error: "Error al obtener información del webhook" });
  }
});

apiRouter.get('/super-admin/validate-all-whatsapp', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const stores = await storage.getAllVirtualStores();
    const configs = await storage.getAllWhatsAppConfigs();
    
    const validationResults = await Promise.all(
      stores.map(async (store) => {
        const config = configs.find(c => c.storeId === store.id);
        
        const result = {
          storeId: store.id,
          storeName: store.name,
          hasConfig: !!config,
          isActive: config?.isActive || false,
          validation: {
            hasToken: !!config?.accessToken,
            hasPhoneNumberId: !!config?.phoneNumberId,
            hasBusinessAccountId: !!config?.businessAccountId,
            isValid: false
          }
        };
        
        result.validation.isValid = result.hasConfig && 
          result.validation.hasToken && 
          result.validation.hasPhoneNumberId;
        
        return result;
      })
    );
    
    const summary = {
      totalStores: stores.length,
      configuredStores: validationResults.filter(r => r.hasConfig).length,
      activeStores: validationResults.filter(r => r.isActive).length,
      validStores: validationResults.filter(r => r.validation.isValid).length
    };
    
    res.json({
      summary,
      stores: validationResults
    });
  } catch (error) {
    console.error("Error validating all WhatsApp configs:", error);
    res.status(500).json({ error: "Error al validar configuraciones" });
  }
});

// Mount API router BEFORE any other middleware
app.use('/api', apiRouter);

// Start the application
(async () => {
  try {
    console.log('Starting application...');

    // Register other routes
    await registerRoutes(app);
    await registerUserManagementRoutes(app);

    // Schema migration endpoints
    app.post('/api/super-admin/stores/:id/migrate-schema', async (req, res) => {
      try {
        const { migrateStoreToSeparateSchema } = await import('./schema-migration');
        const storeId = parseInt(req.params.id);
        const result = await migrateStoreToSeparateSchema(storeId);
        res.json(result);
      } catch (error) {
        console.error('Error during schema migration:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    app.get('/api/super-admin/capacity', async (req, res) => {
      try {
        const { calculateStoreCapacity, validateCapacityForNewStores } = await import('./schema-migration');
        const capacity = calculateStoreCapacity();
        const newStoresParam = req.query.newStores;
        const newStores = newStoresParam ? parseInt(newStoresParam as string) : 0;
        const validation = validateCapacityForNewStores(newStores);
        
        res.json({
          capacity,
          validation: newStores > 0 ? validation : null
        });
      } catch (error) {
        console.error('Error calculating capacity:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    app.post('/api/super-admin/stores', async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: "Authorization header required" });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
        
        if (!decoded || decoded.level !== 'global' || decoded.role !== 'super_admin') {
          return res.status(403).json({ error: "Super admin access required" });
        }

        const { DatabaseStorage } = await import('./storage.js');
        const storage = new DatabaseStorage();
        
        const storeData = {
          name: req.body.name,
          description: req.body.description || "",
          domain: req.body.domain,
          isActive: req.body.isActive ?? true
        };
        
        const result = await storage.createStore(storeData);
        
        console.log('✅ Store created successfully:', result.name);
        res.json(result);
      } catch (error) {
        console.error('Error creating store:', error);
        res.status(500).json({ error: 'Failed to create store' });
      }
    });

    app.get('/api/super-admin/stores/:id/validate', async (req, res) => {
      try {
        console.log('=== VALIDACIÓN COMPLETA DE ECOSISTEMA MULTI-TENANT ===');
        const storeId = parseInt(req.params.id);
        console.log('Store ID:', storeId);
        
        // Obtener información de la tienda desde master DB
        const store = await getStoreInfo(storeId);
        
        if (!store) {
          return res.status(404).json({ 
            valid: false, 
            message: 'Tienda no encontrada en base de datos global' 
          });
        }

        console.log(`Validando tienda: ${store.name}`);

        const validationResults = {
          store: store.name,
          storeId: storeId,
          isActive: store.isActive,
          architecture: 'ANÁLISIS CRÍTICO',
          issues: [] as string[],
          recommendations: [] as string[]
        };

        // Validar arquitectura multi-tenant
        try {
          const tenantDb = await getTenantDb(storeId);
          
          // Verificar existencia de tablas críticas
          const criticalTables = [
            'users', 'customers', 'products', 'orders', 'order_items',
            'conversations', 'messages', 'auto_responses', 'store_settings',
            'whatsapp_settings', 'notifications', 'assignment_rules',
            'customer_history', 'shopping_cart', 'whatsapp_logs'
          ];

          for (const table of criticalTables) {
            try {
              await tenantDb.execute(`SELECT 1 FROM ${table} LIMIT 1`);
              console.log(`✅ Tabla ${table} existe`);
            } catch (error) {
              validationResults.issues.push(`❌ Tabla ${table} no existe`);
            }
          }

          // Verificar usuarios
          const users = await tenantDb.select().from(schema.users).limit(1);
          if (users.length === 0) {
            validationResults.issues.push('⚠️ No hay usuarios creados');
            validationResults.recommendations.push('Crear al menos un usuario administrador');
          }

          // Verificar configuración de WhatsApp
          const whatsappConfig = await tenantDb.select().from(schema.whatsappSettings).limit(1);
          if (whatsappConfig.length === 0) {
            validationResults.issues.push('⚠️ WhatsApp no configurado');
            validationResults.recommendations.push('Configurar credenciales de WhatsApp Business API');
          }

        } catch (error) {
          console.error('Error validando tenant DB:', error);
          validationResults.issues.push('❌ ERROR CRÍTICO: No se puede conectar a la base de datos del tenant');
          validationResults.recommendations.push('Verificar configuración de base de datos y permisos');
        }

        // Determinar estado general
        const valid = validationResults.issues.length === 0;
        const status = valid ? '✅ OPERACIONAL' : '❌ REQUIERE ATENCIÓN';

        res.json({
          valid,
          status,
          message: `${store.name} - ${status}`,
          ...validationResults
        });

      } catch (error) {
        console.error('Error en validación:', error);
        res.status(500).json({ 
          valid: false, 
          message: 'Error durante la validación',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    app.get('/api/super-admin/stores/:id/validate-migration', async (req, res) => {
      try {
        const storeId = parseInt(req.params.id);
        const store = await getStoreInfo(storeId);
        
        if (!store) {
          return res.status(404).json({
            valid: false,
            message: `Tienda con ID ${storeId} no encontrada`
          });
        }

        const schemaMatch = store.databaseUrl?.match(/schema=([^&]+)/);
        if (!schemaMatch) {
          return res.json({
            valid: false,
            migrationStatus: 'not_started',
            message: `${store.name} no tiene schema separado configurado`
          });
        }

        const schemaName = schemaMatch[1];
        const tenantDb = await getTenantDb(storeId);
        const tenantTables = await tenantDb.execute(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = '${schemaName}' 
          ORDER BY table_name
        `);
        
        const tables = tenantTables.rows.map((row: any) => row.table_name as string);
        const CRITICAL_TABLES = [
          'users', 'customers', 'products', 'orders', 'order_items',
          'conversations', 'messages', 'auto_responses', 'store_settings',
          'whatsapp_settings', 'notifications', 'assignment_rules',
          'customer_history', 'shopping_cart', 'whatsapp_logs'
        ];

        const missingTables = CRITICAL_TABLES.filter(table => !tables.includes(table));
        const isComplete = missingTables.length === 0;

        res.json({
          valid: isComplete,
          migrationStatus: isComplete ? 'completed' : 'partial',
          message: isComplete 
            ? `✅ MIGRACIÓN COMPLETA: ${store.name} - ${CRITICAL_TABLES.length} tablas en schema ${schemaName}`
            : `⚠️ MIGRACIÓN PARCIAL: ${store.name} - faltan ${missingTables.length} tablas`,
          details: {
            storeName: store.name,
            schemaName: schemaName,
            tablesCount: tables.length,
            missingTablesCount: missingTables.length,
            recommendations: isComplete ? ["✅ Operacional"] : [`Migrar: ${missingTables.join(', ')}`]
          }
        });

      } catch (error) {
        console.error('Error en validación:', error);
        res.status(500).json({ 
          valid: false, 
          message: 'Error interno',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Seed default data if needed
    try {
      console.log('Starting seed process...');
      // await seedAutoResponses();
      // await seedAssignmentRules();
      console.log('Seed process completed.');
    } catch (error) {
      console.error('Error during seeding:', error);
      // Continue without seeding if there's an error
    }

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      console.error('Express error handler:', err);
    });

    // Setup Vite or serve static files
    if (process.env.NODE_ENV === 'development') {
      await setupVite(app, server);
    } else {
      // In production, serve static files
      const staticPath = path.join(__dirname, 'public');
      app.use(express.static(staticPath));
      
      // Handle client-side routing - MUST be last
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ error: 'API endpoint not found' });
        }
        res.sendFile(path.join(staticPath, 'index.html'));
      });
    }

    // WebSocket Server
    const wss = new WebSocketServer({ server });
    wss.on('connection', (socket, req) => {
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        console.log('🔌 Nueva conexión WebSocket con token:', token);

        // Validate JWT token if needed
        if (token) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
          console.log('✅ Token válido:', decoded);

          // Send welcome message
          socket.send(JSON.stringify({ type: 'connected', message: 'WebSocket conectado exitosamente' }));
        } else {
          console.log('❌ Token no proporcionado');
          socket.close();
        }

        // Handle incoming messages
        socket.on('message', (data) => {
          console.log('📩 Mensaje recibido del cliente:', data.toString());
        });

        // Handle connection close
        socket.on('close', () => {
          console.log('🔌 Conexión WebSocket cerrada');
        });

      } catch (error: any) {
        console.error('❌ Error en conexión WebSocket:', error.message);
        socket.close();
      }
    });

    // IMPORTANT: Use PORT from environment variable for Railway
    const PORT = parseInt(process.env.PORT || process.env.RAILWAY_PORT || '5000', 10);
    const HOST = '0.0.0.0'; // Listen on all interfaces

    server.listen(PORT, HOST, () => {
      log(`🚀 Server running on ${HOST}:${PORT}`);
      log(`📱 Health check available at http://${HOST}:${PORT}/api/health`);
      log(`🔌 WebSocket server ready`);
      log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
})();