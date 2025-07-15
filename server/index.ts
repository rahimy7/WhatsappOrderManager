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
import type { AuthenticatedRequest, AuthUser } from '@shared/auth.js' ;
import { WebSocketServer } from 'ws';
import { authenticateToken } from './authMiddleware.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import setupCorsForRailway from './cors-config-railway.js';
import { storage } from './storage.js';


const app = express();
const server = createServer(app);
// setupCorsForRailway(app);

// Get the __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || req.get('host') || 'localhost:5000';
  
  // Lista de origins permitidos
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5173',
    'https://whatsappordermanager-production.up.railway.app',
    process.env.RAILWAY_STATIC_URL
  ].filter(Boolean);

  // Permitir TODOS los origins en desarrollo, solo los específicos en producción
  const isAllowed = process.env.NODE_ENV === 'development' || 
                   !req.headers.origin || 
                   allowedOrigins.includes(req.headers.origin);

  if (isAllowed) {
    // Configurar headers CORS
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas
    
    // Log mejorado
    console.log(`✅ CORS: ${req.method} ${req.path} from ${req.headers.origin || 'no-origin'}`);
  } else {
    console.log(`❌ CORS BLOCKED: ${req.method} ${req.path} from ${req.headers.origin}`);
  }

  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});



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


app.get('/api/debug/env', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV,
    jwtSecret: process.env.JWT_SECRET ? 'CONFIGURED' : 'NOT_SET',
    databaseUrl: process.env.DATABASE_URL ? 'CONFIGURED' : 'NOT_SET',
    metaAppId: process.env.META_APP_ID ? 'CONFIGURED' : 'NOT_SET',
    port: process.env.PORT || '5000',
    railwayUrl: process.env.RAILWAY_STATIC_URL
  });
});

// Agregar este endpoint adicional para verificar secrets
apiRouter.get('/auth/debug-secrets', (req, res) => {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  res.json({
    hasJwtSecret: !!process.env.JWT_SECRET,
    secretLength: secret.length,
    secretPreview: secret.substring(0, 5) + '...',
    environment: process.env.NODE_ENV
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
    
    // 🔧 CORRECCIÓN: Crear payload condicional para el token
    const tokenPayload: any = {
      id: user.id,
      username: user.username,
      role: user.role,
      level: user.level
    };
    
    // Solo incluir storeId si es válido
    if (user.storeId && user.storeId !== null && user.storeId !== undefined) {
      tokenPayload.storeId = user.storeId;
    }
    
    const token = jwt.default.sign(
      tokenPayload,
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

// Agregar al apiRouter en server/index.ts
apiRouter.get('/auth/debug-token', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('=== DEBUGGING TOKEN ===');
    console.log('AuthHeader:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({
        error: 'No token provided',
        authHeader: authHeader
      });
    }

    const token = authHeader.substring(7);
    console.log('Token extracted:', token.substring(0, 20) + '...');
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    console.log('Token decoded:', decoded);
    
    // Verificar validación del middleware
    const hasStoreId = 'storeId' in decoded;
    const isObject = typeof decoded === 'object' && decoded !== null;
    
    res.json({
      success: true,
      decoded: {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
        storeId: decoded.storeId,
        
      },
      validation: {
        isObject,
        hasStoreId,
        storeIdValue: decoded.storeId,
        middlewareWouldPass: isObject && hasStoreId
      }
    });
    
  } catch (error) {
    res.json({
      error: error.message,
      step: 'JWT verification failed'
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
      
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// Auto-responses endpoints
apiRouter.get(
  '/store-responses',
  authenticateToken,
  async (req, res) => {
    try {
      const { DatabaseStorage } = await import('./storage.js');
      const storage = new DatabaseStorage();

      // 1) Recover el usuario ya validado
      const user = (req as any).user as { storeId: number };

      // 2) Pasa user.storeId al método
      const responses = await storage.getAllAutoResponses(user.storeId);

      res.setHeader('Content-Type', 'application/json');
      res.json(responses);
    } catch (error) {
      console.error('Error fetching auto-responses:', error);
      res.status(500).json({ error: 'Failed to fetch auto-responses' });
    }
  }
);


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

apiRouter.post(
  '/store-responses/reset-defaults',
  async (req, res) => {
    // 1) Volver a sacar la cabecera:
    const authHeader = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json({ success: false, message: 'No token provided' });
    }

    // 2) Ahora sí puedes llamar a substring sobre authHeader
    const token = authHeader.substring(7);

    // 3) Verificas y casteas al tipo donde sí existe storeId
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret'
    ) as AuthUser;

    // 4) Ya TS sabe que payload.storeId existe
    await storage.resetAutoResponsesToDefault(payload.storeId!);
    res.json({ success: true, message: 'Auto-responses reset to defaults' });
  }
);

// Super Admin WhatsApp Management endpoints
apiRouter.get('/super-admin/whatsapp-configs', async (req, res) => {
  try {
    const user = (req as any).user;
  /*   if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    } */

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
   /*  if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    } */

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
   /*  if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    } */

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
   /*  if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    } */

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
 /*    if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    } */

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
 /*     if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }  */

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
   /*  if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    } */

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
    /* if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    } */

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
   /*  if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    } */

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
   // index.ts (test-webhook)
const { processWhatsAppMessageSimple } = await import('./whatsapp-simple.js');
await processWhatsAppMessageSimple(testMessage);


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
   /*  if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    } */

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
   /*  if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    } */

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

apiRouter.get('/debug/token-info', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('=== DEBUG TOKEN INFO ===');
    console.log('AuthHeader:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({
        error: 'No token provided',
        authHeader: authHeader
      });
    }

    const token = authHeader.substring(7);
    console.log('Token:', token);
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    console.log('Decoded token:', decoded);
    
    // Verificar exactamente qué propiedades tiene
    const user = decoded;
    console.log('User object:', user);
    console.log('user.id:', user.id);
    console.log('user.role:', user.role);
    console.log('user.level:', user.level);
    console.log('user.username:', user.username);
    
    // Probar las condiciones del middleware problemático
    const condition1 = !user;
    const condition2 = user.level !== 'global';
    const condition3 = user.role !== 'super_admin';
    const overallCondition = condition1 || condition2 || condition3;
    
    console.log('Middleware checks:');
    console.log('!user:', condition1);
    console.log('user.level !== global:', condition2);
    console.log('user.role !== super_admin:', condition3);
    console.log('Overall (should fail):', overallCondition);
    
    res.json({
      success: true,
      user: user,
      middlewareChecks: {
        noUser: condition1,
        levelNotGlobal: condition2,
        roleNotSuperAdmin: condition3,
        wouldFail: overallCondition
      },
      tokenValid: true,
      jwtSecret: process.env.JWT_SECRET || 'dev-secret'
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.json({
      error: error.message,
      jwtSecret: process.env.JWT_SECRET || 'dev-secret'
    });
  }
});


// Endpoint para obtener logs de WhatsApp
apiRouter.get('/whatsapp/logs', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    
    // Parámetros de consulta opcionales
    const { limit = 50, offset = 0, type, phoneNumber, status } = req.query;
    
    // Filtros opcionales
    const filters = {
      type: type ? String(type) : undefined,
      phoneNumber: phoneNumber ? String(phoneNumber) : undefined,
      status: status ? String(status) : undefined,
    };
    
    // Obtener logs según el nivel del usuario
    let logs;
    if (user.level === 'global') {
      // Super admin puede ver todos los logs
      logs = await storage.getAllWhatsAppLogs(
        parseInt(String(limit)), 
        parseInt(String(offset)), 
        filters
      );
    } else {
      // Usuarios regulares solo ven logs de su tienda
      logs = await storage.getWhatsAppLogs(
        user.storeId,
        parseInt(String(limit)), 
        parseInt(String(offset)), 
        filters
      );
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      logs,
      pagination: {
        limit: parseInt(String(limit)),
        offset: parseInt(String(offset)),
        total: logs.length
      }
    });
  } catch (error) {
    console.error('Error getting WhatsApp logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener logs de WhatsApp' 
    });
  }
});

// Endpoint adicional para obtener estadísticas de logs
apiRouter.get('/whatsapp/logs/stats', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    
    // Obtener estadísticas según el nivel del usuario
    let stats;
    if (user.level === 'global') {
      stats = await storage.getWhatsAppLogStats(); // Para super admin
    } else {
      stats = await storage.getWhatsAppLogStats(user.storeId); // Para usuarios de tienda
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      stats: {
        total: stats.total || 0,
        success: stats.success || 0,
        errors: stats.errors || 0,
        today: stats.today || 0,
        thisWeek: stats.thisWeek || 0,
        thisMonth: stats.thisMonth || 0
      }
    });
  } catch (error) {
    console.error('Error getting WhatsApp log stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener estadísticas de logs' 
    });
  }
});

// Endpoint para limpiar logs antiguos (solo super admin)
apiRouter.delete('/whatsapp/logs/cleanup', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Super admin access required' 
      });
    }
    
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const { days = 30 } = req.body;
    
    const deletedCount = await storage.cleanupOldWhatsAppLogs(parseInt(String(days)));
    
    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      message: `${deletedCount} logs eliminados`,
      deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up WhatsApp logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al limpiar logs antiguos' 
    });
  }
});

// CONVERSACIONES
apiRouter.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const conversations = await storage.getAllConversations(user.storeId);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

apiRouter.get('/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const id = parseInt(req.params.id);
    const conversation = await storage.getConversation(id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// PRODUCTOS - using tenant storage
apiRouter.get('/products', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.level === 'tenant' && user.storeId) {
      // Use tenant storage for store-specific products
      const { getTenantDb } = await import('./multi-tenant-db.js');
      const { createTenantStorage } = await import('./tenant-storage.js');
      
      const tenantDb = await getTenantDb(user.storeId);
      const tenantStorage = createTenantStorage(tenantDb);
      
      const products = await tenantStorage.getAllProducts();
      res.json(products);
    } else {
      // Use main storage for global access
      const { DatabaseStorage } = await import('./storage.js');
      const storage = new DatabaseStorage();
      
      const products = await storage.getAllProducts(user.storeId);
      res.json(products);
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

apiRouter.get('/products/:id', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const id = parseInt(req.params.id);
    
    if (user.level === 'tenant' && user.storeId) {
      const { getTenantDb } = await import('./multi-tenant-db.js');
      const { createTenantStorage } = await import('./tenant-storage.js');
      
      const tenantDb = await getTenantDb(user.storeId);
      const tenantStorage = createTenantStorage(tenantDb);
      
      const product = await tenantStorage.getProductById(id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(product);
    } else {
      const { DatabaseStorage } = await import('./storage.js');
      const storage = new DatabaseStorage();
      
      const product = await storage.getProduct(id, user.storeId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(product);
    }
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

apiRouter.post('/products', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.level === 'tenant' && user.storeId) {
      const { getTenantDb } = await import('./multi-tenant-db.js');
      const { createTenantStorage } = await import('./tenant-storage.js');
      
      const tenantDb = await getTenantDb(user.storeId);
      const tenantStorage = createTenantStorage(tenantDb);
      
      const product = await tenantStorage.createProduct(req.body);
      res.status(201).json(product);
    } else {
      const { DatabaseStorage } = await import('./storage.js');
      const storage = new DatabaseStorage();
      
      const product = await storage.createProduct(req.body, user.storeId);
      res.status(201).json(product);
    }
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

apiRouter.put('/products/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const id = parseInt(req.params.id);
    const user = (req as any).user;
    
    const product = await storage.updateProduct(id, req.body, user.storeId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

apiRouter.delete('/products/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const id = parseInt(req.params.id);
    const user = (req as any).user;
    
    const success = await storage.deleteProduct(id, user.storeId);
    if (!success) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// CLIENTES
apiRouter.get('/customers', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const customers = await storage.getAllCustomers(user.storeId);
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

apiRouter.post('/customers', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const customerData = { ...req.body, storeId: user.storeId };
    
    const customer = await storage.createCustomer(customerData);
    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

apiRouter.put('/customers/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const id = parseInt(req.params.id);
    const user = (req as any).user;
    
    const customer = await storage.updateCustomer(id, req.body, user.storeId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

apiRouter.delete('/customers/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const id = parseInt(req.params.id);
    const user = (req as any).user;
    
    const success = await storage.deleteCustomer(id, user.storeId);
    if (!success) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// MÉTRICAS
apiRouter.get('/metrics', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const metrics = await storage.getDashboardMetrics(user.storeId);
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

apiRouter.get('/dashboard/metrics', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const metrics = await storage.getDashboardMetrics(user.storeId);
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// ÓRDENES
apiRouter.get('/orders', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const orders = await storage.getAllOrders(user.storeId);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

apiRouter.get('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const id = parseInt(req.params.id);
    const user = (req as any).user;
    
    const order = await storage.getOrder(id, user.storeId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

apiRouter.post('/orders', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();

    const user = (req as any).user;
    // Separamos items del resto de campos
    const { items, ...rest } = req.body as {
      items: Array<{
        productId: number;
        quantity: number;
        unitPrice: string;
        totalPrice: string;
      }>;
      [key: string]: any;
    };

    // 1. Construimos el objeto InsertOrder
    const insertOrder = {
      ...rest,
      storeId: user.storeId
    };

    // 2. Llamamos con los dos argumentos
    const order = await storage.createOrder(insertOrder, items);
    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});


// USUARIOS (para gestión interna de tienda)
apiRouter.get('/users', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const users = await storage.getAllUsers(user.storeId);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// NOTIFICACIONES
apiRouter.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const notifications = await storage.getUserNotifications(user.id, user.storeId);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Add this to your index.ts API routes
apiRouter.get('/notifications/count', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const userId = parseInt(req.query.userId as string) || user.id;
    const counts = await storage.getNotificationCounts(userId);
    res.json(counts);
  } catch (error) {
    console.error('Error fetching notification counts:', error);
    res.status(500).json({ error: 'Failed to fetch notification counts' });
  }
});

// CONFIGURACIONES DE TIENDA
apiRouter.get('/settings', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const settings = await storage.getStoreConfig(user.storeId);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

apiRouter.put('/settings', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const settings = await storage.updateStoreSettings(user.storeId, req.body);
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// CONFIGURACIÓN WHATSAPP (específica de tienda)
apiRouter.get('/whatsapp-settings', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const config = await storage.getWhatsAppConfig(user.storeId);
    res.json(config || {});
  } catch (error) {
    console.error('Error fetching WhatsApp settings:', error);
    res.status(500).json({ error: 'Failed to fetch WhatsApp settings' });
  }
});

apiRouter.put('/whatsapp-settings', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const config = await storage.updateWhatsAppConfig(req.body, user.storeId);
    res.json(config);
  } catch (error) {
    console.error('Error updating WhatsApp settings:', error);
    res.status(500).json({ error: 'Failed to update WhatsApp settings' });
  }
});

// DASHBOARD STATS
apiRouter.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const stats = await storage.getDashboardStats(user.storeId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// MENSAJES
apiRouter.get('/messages', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const conversationId = req.query.conversationId as string;
    
    if (conversationId) {
      const messages = await storage.getMessagesByConversation(parseInt(conversationId), user.storeId);
      res.json(messages);
    } else {
      const messages = await storage.getAllMessages(user.storeId);
      res.json(messages);
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

apiRouter.post('/messages', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const messageData = { ...req.body, storeId: user.storeId };
    
    const message = await storage.createMessage(messageData);
    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// WEBHOOK WHATSAPP
apiRouter.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  const verify_token = process.env.WEBHOOK_VERIFY_TOKEN || 'default_verify_token_12345';
  
  if (mode === 'subscribe' && token === verify_token) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

apiRouter.post('/webhook', async (req, res) => {
  try {
    console.log('📥 Webhook received:', JSON.stringify(req.body, null, 2));
    
    // Process WhatsApp webhook
 const { processWhatsAppMessageSimple } = await import('./whatsapp-simple.js');
await processWhatsAppMessageSimple(req.body);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('Error');
  }
});

// TIENDAS (para usuarios regulares)
apiRouter.get('/stores', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.level === 'global') {
      // Super admin puede ver todas las tiendas
      const { DatabaseStorage } = await import('./storage.js');
      const storage = new DatabaseStorage();
      const stores = await storage.getAllVirtualStores();
      res.json(stores);
    } else {
      // Usuarios regulares solo ven su tienda
      const store = await getStoreInfo(user.storeId);
      res.json(store ? [store] : []);
    }
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

// ================================
// ENDPOINTS ADICIONALES QUE PUEDEN ESTAR FALTANDO
// ================================

// AUTO RESPONSES (ya están implementados arriba pero con prefijo /store-responses)
apiRouter.get('/auto-responses', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const responses = await storage.getAllAutoResponses(user.storeId);
    res.json(responses);
  } catch (error) {
    console.error('Error fetching auto-responses:', error);
    res.status(500).json({ error: 'Failed to fetch auto-responses' });
  }
});

apiRouter.post('/auto-responses', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const responseData = { ...req.body, storeId: user.storeId };
    
    const response = await storage.createAutoResponse(responseData);
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating auto-response:', error);
    res.status(500).json({ error: 'Failed to create auto-response' });
  }
});

apiRouter.put('/auto-responses/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const id = parseInt(req.params.id);
    const user = (req as any).user;
    
    const response = await storage.updateAutoResponse(id, req.body, user.storeId);
    res.json(response);
  } catch (error) {
    console.error('Error updating auto-response:', error);
    res.status(500).json({ error: 'Failed to update auto-response' });
  }
});

apiRouter.delete('/auto-responses/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();

    const id = parseInt(req.params.id);
    const user = (req as any).user;

    await storage.deleteAutoResponse(id, user.storeId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting auto-response:', error);
    res.status(500).json({ error: 'Failed to delete auto-response' });
  }
});

// ASSIGNMENT RULES
apiRouter.get('/assignment-rules', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const rules = await storage.getAllAssignmentRules(user.storeId);
    res.json(rules);
  } catch (error) {
    console.error('Error fetching assignment rules:', error);
    res.status(500).json({ error: 'Failed to fetch assignment rules' });
  }
});

// EMPLOYEES/TECHNICIANS
apiRouter.get('/employees', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const employees = await storage.getAllEmployees(user.storeId);
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

apiRouter.post('/employees', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const employeeData = { ...req.body, storeId: user.storeId };
    
    const employee = await storage.createEmployee(employeeData);
    res.status(201).json(employee);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

apiRouter.put('/employees/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const id = parseInt(req.params.id);
    const user = (req as any).user;
    
    const employee = await storage.updateEmployee(id, req.body, user.storeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json(employee);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

apiRouter.delete('/employees/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const id = parseInt(req.params.id);
    const user = (req as any).user;
    
    const success = await storage.deleteEmployee(id, user.storeId);
    if (!success) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
});

// CART/SHOPPING CART
apiRouter.get('/cart', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const sessionId = req.query.sessionId as string;
    const userId = user.id;
    
    const cart = await storage.getCart(sessionId, userId, user.storeId);
    res.json(cart);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

apiRouter.post('/cart', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();

    const user = (req as any).user;
    const { sessionId, productId, quantity } = req.body as {
      sessionId: string;
      productId: number;
      quantity: number;
    };

    // 1) Añadimos al carrito con los 3–4 argumentos
    await storage.addToCart(
      sessionId,
      productId,
      quantity,
      user.id      // o user.storeId, según tu diseño
    );

    // 2) (Opcional) Traemos el carrito actualizado y lo devolvemos
    const cart = await storage.getCart(sessionId, user.id);
    res.status(201).json(cart);
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});


apiRouter.put('/cart/:id', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const id = parseInt(req.params.id);
    const user = (req as any).user;
    
    const cartItem = await storage.updateCartItem(id, req.body, user.storeId);
    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    
    res.json(cartItem);
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
});

apiRouter.delete('/cart/:productId', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();

    const user = (req as any).user as { id: number; storeId: number };
    const sessionId = req.query.sessionId as string;           // ej. /cart/42?sessionId=abc123
    const productId = parseInt(req.params.productId, 10);

    await storage.removeFromCart(
      sessionId,
      productId,
      user.id                                               // o user.storeId si lo requieres
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing cart item:', error);
    res.status(500).json({ error: 'Failed to remove cart item' });
  }
});


// CATEGORIES
apiRouter.get('/categories', authenticateToken, async (req, res) => {
  try {
    const { createTenantStorage } = await import('./tenant-storage.js');
    const { getTenantDb } = await import('./multi-tenant-db.js');
    
    const user = (req as any).user;
    const tenantDb = await getTenantDb(user.storeId);
    const storage = createTenantStorage(tenantDb);
    
    const categories = await storage.getAllCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

apiRouter.post('/categories', authenticateToken, async (req, res) => {
  try {
    const { createTenantStorage } = await import('./tenant-storage.js');
    const { getTenantDb } = await import('./multi-tenant-db.js');
    
    const user = (req as any).user;
    const tenantDb = await getTenantDb(user.storeId);
    const storage = createTenantStorage(tenantDb);
    
    const category = await storage.createCategory(req.body);
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// REPORTS/ANALYTICS
apiRouter.get('/reports', authenticateToken, async (req, res) => {
  try {
    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const user = (req as any).user;
    const { type, startDate, endDate } = req.query;
    
    const reports = await storage.getReports(user.storeId, {
      type: type as string,
      startDate: startDate as string,
      endDate: endDate as string
    });
    
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
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
        
        if (decoded.role !== 'super_admin') {
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
  const wss = new WebSocketServer({ 
  server,
  handleProtocols: () => false, // Evitar problemas de protocolo
  perMessageDeflate: false // Desactivar compresión que puede causar errores
});

wss.on('connection', (socket, req) => {
  console.log('🔌 Nueva conexión WebSocket');
  
  try {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    console.log('Token recibido:', token ? `${token.substring(0, 10)}...` : 'null');

    // Validar JWT token si existe
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
        console.log('✅ Token válido para WebSocket');

        // Send welcome message
        socket.send(JSON.stringify({ 
          type: 'connected', 
          message: 'WebSocket conectado exitosamente',
          timestamp: new Date().toISOString()
        }));
      } catch (jwtError: any) {
        console.log('❌ Token JWT inválido:', jwtError.message);
        socket.send(JSON.stringify({ 
          type: 'error', 
          message: 'Token inválido' 
        }));
        socket.close(1000, 'Token inválido');
        return;
      }
    } else {
      console.log('⚠️ WebSocket sin token - conexión limitada');
      socket.send(JSON.stringify({ 
        type: 'connected', 
        message: 'WebSocket conectado sin autenticación' 
      }));
    }

    // Handle incoming messages
    socket.on('message', (data) => {
      try {
        const message = data.toString();
        console.log('📩 Mensaje WebSocket:', message);
        
        // Echo back para testing
        socket.send(JSON.stringify({ 
          type: 'echo', 
          data: message 
        }));
      } catch (error) {
        console.error('Error procesando mensaje WebSocket:', error);
      }
    });

    // Handle connection close
    socket.on('close', (code, reason) => {
      console.log(`🔌 WebSocket cerrado - Code: ${code}, Reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('❌ Error WebSocket:', error.message);
    });

  } catch (error: any) {
    console.error('❌ Error configurando WebSocket:', error.message);
    try {
      socket.close(1000, 'Error de configuración');
    } catch (closeError) {
      console.error('Error cerrando socket:', closeError);
    }
  }
});

// Manejar errores del servidor WebSocket
wss.on('error', (error) => {
  console.error('❌ Error del servidor WebSocket:', error.message);
});

console.log('🔌 Servidor WebSocket configurado con manejo de errores mejorado');

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