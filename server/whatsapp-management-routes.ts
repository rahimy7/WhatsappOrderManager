import { Express } from 'express';
import { z } from 'zod';
import { IStorage } from './storage.js';

/**
 * Registra las rutas de gestión centralizada de WhatsApp para super admin
 */
export function registerWhatsAppManagementRoutes(app: Express, storage: IStorage) {
  
  // Middleware para verificar super admin
  const requireSuperAdmin = (req: any, res: any, next: any) => {
    const user = req.user;
    if (!user || user.level !== 'global' || user.role !== 'super_admin') {
      return res.status(403).json({ error: "Super admin access required" });
    }
    next();
  };

  // GET - Obtener todas las configuraciones de WhatsApp
  app.get("/api/super-admin/whatsapp-configs", requireSuperAdmin, async (req, res) => {
    try {
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

  // POST - Crear nueva configuración de WhatsApp
  app.post("/api/super-admin/whatsapp-configs", requireSuperAdmin, async (req, res) => {
    try {
      const configData = z.object({
        storeId: z.number(),
        accessToken: z.string().min(1, "Token de acceso requerido"),
        phoneNumberId: z.string().min(1, "Phone Number ID requerido"),
        webhookVerifyToken: z.string().min(1, "Webhook verify token requerido"),
        businessAccountId: z.string().optional(),
        appId: z.string().optional(),
        isActive: z.boolean().default(true)
      }).parse(req.body);

      const config = await storage.updateWhatsAppConfig(configData, configData.storeId);
      res.json({ success: true, config });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos de configuración inválidos", details: error.errors });
      }
      console.error("Error creating WhatsApp config:", error);
      res.status(500).json({ error: "Error al crear configuración de WhatsApp" });
    }
  });

  // PUT - Actualizar configuración existente por ID
  app.put("/api/super-admin/whatsapp-configs/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const configData = z.object({
        storeId: z.number(),
        accessToken: z.string().min(1, "Token de acceso requerido"),
        phoneNumberId: z.string().min(1, "Phone Number ID requerido"),
        webhookVerifyToken: z.string().min(1, "Webhook verify token requerido"),
        businessAccountId: z.string().optional(),
        appId: z.string().optional(),
        isActive: z.boolean().default(true)
      }).parse(req.body);

      const config = await storage.updateWhatsAppConfigById(id, configData);
      res.json({ success: true, config });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos de configuración inválidos", details: error.errors });
      }
      console.error("Error updating WhatsApp config:", error);
      res.status(500).json({ error: "Error al actualizar configuración de WhatsApp" });
    }
  });

  // DELETE - Eliminar configuración por ID
  app.delete("/api/super-admin/whatsapp-configs/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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

  // POST - Probar conexión de WhatsApp
  app.post("/api/super-admin/whatsapp-test", requireSuperAdmin, async (req, res) => {
    try {
      const { storeId, phoneNumberId } = req.body;
      
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

  // GET - Obtener todas las tiendas virtuales
  app.get("/api/super-admin/stores", requireSuperAdmin, async (req, res) => {
    try {
      const stores = await storage.getAllVirtualStores();
      res.json(stores);
    } catch (error) {
      console.error("Error getting virtual stores:", error);
      res.status(500).json({ error: "Error al obtener tiendas virtuales" });
    }
  });
}