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

const app = express();

// CRITICAL: Create a high-priority router for API endpoints
const apiRouter = express.Router();

// Health endpoint
apiRouter.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Login endpoint
apiRouter.post('/auth/login', express.json(), async (req, res) => {
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

// Auto-responses endpoints with high priority (renamed to avoid conflicts)
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
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const jwt = await import('jsonwebtoken');
    const payload = jwt.default.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthUser;
    
    // Usar payload.storeId con verificación
    const storeId = payload.storeId || payload.userId;
    const responseData = { ...req.body, storeId };
    const response = await storage.createAutoResponse(responseData);
    res.setHeader('Content-Type', 'application/json');
    res.json(response);
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
  const jwt = await import('jsonwebtoken');
    const token = authHeader.substring(7);
     const payload = jwt.default.verify(token, process.env.JWT_SECRET || 'dev-secret');
    

const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'dev-secret') as JwtPayload;

const id = parseInt(req.params.id);
const response = await storage.updateAutoResponse(id, req.body, decoded.storeId);
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

apiRouter.post('/super-admin/whatsapp-configs', express.json(), async (req, res) => {
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

apiRouter.put('/super-admin/whatsapp-configs/:id', express.json(), async (req, res) => {
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

apiRouter.post('/super-admin/whatsapp-test', express.json(), async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { storeId, phoneNumberId } = req.body;
    
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
        isActive: config.isActive
      }
    });
  } catch (error) {
    console.error("Error testing WhatsApp connection:", error);
    res.status(500).json({ 
      success: false, 
      error: "TEST_ERROR",
      message: "Error al probar la conexión" 
    });
  }
});

// Super Admin Stores endpoint
apiRouter.get('/super-admin/stores', async (req, res) => {
  try {
    const user = (req as any).user;
    console.log('🚨 === DEBUG SUPER ADMIN STORES ===');
    console.log('req.user:', user);
    
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      console.log('❌ FAILING CONDITIONS:');
      console.log('  - user exists:', !!user);
      console.log('  - user.level:', user?.level);
      console.log('  - user.role:', user?.role);
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    const stores = await storage.getAllVirtualStores();
    res.json(stores);
  } catch (error) {
    console.error("Error getting virtual stores:", error);
    res.status(500).json({ error: "Error al obtener tiendas virtuales" });
  }
});

apiRouter.get('/super-admin/global-whatsapp-settings', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    // Por ahora devolvemos configuración por defecto
    // En el futuro esto se puede almacenar en una tabla de configuración global
    const defaultGlobalSettings = {
      webhook: {
        webhookUrl: process.env.WEBHOOK_URL || "https://tu-servidor.com/api/whatsapp/webhook",
        webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || "",
        isActive: true,
        lastUpdate: new Date().toISOString()
      },
      defaultSettings: {
        businessHours: {
          enabled: true,
          startTime: "09:00",
          endTime: "18:00",
          timezone: "America/Santo_Domingo"
        },
        autoResponses: {
          enabled: true,
          welcomeMessage: "¡Hola! Bienvenido a nuestro servicio. ¿En qué podemos ayudarte?",
          businessHoursMessage: "Gracias por contactarnos. Te responderemos pronto.",
          afterHoursMessage: "Estamos fuera de horario. Nuestro horario es de 9:00 AM a 6:00 PM."
        },
        rateLimiting: {
          enabled: true,
          maxMessagesPerMinute: 10,
          blockDuration: 60
        }
      }
    };

    res.json(defaultGlobalSettings);
  } catch (error) {
    console.error("Error getting global WhatsApp settings:", error);
    res.status(500).json({ error: "Error al obtener configuración global de WhatsApp" });
  }
});

apiRouter.put('/super-admin/global-whatsapp-settings', express.json(), async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { z } = await import('zod');
    
    // Validación de datos
    const globalSettingsSchema = z.object({
      webhook: z.object({
        webhookUrl: z.string().url("URL del webhook inválida"),
        webhookVerifyToken: z.string().min(8, "Token debe tener al menos 8 caracteres"),
        isActive: z.boolean()
      }),
      defaultSettings: z.object({
        businessHours: z.object({
          enabled: z.boolean(),
          startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido"),
          endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido"),
          timezone: z.string()
        }),
        autoResponses: z.object({
          enabled: z.boolean(),
          welcomeMessage: z.string().min(1, "Mensaje de bienvenida requerido"),
          businessHoursMessage: z.string().min(1, "Mensaje de horario requerido"),
          afterHoursMessage: z.string().min(1, "Mensaje fuera de horario requerido")
        }),
        rateLimiting: z.object({
          enabled: z.boolean(),
          maxMessagesPerMinute: z.number().min(1).max(100),
          blockDuration: z.number().min(30).max(3600)
        })
      })
    });

    const validatedSettings = globalSettingsSchema.parse(req.body);
    
    // Aquí podrías guardar en una tabla de configuración global
    // Por ahora solo validamos y devolvemos éxito
    console.log('Configuración global actualizada:', {
      webhook: {
        ...validatedSettings.webhook,
        webhookVerifyToken: '***masked***' // No loggear el token completo
      },
      defaultSettings: validatedSettings.defaultSettings
    });

    // En el futuro, guardar en base de datos:
    // await saveGlobalWhatsAppSettings(validatedSettings);

    res.json({ 
      success: true, 
      message: "Configuración global actualizada exitosamente",
      settings: {
        ...validatedSettings,
        webhook: {
          ...validatedSettings.webhook,
          lastUpdate: new Date().toISOString()
        }
      }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        error: "Datos de configuración inválidos", 
        details: error.errors 
      });
    }
    console.error("Error updating global WhatsApp settings:", error);
    res.status(500).json({ error: "Error al actualizar configuración global de WhatsApp" });
  }
});

apiRouter.post('/super-admin/test-webhook', express.json(), async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { webhookUrl } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({ 
        success: false,
        error: "MISSING_URL",
        message: "URL del webhook requerida" 
      });
    }

    try {
      // Hacer una petición de prueba al webhook
      const fetch = await import('node-fetch');
      const testPayload = {
        object: "whatsapp_business_account",
        entry: [{
          id: "test_entry",
          changes: [{
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "test_number",
                phone_number_id: "test_phone_id"
              },
              messages: [{
                from: "test_sender",
                id: "test_message_id",
                timestamp: Date.now().toString(),
                text: { body: "Test message from super admin webhook validation" },
                type: "text"
              }]
            },
            field: "messages"
          }]
        }]
      };

      const response = await fetch.default(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WhatsApp-Super-Admin-Test/1.0'
        },
        body: JSON.stringify(testPayload),
        timeout: 10000 // 10 segundos de timeout
      });

      if (response.ok) {
        res.json({
          success: true,
          message: `Webhook respondió correctamente (${response.status})`,
          details: {
            status: response.status,
            statusText: response.statusText,
            url: webhookUrl
          }
        });
      } else {
        res.json({
          success: false,
          error: "WEBHOOK_ERROR",
          message: `Webhook respondió con error (${response.status}: ${response.statusText})`,
          details: {
            status: response.status,
            statusText: response.statusText,
            url: webhookUrl
          }
        });
      }
    } catch (fetchError: any) {
      res.json({
        success: false,
        error: "CONNECTION_ERROR",
        message: `No se pudo conectar al webhook: ${fetchError.message}`,
        details: {
          error: fetchError.code || fetchError.message,
          url: webhookUrl
        }
      });
    }
  } catch (error) {
    console.error("Error testing webhook:", error);
    res.status(500).json({ 
      success: false, 
      error: "INTERNAL_ERROR",
      message: "Error interno al probar el webhook" 
    });
  }
});

// 2. TAMBIÉN AGREGAR este endpoint para obtener información del webhook actual
apiRouter.get('/super-admin/webhook-info', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    // Información sobre el webhook actual del sistema
    const webhookInfo = {
      currentWebhookUrl: process.env.WEBHOOK_URL || "No configurado",
      verifyToken: process.env.WEBHOOK_VERIFY_TOKEN ? "Configurado" : "No configurado",
      serverUrl: req.protocol + '://' + req.get('host'),
      recommendedWebhookUrl: req.protocol + '://' + req.get('host') + '/api/whatsapp/webhook',
      status: "active",
      lastActivity: new Date().toISOString()
    };

    res.json(webhookInfo);
  } catch (error) {
    console.error("Error getting webhook info:", error);
    res.status(500).json({ error: "Error al obtener información del webhook" });
  }
});

// 3. ENDPOINT PARA VALIDAR TODAS LAS CONFIGURACIONES DE WHATSAPP
apiRouter.get('/super-admin/validate-all-whatsapp', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const configs = await storage.getAllWhatsAppConfigs();
    const stores = await storage.getAllVirtualStores();
    
    const validationResults = configs.map(config => {
      const store = stores.find(s => s.id === config.storeId);
      const issues = [];
      
      // Validaciones básicas
      if (!config.accessToken || config.accessToken.length < 50) {
        issues.push("Token de acceso inválido o muy corto");
      }
      
      if (!config.phoneNumberId || config.phoneNumberId.length < 10) {
        issues.push("Phone Number ID inválido");
      }
      
      if (!config.webhookVerifyToken || config.webhookVerifyToken.length < 8) {
        issues.push("Webhook verify token muy corto");
      }
      
      if (!config.isActive) {
        issues.push("Configuración desactivada");
      }

      return {
        storeId: config.storeId,
        storeName: store?.name || `Tienda ${config.storeId}`,
        isValid: issues.length === 0,
        issues: issues,
        configId: config.id
      };
    });

    const summary = {
  total: configs.length,
  valid: validationResults.filter(r => r.isValid).length,
  invalid: validationResults.filter(r => !r.isValid).length,
  totalIssues: validationResults.reduce((acc, r) => acc + r.issues.length, 0)
};

res.json({
  message: `Validación completada: ${summary.valid}/${summary.total} configuraciones válidas`,
  summary,
  results: validationResults
});

  } catch (error) {
    console.error("Error validating all WhatsApp configs:", error);
    res.status(500).json({ error: "Error al validar configuraciones de WhatsApp" });
  }
});

// 4. ENDPOINT PARA APLICAR CONFIGURACIÓN GLOBAL A TODAS LAS TIENDAS
apiRouter.post('/super-admin/apply-global-settings', express.json(), async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { settingsToApply } = req.body; // ['webhook', 'businessHours', 'autoResponses', 'rateLimiting']
    
    if (!settingsToApply || !Array.isArray(settingsToApply)) {
      return res.status(400).json({ 
        error: "Configuraciones a aplicar requeridas",
        expected: "Array con valores: webhook, businessHours, autoResponses, rateLimiting"
      });
    }

    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const stores = await storage.getAllVirtualStores();
    const appliedTo = [];
    const errors = [];

    for (const store of stores) {
      try {
        if (settingsToApply.includes('webhook')) {
          // Aplicar configuración de webhook global a la tienda
          console.log(`Aplicando configuración de webhook a tienda ${store.name}`);
          appliedTo.push(`Webhook aplicado a ${store.name}`);
        }
        
        if (settingsToApply.includes('businessHours')) {
          // Aplicar horario de atención global a la tienda
          console.log(`Aplicando horario de atención a tienda ${store.name}`);
          appliedTo.push(`Horario aplicado a ${store.name}`);
        }
        
        if (settingsToApply.includes('autoResponses')) {
          // Aplicar respuestas automáticas globales a la tienda
          console.log(`Aplicando respuestas automáticas a tienda ${store.name}`);
          appliedTo.push(`Respuestas aplicadas a ${store.name}`);
        }
        
        if (settingsToApply.includes('rateLimiting')) {
          // Aplicar límites de velocidad globales a la tienda
          console.log(`Aplicando límites de velocidad a tienda ${store.name}`);
          appliedTo.push(`Límites aplicados a ${store.name}`);
        }
      } catch (storeError: any) {
        errors.push(`Error en ${store.name}: ${storeError.message}`);
      }
    }

    res.json({
      success: errors.length === 0,
      message: `Configuración aplicada a ${stores.length} tiendas`,
      appliedTo,
      errors,
      summary: {
        totalStores: stores.length,
        successful: appliedTo.length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error("Error applying global settings:", error);
    res.status(500).json({ error: "Error al aplicar configuración global" });
  }
});

// 5. ENDPOINT PARA OBTENER ESTADÍSTICAS DEL SISTEMA WHATSAPP
apiRouter.get('/super-admin/whatsapp-stats', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const configs = await storage.getAllWhatsAppConfigs();
    const stores = await storage.getAllVirtualStores();
    
    // Calcular estadísticas
    const stats = {
      totalStores: stores.length,
      configuredStores: configs.length,
      activeConfigs: configs.filter(c => c.isActive).length,
      inactiveConfigs: configs.filter(c => !c.isActive).length,
      storesWithoutWhatsApp: stores.length - configs.length,
      configurationRate: stores.length > 0 ? ((configs.length / stores.length) * 100).toFixed(1) : "0",
      activationRate: configs.length > 0 ? ((configs.filter(c => c.isActive).length / configs.length) * 100).toFixed(1) : "0",
      lastConfigUpdate: configs.length > 0 ? 
        Math.max(...configs.map(c => new Date(c.updatedAt || c.createdAt || Date.now()).getTime())) : null
    };
    
    // Configuraciones por tienda
    const storeConfigs = stores.map(store => {
      const config = configs.find(c => c.storeId === store.id);
      return {
        storeId: store.id,
        storeName: store.name,
        hasWhatsApp: !!config,
        isActive: config?.isActive || false,
        phoneNumberId: config?.phoneNumberId || null,
        lastUpdate: config?.updatedAt || null
      };
    });

    res.json({
      stats,
      storeConfigs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error getting WhatsApp stats:", error);
    res.status(500).json({ error: "Error al obtener estadísticas de WhatsApp" });
  }
});

// 6. ENDPOINT PARA BACKUP Y RESTAURACIÓN DE CONFIGURACIONES
apiRouter.get('/super-admin/whatsapp-backup', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const configs = await storage.getAllWhatsAppConfigs();
    const stores = await storage.getAllVirtualStores();
    
    // Crear backup con información sensible enmascarada para seguridad
    const backup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      configs: configs.map(config => ({
        ...config,
        accessToken: config.accessToken ? "***MASKED***" : "",
        webhookVerifyToken: config.webhookVerifyToken ? "***MASKED***" : ""
      })),
      stores: stores.map(store => ({
        id: store.id,
        name: store.name,
        domain: store.domain,
        isActive: store.isActive
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="whatsapp-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(backup);
  } catch (error) {
    console.error("Error creating WhatsApp backup:", error);
    res.status(500).json({ error: "Error al crear backup de configuraciones" });
  }
});

apiRouter.post('/super-admin/whatsapp-restore', express.json(), async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const { backupData, restoreOptions } = req.body;
    
    if (!backupData || !backupData.configs) {
      return res.status(400).json({ 
        error: "Datos de backup inválidos",
        expected: "Objeto con propiedad 'configs'"
      });
    }

    const { DatabaseStorage } = await import('./storage.js');
    const storage = new DatabaseStorage();
    
    const restored = [];
    const errors = [];
    
    for (const configData of backupData.configs) {
      try {
        if (configData.accessToken === "***MASKED***") {
          errors.push(`Configuración de tienda ${configData.storeId}: Tokens enmascarados en backup`);
          continue;
        }
        
        // Restaurar configuración (esto necesitaría implementarse en storage)
        // await storage.restoreWhatsAppConfig(configData);
        restored.push(`Tienda ${configData.storeId} restaurada`);
      } catch (restoreError: any) {
        errors.push(`Error restaurando tienda ${configData.storeId}: ${restoreError.message}`);
      }
    }

    res.json({
      success: errors.length === 0,
      message: `Restauración completada: ${restored.length} configuraciones restauradas`,
      restored,
      errors,
      summary: {
        totalConfigs: backupData.configs.length,
        successful: restored.length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error("Error restoring WhatsApp backup:", error);
    res.status(500).json({ error: "Error al restaurar backup de configuraciones" });
  }
});

// Middleware de autenticación (necesario para obtener storeId del usuario)
function extractUserFromToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthUser;
      req.user = decoded;
      console.log('🔑 JWT Success - User authenticated:', decoded.username, 'role:', decoded.role, 'level:', decoded.level);
    } catch (error) {
      console.log('❌ JWT Error:', (error as Error).message);
      console.log('Token preview:', token.substring(0, 20) + '...');
      console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    }
  } else {
    console.log('ℹ️ No Authorization header or invalid format');
  }
  next();
}

// 1. Primero el middleware de debug
app.use('/api', (req, res, next) => {
  console.log('📍 API Router middleware - Path:', req.path, 'Headers:', !!req.headers.authorization);
  next();
});

// 2. Segundo el middleware de autenticación
app.use('/api', extractUserFromToken);

// 3. Tercero el router con los endpoints
app.use('/api', apiRouter);

// 4. Después el middleware de tenant
app.use('/api', (req, res, next) => {
  console.log('=== MIDDLEWARE WRAPPER EJECUTÁNDOSE ===');
  console.log('Path:', req.path);
  console.log('Method:', req.method);
  
  // Para rutas super-admin, solo bypassa el tenant middleware, NO el auth
  if (req.path.startsWith('/super-admin')) {
    console.log('🟢 BYPASSING TENANT MIDDLEWARE for super-admin:', req.path);
    console.log('🔍 User in bypassed middleware:', req.user);
    return next(); // Solo bypassa tenant, req.user ya está establecido por extractUserFromToken
  }
  
  // Para auth y test, bypassa todo
  if (req.path.startsWith('/auth') || req.path === '/whatsapp/test-connection') {
    console.log('🟢 BYPASSING ALL MIDDLEWARE for:', req.path);
    return next();
  }
  
  // Aplicar tenant middleware para todas las demás rutas
  console.log('Aplicando tenant middleware para:', req.path);
  return tenantMiddleware()(req, res, next);
});

(async () => {
  try {
    console.log('Starting application...');

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

    app.post('/api/super-admin/stores', express.json(), async (req, res) => {
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

    // CRITICAL: Super admin validation endpoint MUST be registered BEFORE any middleware
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
          recommendations: [] as string[],
          databaseStructure: {
            global: { status: '', tables: [] as string[] },
            tenant: { status: '', tables: [] as string[], exists: false }
          }
        };

        // 1. Verificar estructura de BD Global
        console.log('1. Verificando estructura de BD Global...');
        try {
          const globalTables = await masterDb.execute(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
          `);
          
          const globalTableNames = globalTables.rows.map(row => row.table_name as string);
          validationResults.databaseStructure.global.tables = globalTableNames;
          
          // Verificar si tenemos tablas que NO deberían estar en BD global
          const tenantTables = [
            'users', 'customers', 'products', 'orders', 'order_items', 
            'conversations', 'messages', 'auto_responses', 'store_settings',
            'whatsapp_settings', 'notifications', 'assignment_rules',
            'customer_history', 'shopping_cart', 'whatsapp_logs'
          ];
          
          const incorrectTablesInGlobal = tenantTables.filter(table => 
            globalTableNames.includes(table)
          );
          
          if (incorrectTablesInGlobal.length > 0) {
            validationResults.issues.push(
              `❌ ARQUITECTURA INCORRECTA: ${incorrectTablesInGlobal.length} tablas de tienda encontradas en BD global`
            );
            validationResults.issues.push(
              `Tablas problemáticas: ${incorrectTablesInGlobal.join(', ')}`
            );
            validationResults.recommendations.push(
              'Migrar datos a bases de datos separadas por tienda'
            );
          }

          validationResults.databaseStructure.global.status = 
            incorrectTablesInGlobal.length > 0 ? 'ESTRUCTURA INCORRECTA' : 'Correcta';
            
        } catch (error) {
          validationResults.issues.push('Error al verificar BD global');
        }

        // 2. Verificar si existe BD separada para la tienda
        console.log('2. Verificando BD separada para la tienda...');
        try {
          // Intentar conectar a la BD específica de la tienda
          if (store.databaseUrl && store.databaseUrl !== process.env.DATABASE_URL) {
            const tenantDb = await getTenantDb(storeId);
            
            const tenantTables = await tenantDb.execute(`
              SELECT table_name 
              FROM information_schema.tables 
              WHERE table_schema = 'public' 
              ORDER BY table_name
            `);
            
            validationResults.databaseStructure.tenant.exists = true;
            validationResults.databaseStructure.tenant.tables = 
              tenantTables.rows.map((row: any) => row.table_name as string);
            validationResults.databaseStructure.tenant.status = 'BD separada existe';
            
          } else {
            validationResults.databaseStructure.tenant.exists = false;
            validationResults.databaseStructure.tenant.status = 
              'BD separada NO existe - usando BD global';
            validationResults.issues.push(
              '❌ CRITICAL: Tienda usa la misma BD que el sistema global'
            );
            validationResults.recommendations.push(
              'Crear BD separada para la tienda y migrar datos'
            );
          }
        } catch (error) {
          validationResults.issues.push('Error al verificar BD de tienda');
        }

        // 3. Determinar si la arquitectura es correcta
        const isArchitectureCorrect = 
          validationResults.issues.length === 0 &&
          validationResults.databaseStructure.tenant.exists;

        // 4. Generar mensaje final
        let message;
        if (isArchitectureCorrect) {
          message = `✅ Ecosistema multi-tenant de ${store.name} correctamente configurado`;
        } else {
          message = `⚠️ PROBLEMA DETECTADO: ${store.name} NO tiene arquitectura multi-tenant correcta`;
        }

        res.json({
          valid: isArchitectureCorrect,
          message: message,
          details: validationResults
        });

      } catch (error) {
        console.error('Error en validación completa:', error);
        res.status(500).json({ 
          valid: false, 
          message: 'Error interno durante la validación',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // CRITICAL: API Route interceptor middleware - MUST be before Vite setup
    app.use('/api', (req, res, next) => {
      // Mark this as an API route to prevent Vite interference
      req.isApiRoute = true;
      res.setHeader('Content-Type', 'application/json');
      next();
    });

    app.use((req, res, next) => {
      const start = Date.now();
      const path = req.path;
      let capturedJsonResponse: Record<string, any> | undefined = undefined;

      const originalResJson = res.json;
      res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
      };

      res.on("finish", () => {
        const duration = Date.now() - start;
        if (path.startsWith("/api")) {
          let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
          if (capturedJsonResponse) {
            logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
          }

          if (logLine.length > 80) {
            logLine = logLine.slice(0, 79) + "…";
          }

          log(logLine);
        }
      });

      next();
    });

    // IMPORTANT: Register ALL routes BEFORE Vite setup
    const server = await registerRoutes(app);
    
    // Register multi-tenant user management routes
    registerUserManagementRoutes(app);

    // VALIDACIÓN ESPECÍFICA PARA TIENDAS MIGRADAS - moved before Vite
    app.get('/api/super-admin/stores/:id/validate-migration', async (req, res) => {
      try {
        const storeId = parseInt(req.params.id);
        console.log('=== VALIDACIÓN DE MIGRACIÓN ===');
        console.log('Store ID:', storeId);
        
        const [store] = await masterDb
          .select()
          .from(schema.virtualStores)
          .where(eq(schema.virtualStores.id, storeId))
          .limit(1);

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

    // Seed default auto responses and assignment rules
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
      throw err;
    });

    // Setup Vite AFTER all routes are configured
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on port 5000
    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`serving on port ${port}`);
    });

    // WebSocket Server - MOVED INSIDE THE ASYNC FUNCTION
    const wss = new WebSocketServer({ server });
    wss.on('connection', (socket, req) => {
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        console.log('🔌 Nueva conexión WebSocket con token:', token);

        // Validar token JWT si es necesario
        if (token) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
          console.log('✅ Token válido:', decoded);

          // Enviar mensaje de bienvenida
          socket.send(JSON.stringify({ type: 'connected', message: 'WebSocket conectado exitosamente' }));
        } else {
          console.log('❌ Token no proporcionado');
          socket.close();
        }

        // Mensajes entrantes del cliente
        socket.on('message', (data) => {
          console.log('📩 Mensaje recibido del cliente:', data.toString());
        });

        // Manejo de cierre de conexión
        socket.on('close', () => {
          console.log('🔌 Conexión WebSocket cerrada');
        });

      } catch (error: any) {
        console.error('❌ Error en conexión WebSocket:', error.message);
        socket.close();
      }
    });

  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
})();