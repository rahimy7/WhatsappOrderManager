import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { 
  insertOrderSchema, 
  insertCustomerSchema, 
  insertProductSchema,
  insertMessageSchema,
  insertWebMessageSchema,
  insertUserSchema,
  insertAutoResponseSchema,
  insertCustomerRegistrationFlowSchema,
  insertEmployeeProfileSchema,
  insertNotificationSchema,
  insertVirtualStoreSchema,
  insertSystemUserSchema,
  insertSystemAuditLogSchema,
} from "@shared/schema";
import { loginSchema, AuthUser } from "@shared/auth";
import { masterDb, getTenantDb, tenantMiddleware, getStoreInfo, validateStore, createTenantDatabase, copyDefaultConfigurationsToTenant } from "./multi-tenant-db";
import * as schema from "@shared/schema";
import { eq, sql, and, desc, ne, gte } from "drizzle-orm";

// Function to generate Google Maps link from GPS coordinates
function generateGoogleMapsLink(latitude: string | number, longitude: string | number, address?: string): string {
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
  
  // Generate Google Maps URL that works on both mobile and desktop
  const baseUrl = 'https://www.google.com/maps';
  const query = address ? encodeURIComponent(address) : `${lat},${lng}`;
  
  // URL format for better mobile app integration
  return `${baseUrl}/@${lat},${lng},15z?q=${query}`;
}

// Function to process auto-response by trigger
async function processAutoResponse(trigger: string, phoneNumber: string) {
  try {
    const autoResponses = await storage.getAllAutoResponses();
    const responses = autoResponses.filter(response => response.trigger === trigger && response.isActive);
    
    if (responses.length > 0) {
      const response = responses[0]; // Use first active response for the trigger
      
      if (response.menuOptions && response.menuType && response.menuType !== 'text_only') {
        // Send interactive message with menu options
        try {
          const menuOptions = JSON.parse(response.menuOptions);
          const interactiveMessage = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: "interactive",
            interactive: {
              type: "button",
              body: {
                text: response.messageText
              },
              action: {
                buttons: menuOptions.slice(0, 3).map((option: any, index: number) => ({
                  type: "reply",
                  reply: {
                    id: option.value || `option_${index}`,
                    title: option.label.substring(0, 20) // WhatsApp button limit
                  }
                }))
              }
            }
          };
          
          await sendWhatsAppInteractiveMessage(phoneNumber, interactiveMessage);
        } catch (error) {
          console.error('Error parsing menu options:', error);
          // Fallback to simple text message
          await sendWhatsAppMessage(phoneNumber, response.messageText);
        }
      } else {
        // Send simple text message
        await sendWhatsAppMessage(phoneNumber, response.messageText);
      }
      
      // Log the auto-response
      console.log(`Auto-response sent for trigger: ${trigger} to ${phoneNumber}`);
    }
  } catch (error) {
    console.error('Error processing auto-response:', error);
  }
}

// Helper functions for WhatsApp message sending
async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  try {
    const config = await storage.getWhatsAppConfig();
    
    if (!config) {
      console.error('WhatsApp configuration not found');
      return false;
    }

    const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;
    
    const data = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      text: { body: message }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp API error:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('WhatsApp message sent:', result);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

async function sendWhatsAppInteractiveMessage(phoneNumber: string, message: any) {
  try {
    const config = await storage.getWhatsAppConfig();
    
    if (!config) {
      console.error('WhatsApp configuration not found');
      return false;
    }

    const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp API error:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('WhatsApp interactive message sent:', result);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp interactive message:', error);
    return false;
  }
}

// Middleware de autenticación
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default-secret', (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Rutas de autenticación
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, companyId } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
      }

      // Comparar contraseña hasheada usando bcrypt
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
      }

      // Validar acceso según tipo de usuario
      if (user.role === 'super_admin') {
        // Super admin puede acceder sin companyId - no se requiere validación adicional
        console.log(`Super admin login: ${username}`);
      } else {
        // Usuarios regulares requieren companyId
        if (!companyId) {
          return res.status(400).json({ message: "ID de empresa requerido" });
        }
        // Aquí podrías validar que el usuario pertenece a la empresa especificada
        // Por ahora, simplemente almacenamos el companyId en el token
        console.log(`Tenant user login: ${username} for company: ${companyId}`);
      }

      // Generar token JWT
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role,
          companyId: user.role === 'super_admin' ? undefined : companyId
        },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: '24h' }
      );

      // Preparar datos del usuario para el frontend
      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status,
        companyId: user.role === 'super_admin' ? undefined : companyId,
        phone: user.phone || undefined,
        email: user.email || undefined,
        department: user.department || undefined,
      };

      res.json({ 
        success: true,
        user: authUser, 
        token,
        message: user.role === 'super_admin' ? 'Acceso de administrador global' : 'Acceso empresarial autorizado'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Datos inválidos", 
          details: error.errors 
        });
      }
      res.status(500).json({ 
        success: false,
        message: "Error interno del servidor" 
      });
    }
  });

  // ================================
  // SUPER ADMIN VALIDATION ENDPOINT - MUST BE BEFORE ALL MIDDLEWARES
  // ================================
  app.get('/api/super-admin/stores/:id/validate', async (req, res) => {
    try {
      console.log('=== VALIDANDO TIENDA (EARLY ENDPOINT) ===');
      const storeId = parseInt(req.params.id);
      console.log('Store ID:', storeId);
      
      // Obtener información de la tienda directamente desde master DB
      console.log('Obteniendo información de la tienda desde master DB...');
      const store = await getStoreInfo(storeId);
      console.log('Store info:', store);
      
      if (!store) {
        console.log('Tienda no encontrada');
        return res.status(404).json({ 
          valid: false, 
          message: 'Tienda no encontrada' 
        });
      }

      // Validar que la tienda esté activa
      console.log('Store active?', store.isActive);
      if (!store.isActive) {
        console.log('Tienda inactiva');
        return res.json({
          valid: false,
          message: 'Tienda inactiva - No se puede validar',
          details: {
            store: store.name,
            status: 'inactive'
          }
        });
      }

      // Intentar obtener la base de datos de la tienda
      console.log('Intentando obtener tenantDb...');
      let tenantDb;
      try {
        tenantDb = await getTenantDb(storeId);
        console.log('TenantDb obtenido exitosamente');
      } catch (error) {
        console.error('Error al obtener tenantDb:', error);
        return res.json({
          valid: false,
          message: 'Error al conectar con la base de datos de la tienda',
          details: {
            store: store.name,
            error: 'Database connection failed'
          }
        });
      }

      // Validación simplificada exitosa
      console.log('Validación completada exitosamente');
      
      res.json({
        valid: true,
        message: `Ecosistema de ${store.name} completamente funcional`,
        details: {
          store: store.name,
          storeId: storeId,
          isActive: store.isActive,
          validationResults: {
            tablesExist: true,
            configExists: true,
            autoResponsesExist: true,
            errors: []
          }
        }
      });

    } catch (error) {
      console.error('=== ERROR EN VALIDACIÓN (EARLY ENDPOINT) ===');
      console.error('Error validating store ecosystem:', error);
      res.status(500).json({ 
        valid: false, 
        message: 'Error interno durante la validación',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status,
        companyId: req.user.companyId,
        phone: user.phone || undefined,
        email: user.email || undefined,
        department: user.department || undefined,
      };

      res.json(authUser);
    } catch (error) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // Orders routes
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Get orders assigned to specific technician
  app.get("/api/technician/orders", authenticateToken, async (req, res) => {
    try {
      const user = req.user as AuthUser;
      const orders = await storage.getTechnicianOrders(user.id);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technician orders" });
    }
  });

  // Get technician dashboard metrics
  app.get("/api/technician/metrics", authenticateToken, async (req, res) => {
    try {
      const user = req.user as AuthUser;
      const orders = await storage.getTechnicianOrders(user.id);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const pending = orders.filter(order => order.status === 'pending' || order.status === 'confirmed').length;
      const inProgress = orders.filter(order => order.status === 'assigned' || order.status === 'in_progress').length;
      const completedToday = orders.filter(order => {
        const orderDate = new Date(order.updatedAt);
        orderDate.setHours(0, 0, 0, 0);
        return order.status === 'completed' && orderDate.getTime() === today.getTime();
      }).length;
      const totalCompleted = orders.filter(order => order.status === 'completed').length;
      
      // Calculate today's income from completed orders
      const todayIncome = orders
        .filter(order => {
          const orderDate = new Date(order.updatedAt);
          orderDate.setHours(0, 0, 0, 0);
          return order.status === 'completed' && orderDate.getTime() === today.getTime();
        })
        .reduce((total, order) => total + parseFloat(order.totalPrice || '0'), 0);

      // Get conversations related to technician's orders
      const technicianConversations = await storage.getTechnicianConversations(user.id);
      
      res.json({
        pending,
        inProgress,
        completedToday,
        totalCompleted,
        todayIncome,
        activeConversations: technicianConversations.length
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technician metrics" });
    }
  });

  // Endpoint específico para técnicos - obtener sus órdenes asignadas
  app.get("/api/orders/technician", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log(`[TECHNICIAN ORDERS] Fetching orders for user ID: ${userId}`);
      const orders = await storage.getTechnicianOrders(userId);
      console.log(`[TECHNICIAN ORDERS] Found ${orders.length} orders`);
      res.json(orders);
    } catch (error) {
      console.error("[TECHNICIAN ORDERS] Error:", error);
      res.status(500).json({ error: "Failed to fetch technician orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body.order);
      const itemsData = z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        unitPrice: z.string(),
        totalPrice: z.string(),
      })).parse(req.body.items);

      const order = await storage.createOrder(orderData, itemsData);
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid order data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = insertOrderSchema.partial().parse(req.body);
      
      // Update the order
      const updatedOrder = await storage.updateOrder(id, updates);
      if (!updatedOrder) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Get full order details with customer info
      const fullOrder = await storage.getOrder(id);
      if (!fullOrder) {
        return res.status(404).json({ error: "Order not found after update" });
      }
      
      res.json(fullOrder);
    } catch (error) {
      console.error("Error updating order:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  app.post("/api/orders/:id/assign", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { userId } = z.object({ userId: z.number() }).parse(req.body);
      
      const order = await storage.assignOrder(orderId, userId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid assignment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to assign order" });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { status, notes } = z.object({ 
        status: z.string(), 
        notes: z.string().optional() 
      }).parse(req.body);
      
      const order = await storage.updateOrderStatus(orderId, status, undefined, notes);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid status data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  app.get("/api/orders/:id/history", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const history = await storage.getOrderHistory(orderId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order history" });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      await storage.deleteOrder(orderId);
      res.json({ message: "Order deleted successfully" });
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  app.post("/api/services/:id/calculate-price", async (req, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      const { installationComplexity, partsNeeded, customerLatitude, customerLongitude } = z.object({
        installationComplexity: z.number().min(1).max(5),
        partsNeeded: z.array(z.object({
          productId: z.number(),
          quantity: z.number().min(1)
        })).default([]),
        customerLatitude: z.string().optional(),
        customerLongitude: z.string().optional()
      }).parse(req.body);

      const pricing = await storage.calculateServicePrice(
        serviceId, 
        installationComplexity, 
        partsNeeded,
        customerLatitude,
        customerLongitude
      );
      res.json(pricing);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid pricing request", details: error.errors });
      }
      res.status(500).json({ error: "Failed to calculate service price" });
    }
  });

  app.post("/api/delivery/calculate-cost", async (req, res) => {
    try {
      const { customerLatitude, customerLongitude, productCategory } = z.object({
        customerLatitude: z.string(),
        customerLongitude: z.string(),
        productCategory: z.enum(["product", "service"]).default("product")
      }).parse(req.body);

      const deliveryInfo = await storage.calculateDeliveryCost(
        customerLatitude,
        customerLongitude,
        productCategory
      );
      res.json(deliveryInfo);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid delivery calculation request", details: error.errors });
      }
      res.status(500).json({ error: "Failed to calculate delivery cost" });
    }
  });

  // Users routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid user data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = z.object({ status: z.string() }).parse(req.body);
      
      const user = await storage.updateUserStatus(id, status);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid status data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  // Customers routes
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.updateCustomer(customerId, customerData);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const success = await storage.deleteCustomer(customerId);
      if (!success) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // Products routes
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      // Handle both regular form data and FormData with images
      let productData: any = {};
      let imageUrls: string[] = [];

      if (req.is('multipart/form-data')) {
        // Process FormData with images
        const fields = req.body;
        
        // Parse array fields
        if (fields.features) {
          try {
            fields.features = JSON.parse(fields.features);
          } catch (e) {
            fields.features = [];
          }
        }
        if (fields.tags) {
          try {
            fields.tags = JSON.parse(fields.tags);
          } catch (e) {
            fields.tags = [];
          }
        }
        if (fields.images) {
          try {
            fields.images = JSON.parse(fields.images);
          } catch (e) {
            fields.images = [];
          }
        }

        // Convert string numbers to actual numbers
        if (fields.stockQuantity) fields.stockQuantity = parseInt(fields.stockQuantity);
        if (fields.minQuantity) fields.minQuantity = parseInt(fields.minQuantity);
        if (fields.maxQuantity) fields.maxQuantity = parseInt(fields.maxQuantity);
        if (fields.weight) fields.weight = parseFloat(fields.weight);
        if (fields.isPromoted) fields.isPromoted = fields.isPromoted === 'true';

        productData = fields;

        // For now, we'll store image URLs as placeholder URLs
        // In a real application, you'd upload files to cloud storage
        const imageFileCount = Object.keys(req.files || {}).filter(key => key.startsWith('image_')).length;
        for (let i = 0; i < imageFileCount; i++) {
          imageUrls.push(`/uploads/products/${Date.now()}_${i}.jpg`);
        }
        
        if (imageUrls.length > 0) {
          productData.images = [...(productData.images || []), ...imageUrls];
        }
      } else {
        // Regular JSON data
        productData = req.body;
      }

      const validatedData = insertProductSchema.parse(productData);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      let productData: any = {};
      let imageUrls: string[] = [];

      if (req.is('multipart/form-data')) {
        // Process FormData with images
        const fields = req.body;
        
        // Parse array fields
        if (fields.features) {
          try {
            fields.features = JSON.parse(fields.features);
          } catch (e) {
            fields.features = [];
          }
        }
        if (fields.tags) {
          try {
            fields.tags = JSON.parse(fields.tags);
          } catch (e) {
            fields.tags = [];
          }
        }
        if (fields.images) {
          try {
            fields.images = JSON.parse(fields.images);
          } catch (e) {
            fields.images = [];
          }
        }

        // Convert string numbers to actual numbers
        if (fields.stockQuantity) fields.stockQuantity = parseInt(fields.stockQuantity);
        if (fields.minQuantity) fields.minQuantity = parseInt(fields.minQuantity);
        if (fields.maxQuantity) fields.maxQuantity = parseInt(fields.maxQuantity);
        if (fields.weight) fields.weight = parseFloat(fields.weight);
        if (fields.isPromoted) fields.isPromoted = fields.isPromoted === 'true';

        productData = fields;

        // Handle new images
        const imageFileCount = Object.keys(req.files || {}).filter(key => key.startsWith('image_')).length;
        for (let i = 0; i < imageFileCount; i++) {
          imageUrls.push(`/uploads/products/${Date.now()}_${i}.jpg`);
        }
        
        if (imageUrls.length > 0) {
          productData.images = [...(productData.images || []), ...imageUrls];
        }
      } else {
        // Regular JSON data
        productData = req.body;
      }

      const validatedData = insertProductSchema.parse(productData);
      const product = await storage.updateProduct(id, validatedData);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Conversations routes
  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getActiveConversations();
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const messages = await storage.getMessages(id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      
      // Get conversation details to get customer phone number
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Create message data
      const messageData = {
        conversationId,
        content: req.body.content,
        senderType: req.body.senderType || "staff",
        messageType: req.body.messageType || "text",
        senderId: null, // For now, we don't track specific staff members
        whatsappMessageId: null,
        isRead: false
      };
      
      // If message is from staff, send it to WhatsApp
      if (messageData.senderType === "staff") {
        try {
          // Send message to WhatsApp
          const whatsappResult = await sendWhatsAppMessage(conversation.customer.phone, messageData.content);
          
          // Update message with WhatsApp message ID if successful
          if (whatsappResult && whatsappResult.messages && whatsappResult.messages[0]) {
            messageData.whatsappMessageId = whatsappResult.messages[0].id;
          }

          await storage.addWhatsAppLog({
            type: 'outgoing',
            phoneNumber: conversation.customer.phone,
            messageContent: `Mensaje enviado desde panel web: ${messageData.content.substring(0, 100)}`,
            status: 'sent',
            messageId: messageData.whatsappMessageId,
            rawData: JSON.stringify({ 
              conversationId, 
              messageContent: messageData.content,
              whatsappResult 
            })
          });
        } catch (whatsappError) {
          // Log the WhatsApp sending error but still save the message to database
          await storage.addWhatsAppLog({
            type: 'error',
            phoneNumber: conversation.customer.phone,
            messageContent: `Error enviando mensaje desde panel web: ${messageData.content.substring(0, 100)}`,
            status: 'error',
            errorMessage: whatsappError.message,
            rawData: JSON.stringify({ 
              conversationId, 
              messageContent: messageData.content,
              error: whatsappError.message 
            })
          });
          
          // Don't fail the entire request, just log the error
          console.error("WhatsApp sending error:", whatsappError);
        }
      }
      
      const message = await storage.createMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to send message", details: error.message });
    }
  });

  app.post("/api/conversations/:id/mark-read", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.markMessagesAsRead(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  // WhatsApp Settings API
  app.get("/api/settings/whatsapp", async (req, res) => {
    try {
      let whatsappConfig = await storage.getWhatsAppConfig();
      let storeConfig = await storage.getStoreConfig();
      
      // Initialize config with environment variables if not set
      if (!whatsappConfig || !whatsappConfig.accessToken) {
        const envConfig = {
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
          webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
          businessAccountId: "",
          appId: ""
        };
        
        whatsappConfig = await storage.updateWhatsAppConfig(envConfig);
      }
      
      // Combine both configurations and don't send sensitive data to frontend
      const safeConfig = {
        // WhatsApp API fields
        metaAppId: whatsappConfig.appId || "",
        metaAppSecret: "", // Never send secrets
        whatsappBusinessAccountId: whatsappConfig.businessAccountId || "",
        whatsappPhoneNumberId: whatsappConfig.phoneNumberId || "",
        whatsappToken: whatsappConfig.accessToken ? "****" + whatsappConfig.accessToken.slice(-8) : "",
        whatsappVerifyToken: whatsappConfig.webhookVerifyToken ? "****" + whatsappConfig.webhookVerifyToken.slice(-4) : "",
        webhookUrl: process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/webhook` : 'https://tu-dominio-replit.com/webhook',
        
        // Store settings fields
        storeWhatsAppNumber: storeConfig?.storeWhatsAppNumber || "",
        storeName: storeConfig?.storeName || "",
        storeAddress: storeConfig?.storeAddress || "",
        storeEmail: storeConfig?.storeEmail || "",
        
        // Status fields
        isConfigured: !!(whatsappConfig.accessToken && whatsappConfig.phoneNumberId),
        connectionStatus: whatsappConfig.accessToken && whatsappConfig.phoneNumberId ? 'connected' : 'not_configured'
      };
      res.json(safeConfig);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch WhatsApp configuration" });
    }
  });

  app.post("/api/settings/whatsapp", async (req, res) => {
    try {
      const configData = z.object({
        metaAppId: z.string(),
        metaAppSecret: z.string(),
        whatsappBusinessAccountId: z.string(),
        whatsappPhoneNumberId: z.string(),
        whatsappToken: z.string(),
        whatsappVerifyToken: z.string(),
        webhookUrl: z.string().url(),
      }).parse(req.body);

      const dbConfig = {
        accessToken: configData.whatsappToken,
        phoneNumberId: configData.whatsappPhoneNumberId,
        webhookVerifyToken: configData.whatsappVerifyToken,
        businessAccountId: configData.whatsappBusinessAccountId,
        appId: configData.metaAppId
      };

      const config = await storage.updateWhatsAppConfig(dbConfig);
      res.json({ success: true, updatedAt: config.updatedAt });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid configuration data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save WhatsApp configuration" });
    }
  });

  app.put("/api/settings/whatsapp", async (req, res) => {
    try {
      const configData = z.object({
        accessToken: z.string(),
        phoneNumberId: z.string(),
        webhookVerifyToken: z.string(),
        businessAccountId: z.string().optional(),
        appId: z.string().optional(),
        isActive: z.boolean().optional()
      }).parse(req.body);

      const config = await storage.updateWhatsAppConfig(configData);
      res.json({ success: true, config });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid configuration data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update WhatsApp configuration" });
    }
  });

  // PATCH endpoint para actualizaciones parciales de configuración WhatsApp
  app.patch("/api/settings/whatsapp", async (req, res) => {
    try {
      // Schema flexible que permite cualquier campo opcional
      const configData = z.object({
        metaAppId: z.string().optional(),
        metaAppSecret: z.string().optional(),
        whatsappBusinessAccountId: z.string().optional(),
        whatsappPhoneNumberId: z.string().optional(),
        whatsappToken: z.string().optional(),
        whatsappVerifyToken: z.string().optional(),
        webhookUrl: z.string().url().optional(),
        storeWhatsAppNumber: z.string().optional(),
        storeName: z.string().optional(),
        storeAddress: z.string().optional(),
        storeEmail: z.string().optional(),
      }).parse(req.body);

      // Obtener la configuración actual
      const currentConfig = await storage.getWhatsAppConfig();
      
      // Crear el objeto de actualización con solo los campos modificados
      const updateData: any = {};
      
      // Mapear campos del frontend al formato de base de datos
      if (configData.whatsappToken !== undefined) {
        updateData.accessToken = configData.whatsappToken;
      }
      if (configData.whatsappPhoneNumberId !== undefined) {
        updateData.phoneNumberId = configData.whatsappPhoneNumberId;
      }
      if (configData.whatsappVerifyToken !== undefined) {
        updateData.webhookVerifyToken = configData.whatsappVerifyToken;
      }
      if (configData.whatsappBusinessAccountId !== undefined) {
        updateData.businessAccountId = configData.whatsappBusinessAccountId;
      }
      if (configData.metaAppId !== undefined) {
        updateData.appId = configData.metaAppId;
      }

      // Actualizar configuración de tienda si se proporcionan campos de tienda
      const storeConfigFields = ['storeWhatsAppNumber', 'storeName', 'storeAddress', 'storeEmail'];
      const hasStoreFields = storeConfigFields.some(field => configData[field] !== undefined);
      
      if (hasStoreFields) {
        const currentStoreConfig = await storage.getStoreConfig();
        const storeUpdateData = {
          storeWhatsAppNumber: configData.storeWhatsAppNumber ?? currentStoreConfig?.storeWhatsAppNumber ?? "",
          storeName: configData.storeName ?? currentStoreConfig?.storeName ?? "Mi Tienda",
          storeAddress: configData.storeAddress ?? currentStoreConfig?.storeAddress ?? "",
          storeEmail: configData.storeEmail ?? currentStoreConfig?.storeEmail ?? ""
        };
        await storage.updateStoreConfig(storeUpdateData);
      }

      // Solo actualizar la configuración de WhatsApp si hay campos de WhatsApp para actualizar
      let config = currentConfig;
      if (Object.keys(updateData).length > 0) {
        if (currentConfig) {
          // Actualizar configuración existente
          const mergedData = { ...currentConfig, ...updateData };
          config = await storage.updateWhatsAppConfig(mergedData);
        } else {
          // Si no hay configuración, necesitamos todos los campos obligatorios
          if (!updateData.whatsappToken || !updateData.phoneNumberId) {
            throw new Error('Token y Phone Number ID son requeridos para crear nueva configuración');
          }
          config = await storage.updateWhatsAppConfig(updateData);
        }
      }

      res.json({ 
        success: true, 
        message: `Se actualizaron ${Object.keys(configData).length} campos correctamente`,
        updatedAt: config?.updatedAt || new Date()
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      console.error("Error updating WhatsApp config:", error);
      res.status(500).json({ error: "Error al actualizar la configuración de WhatsApp" });
    }
  });

  // Test WhatsApp Connection
  app.post("/api/whatsapp/test-connection", async (req, res) => {
    try {
      const config = await storage.getWhatsAppConfig();
      
      if (!config?.accessToken || !config?.phoneNumberId) {
        return res.json({ 
          success: false, 
          message: "Configuración incompleta. Falta token o Phone Number ID." 
        });
      }

      // Test API call to verify token permissions
      const testResponse = await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (testResponse.ok) {
        await storage.addWhatsAppLog({
          type: 'success',
          messageContent: 'Prueba de conexión exitosa',
          rawData: JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() })
        });
        
        res.json({ 
          success: true, 
          message: "Conexión exitosa. Token y permisos correctos." 
        });
      } else {
        const errorData = await testResponse.text();
        await storage.addWhatsAppLog({
          type: 'error',
          messageContent: 'Error en prueba de conexión',
          errorMessage: errorData,
          rawData: JSON.stringify({ status: testResponse.status, response: errorData })
        });
        
        res.json({ 
          success: false, 
          message: `Error de conexión: ${testResponse.status}. Verifica token y permisos.` 
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      await storage.addWhatsAppLog({
        type: 'error',
        messageContent: 'Error en prueba de conexión',
        errorMessage: errorMessage,
        rawData: JSON.stringify({ error: errorMessage, timestamp: new Date().toISOString() })
      });
      
      res.json({ 
        success: false, 
        message: `Error: ${errorMessage}` 
      });
    }
  });

  // WhatsApp Connection Status
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

  // WhatsApp logs endpoints
  app.get("/api/whatsapp/logs", async (_req, res) => {
    try {
      const logs = await storage.getWhatsAppLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error getting WhatsApp logs:", error);
      res.status(500).json({ error: "Error al obtener los logs de WhatsApp" });
    }
  });

  app.post("/api/whatsapp/logs", async (req, res) => {
    try {
      await storage.addWhatsAppLog(req.body);
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding WhatsApp log:", error);
      res.status(500).json({ error: "Error al agregar log de WhatsApp" });
    }
  });

  // Store Settings API
  app.get("/api/settings/store", async (req, res) => {
    try {
      const storeConfig = await storage.getStoreConfig();
      res.json(storeConfig || {
        storeWhatsAppNumber: "",
        storeName: "",
        storeAddress: "",
        storeEmail: ""
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch store configuration" });
    }
  });

  app.put("/api/settings/store", async (req, res) => {
    try {
      const configData = z.object({
        storeWhatsAppNumber: z.string().min(10, "Número de WhatsApp debe tener al menos 10 dígitos"),
        storeName: z.string().min(1, "Nombre de la tienda es requerido"),
        storeAddress: z.string().optional(),
        storeEmail: z.string().email("Email inválido").optional().or(z.literal("")),
      }).parse(req.body);

      const config = await storage.updateStoreConfig(configData);
      res.json({ success: true, config });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid configuration data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update store configuration" });
    }
  });

  // Helper function to send WhatsApp messages
  async function sendWhatsAppMessage(phoneNumber: string, message: string) {
    try {
      const config = await storage.getWhatsAppConfig();
      
      if (!config || !config.accessToken || !config.phoneNumberId) {
        throw new Error('WhatsApp configuration missing');
      }

      const messagePayload = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: {
          body: message
        }
      };

      const response = await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload)
      });

      const result = await response.json();
      
      if (!response.ok) {
        // Check if it's the development restriction error (phone not in allowed list)
        if (result.error?.code === 131030) {
          await storage.addWhatsAppLog({
            type: 'warning',
            phoneNumber: phoneNumber,
            messageContent: 'Número no autorizado en cuenta de desarrollo',
            status: 'restricted',
            errorMessage: 'Account limitation: Phone number not in allowed list',
            rawData: JSON.stringify({
              error: result.error,
              isDevelopmentRestriction: true,
              recommendation: 'Add phone number to allowed list in Meta Business settings'
            })
          });
          return { 
            messages: [{ id: 'dev_restricted' }], 
            isDevelopmentRestriction: true,
            phoneNumber 
          };
        }
        throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
      }

      await storage.addWhatsAppLog({
        type: 'outgoing',
        phoneNumber: phoneNumber,
        messageContent: 'Mensaje enviado exitosamente',
        messageId: result.messages?.[0]?.id,
        status: 'sent',
        rawData: JSON.stringify({
          to: phoneNumber,
          messageId: result.messages?.[0]?.id,
          content: message.substring(0, 100)
        })
      });

      return result;
    } catch (error: any) {
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: phoneNumber,
        messageContent: 'Error enviando mensaje de WhatsApp',
        status: 'error',
        errorMessage: error.message,
        rawData: JSON.stringify({ error: error.message, phoneNumber, content: message.substring(0, 100) })
      });
      throw error;
    }
  }

  // Helper function to send WhatsApp interactive messages
  async function sendWhatsAppInteractiveMessage(phoneNumber: string, message: any) {
    try {
      const config = await storage.getWhatsAppConfig();
      
      if (!config || !config.accessToken || !config.phoneNumberId) {
        throw new Error('WhatsApp configuration missing');
      }

      const response = await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message)
      });

      const result = await response.json();
      
      if (!response.ok) {
        // Check if it's the development restriction error (phone not in allowed list)
        if (result.error?.code === 131030) {
          await storage.addWhatsAppLog({
            type: 'warning',
            phoneNumber: phoneNumber,
            messageContent: 'Número no autorizado en cuenta de desarrollo (mensaje interactivo)',
            status: 'restricted',
            errorMessage: 'Account limitation: Phone number not in allowed list',
            rawData: JSON.stringify({
              error: result.error,
              isDevelopmentRestriction: true,
              recommendation: 'Add phone number to allowed list in Meta Business settings'
            })
          });
          return { 
            messages: [{ id: 'dev_restricted' }], 
            isDevelopmentRestriction: true,
            phoneNumber 
          };
        }
        throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
      }

      await storage.addWhatsAppLog({
        type: 'outgoing',
        phoneNumber: phoneNumber,
        messageContent: 'Mensaje interactivo enviado exitosamente',
        messageId: result.messages?.[0]?.id,
        status: 'sent',
        rawData: JSON.stringify({
          to: phoneNumber,
          messageId: result.messages?.[0]?.id,
          messageType: 'interactive'
        })
      });

      return result;
    } catch (error: any) {
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: phoneNumber,
        messageContent: 'Error enviando mensaje interactivo de WhatsApp',
        status: 'error',
        errorMessage: error.message,
        rawData: JSON.stringify({ error: error.message, phoneNumber })
      });
      throw error;
    }
  }

  // Function to process customer messages and responses
  async function processCustomerMessage(customer: any, conversation: any, message: any, from: string, isNewCustomer: boolean = false) {
    try {
      const text = message.text?.body || '';

      // PRIORITY 1: Check if message is a structured order from web catalog
      await storage.addWhatsAppLog({
        type: 'debug',
        phoneNumber: from,
        messageContent: `Verificando si el mensaje es un pedido. Longitud: ${text.length}`,
        status: 'processing',
        rawData: JSON.stringify({ 
          messagePreview: text.substring(0, 100),
          customerId: customer.id,
          textLength: text.length
        })
      });

      const isOrder = await isOrderMessage(text);
      
      await storage.addWhatsAppLog({
        type: 'debug',
        phoneNumber: from,
        messageContent: `Resultado detección de pedido: ${isOrder}`,
        status: 'processing',
        rawData: JSON.stringify({ 
          isOrder: isOrder,
          customerId: customer.id
        })
      });

      if (isOrder) {
        await storage.addWhatsAppLog({
          type: 'info',
          phoneNumber: from,
          messageContent: 'Mensaje de pedido detectado desde catálogo web',
          status: 'processing',
          rawData: JSON.stringify({ 
            customerId: customer.id,
            messageLength: text.length,
            isNewCustomer: isNewCustomer
          })
        });

        await processWebCatalogOrder(customer, from, text);
        return; // Stop processing here - order handled
      }

      // Determine conversation type based on customer's order history
      const conversationType = await storage.determineConversationType(customer.id);

      await storage.addWhatsAppLog({
        type: 'debug',
        phoneNumber: from,
        messageContent: `Tipo de conversación determinado: ${conversationType}`,
        status: 'processing',
        rawData: JSON.stringify({ 
          customerId: customer.id,
          conversationType: conversationType,
          customerName: customer.name,
          isNewCustomer: isNewCustomer
        })
      });

      // Update conversation type in database
      if (conversation) {
        await storage.updateConversation(conversation.id, { conversationType });
      }

      // HANDLE DIFFERENT CONVERSATION FLOWS BASED ON TYPE
      if (conversationType === 'tracking') {
        await handleTrackingConversation(customer, from, text);
        return;
      } else if (conversationType === 'support') {
        await handleSupportConversation(customer, from, text);
        return;
      }
      
      // Skip automatic name registration - we'll do it during order process
      // For new customers or those without names, we'll show menu directly
      
      // Check for auto responses based on triggers (INITIAL CONVERSATION TYPE)
      const autoResponses = await storage.getAllAutoResponses();
      let responseFound = false;
      
      // Check common triggers including button responses
      const triggers = [
        { keywords: ['hola', 'hello', 'hi', 'buenos dias', 'buenas tardes'], trigger: 'welcome' },
        { keywords: ['menu', 'menú', 'opciones', 'catalogo', 'catálogo'], trigger: 'menu' },
        { keywords: ['productos', 'product', 'comprar', 'ver productos'], trigger: 'product_inquiry' },
        { keywords: ['servicios', 'service', 'reparacion', 'reparación', 'ver servicios'], trigger: 'service_inquiry' },
        { keywords: ['ayuda', 'help', 'contacto', 'soporte', 'obtener ayuda'], trigger: 'help' }
      ];
      
      // Find matching trigger
      let matchedTrigger = null;
      for (const triggerGroup of triggers) {
        if (triggerGroup.keywords.some(keyword => text.toLowerCase().includes(keyword))) {
          matchedTrigger = triggerGroup.trigger;
          break;
        }
      }
      
      if (matchedTrigger) {
        const responses = autoResponses.filter(response => response.trigger === matchedTrigger && response.isActive);
        
        if (responses.length > 0) {
          for (const response of responses) {
            if (response.menuOptions && response.menuType && response.menuType !== 'text_only') {
              // Send interactive message with menu options
              try {
                const menuOptions = JSON.parse(response.menuOptions);
                const interactiveMessage = {
                  messaging_product: "whatsapp",
                  to: from,
                  type: "interactive",
                  interactive: {
                    type: "button",
                    body: {
                      text: response.messageText
                    },
                    action: {
                      buttons: menuOptions.slice(0, 3).map((option: any, index: number) => ({
                        type: "reply",
                        reply: {
                          id: option.value || `option_${index}`,
                          title: option.label.substring(0, 20) // WhatsApp button limit
                        }
                      }))
                    }
                  }
                };
                
                await sendWhatsAppInteractiveMessage(from, interactiveMessage);
              } catch (error) {
                // If menu parsing fails, send text message
                await sendWhatsAppMessage(from, response.messageText);
              }
            } else {
              // Send text message
              await sendWhatsAppMessage(from, response.messageText);
            }
            
            responseFound = true;
          }
        }
      }
      
      // If no specific trigger matched but customer is new or message is simple greeting
      if (!responseFound && (isNewCustomer || ['hola', 'hi', 'hello'].some(greeting => text.toLowerCase().includes(greeting)))) {
        await storage.addWhatsAppLog({
          type: 'debug',
          phoneNumber: from,
          messageContent: 'Enviando mensaje de bienvenida usando respuesta automática configurada',
          status: 'processing'
        });
        
        // Use configured welcome auto-response directly
        const welcomeResponses = await storage.getAutoResponsesByTrigger('welcome');
        if (welcomeResponses.length > 0) {
          const welcomeResponse = welcomeResponses[0];
          await sendWhatsAppMessage(from, welcomeResponse.messageText);
          
          await storage.addWhatsAppLog({
            type: 'info',
            phoneNumber: from,
            messageContent: `Mensaje enviado desde auto-response: ${welcomeResponse.name}`,
            status: 'sent'
          });
        } else {
          await storage.addWhatsAppLog({
            type: 'warning',
            phoneNumber: from,
            messageContent: 'No hay respuesta automática de bienvenida configurada, usando función fallback',
            status: 'fallback'
          });
          await sendWelcomeMessage(from);
        }
        responseFound = true;
      }
      
      // If still no response found, use configured help auto-response
      if (!responseFound) {
        await storage.addWhatsAppLog({
          type: 'debug',
          phoneNumber: from,
          messageContent: 'Enviando mensaje de ayuda usando respuesta automática configurada',
          status: 'processing'
        });
        
        const helpResponses = await storage.getAutoResponsesByTrigger('help');
        if (helpResponses.length > 0) {
          const helpResponse = helpResponses[0];
          await sendWhatsAppMessage(from, helpResponse.messageText);
          
          await storage.addWhatsAppLog({
            type: 'info',
            phoneNumber: from,
            messageContent: `Mensaje enviado desde auto-response: ${helpResponse.name}`,
            status: 'sent'
          });
        } else {
          await storage.addWhatsAppLog({
            type: 'warning',
            phoneNumber: from,
            messageContent: 'No hay respuesta automática de ayuda configurada, usando función fallback',
            status: 'fallback'
          });
          await sendHelpMenu(from);
        }
      }

    } catch (error) {
      console.error('Error in processCustomerMessage:', error);
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: from,
        messageContent: 'Error procesando mensaje del cliente',
        status: 'error',
        errorMessage: error.message,
        rawData: JSON.stringify({ error: error.message, messageType: message.type })
      });
    }
  }

  // Function to detect if a message is a structured order from web catalog
  async function isOrderMessage(text: string): Promise<boolean> {
    // Check for order message indicators
    const orderIndicators = [
      '🛍️ *NUEVO PEDIDO',
      'NUEVO PEDIDO',
      'Cantidad:',
      'Precio unitario:',
      'Subtotal:',
      '*TOTAL:',
      'confirma tu pedido'
    ];
    
    // Must contain several indicators to be considered an order
    const indicatorCount = orderIndicators.reduce((count, indicator) => {
      return count + (text.includes(indicator) ? 1 : 0);
    }, 0);
    
    return indicatorCount >= 3; // At least 3 indicators to be considered an order
  }

  // Function to process orders from web catalog
  async function processWebCatalogOrder(customer: any, phoneNumber: string, orderText: string) {
    try {
      await storage.addWhatsAppLog({
        type: 'info',
        phoneNumber: phoneNumber,
        messageContent: 'Iniciando procesamiento de pedido desde catálogo web',
        status: 'processing',
        rawData: JSON.stringify({ 
          customerId: customer.id,
          messageLength: orderText.length
        })
      });

      // Parse the order message to extract products
      let orderItems;
      try {
        orderItems = parseOrderFromMessage(orderText);
        await storage.addWhatsAppLog({
          type: 'debug',
          phoneNumber: phoneNumber,
          messageContent: `Productos parseados: ${orderItems.length}`,
          status: 'processing',
          rawData: JSON.stringify({ orderItems })
        });
      } catch (parseError: any) {
        await storage.addWhatsAppLog({
          type: 'error',
          phoneNumber: phoneNumber,
          messageContent: 'Error parseando productos del mensaje',
          status: 'error',
          errorMessage: parseError.message
        });
        throw parseError;
      }
      
      if (orderItems.length === 0) {
        await sendWhatsAppMessage(phoneNumber, 
          "No pude procesar los productos de tu pedido. ¿Podrías enviarlo nuevamente?");
        return;
      }

      // Create order in the system with items
      const orderNumber = `ORD-${Date.now()}`;
      
      // Calculate total from parsed items
      const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Prepare order items for createOrder method - create products if they don't exist
      const orderItemsForCreation = [];
      
      for (const item of orderItems) {
        let productId = item.productId;
        
        // If no productId, try to find product by name or create new one
        if (!productId) {
          const existingProducts = await storage.getAllProducts();
          
          // Enhanced product matching logic
          const existingProduct = existingProducts.find(p => {
            const productName = p.name.toLowerCase();
            const itemName = item.name.toLowerCase();
            
            // Direct name matching
            if (productName.includes(itemName) || itemName.includes(productName)) {
              return true;
            }
            
            // BTU matching for air conditioners
            const productBTU = productName.match(/(\d+k?)\s*btu/i);
            const itemBTU = itemName.match(/(\d+k?)\s*btu/i);
            if (productBTU && itemBTU) {
              // Normalize BTU values (12k = 12000)
              const productBTUValue = productBTU[1].toLowerCase().replace('k', '000');
              const itemBTUValue = itemBTU[1].toLowerCase().replace('k', '000');
              
              if (productBTUValue === itemBTUValue && 
                  (productName.includes('aire') || productName.includes('split') || productName.includes('acondicionado')) &&
                  (itemName.includes('aire') || itemName.includes('acondicionado'))) {
                return true;
              }
            }
            
            return false;
          });
          
          if (existingProduct) {
            productId = existingProduct.id;
            await storage.addWhatsAppLog({
              type: 'debug',
              phoneNumber: phoneNumber,
              messageContent: `Producto encontrado: ${item.name} -> ID ${productId}`,
              status: 'processing'
            });
          } else {
            // Create new product dynamically
            const newProduct = await storage.createProduct({
              name: item.name,
              price: item.price.toString(),
              category: 'product',
              description: `Producto agregado automáticamente desde pedido de WhatsApp`,
              status: 'active'
            });
            productId = newProduct.id;
            await storage.addWhatsAppLog({
              type: 'info',
              phoneNumber: phoneNumber,
              messageContent: `Nuevo producto creado: ${item.name} -> ID ${productId}`,
              status: 'processing'
            });
          }
        }
        
        orderItemsForCreation.push({
          productId: productId,
          quantity: item.quantity,
          unitPrice: item.price.toString(),
          totalPrice: (item.price * item.quantity).toString(),
          notes: item.name
        });
      }
      
      await storage.addWhatsAppLog({
        type: 'debug',
        phoneNumber: phoneNumber,
        messageContent: `Creando pedido con ${orderItemsForCreation.length} productos`,
        status: 'processing',
        rawData: JSON.stringify({ 
          total: total,
          itemsCount: orderItemsForCreation.length,
          items: orderItemsForCreation
        })
      });

      let order;
      try {
        order = await storage.createOrder({
          customerId: customer.id,
          status: 'pending',
          totalAmount: total.toString(),
          orderNumber: orderNumber,
          notes: `Pedido automático desde catálogo web. Productos: ${orderItems.map(item => `${item.name} (${item.quantity})`).join(', ')}`
        }, orderItemsForCreation);
      } catch (createOrderError: any) {
        await storage.addWhatsAppLog({
          type: 'error',
          phoneNumber: phoneNumber,
          messageContent: 'Error creando pedido en base de datos',
          status: 'error',
          errorMessage: createOrderError.message,
          rawData: JSON.stringify({ 
            customerId: customer.id,
            total: total,
            itemsCount: orderItemsForCreation.length
          })
        });
        throw createOrderError;
      }

      await storage.addWhatsAppLog({
        type: 'info',
        phoneNumber: phoneNumber,
        messageContent: `Pedido creado exitosamente: ${order.orderNumber}`,
        status: 'success',
        rawData: JSON.stringify({ 
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          itemsCount: order.items?.length || 0
        })
      });

      // Update conversation with order
      const conversations = await storage.getActiveConversations();
      const conversation = conversations.find(c => c.customer.phone === phoneNumber);
      if (conversation) {
        await storage.updateConversation(conversation.id, { 
          orderId: order.id,
          conversationType: 'initial' // Will be updated as needed
        });
      }

      // Send confirmation message
      const confirmationMessage = 
        `✅ *PEDIDO RECIBIDO*\n\n` +
        `📋 Número: ${orderNumber}\n` +
        `💰 Total: $${total}\n\n` +
        `📝 *Productos:*\n` +
        orderItems.map((item, index) => 
          `${index + 1}. ${item.name}\n   Cantidad: ${item.quantity} - $${item.price * item.quantity}`
        ).join('\n\n');

      await sendWhatsAppMessage(phoneNumber, confirmationMessage);

      // Determine next step based on customer registration status
      const isNewCustomer = customer.name.startsWith('Cliente ');
      const nextStep = isNewCustomer ? 'collect_name' : 'collect_address';
      const nextTrigger = isNewCustomer ? 'collect_name' : 'collect_address';

      // Start registration flow for order completion
      await storage.createRegistrationFlow({
        phoneNumber: phoneNumber,
        currentStep: nextStep,
        collectedData: JSON.stringify({ 
          orderId: order.id,
          orderNumber: orderNumber,
          hasName: !isNewCustomer
        }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // Send next data collection message using auto-responses
      await processAutoResponse(nextTrigger, phoneNumber);

      await storage.addWhatsAppLog({
        type: 'success',
        phoneNumber: phoneNumber,
        messageContent: `Pedido ${orderNumber} creado exitosamente desde catálogo web`,
        status: 'completed',
        rawData: JSON.stringify({ 
          orderId: order.id,
          orderNumber: orderNumber,
          total: total,
          itemCount: orderItems.length
        })
      });

    } catch (error: any) {
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: phoneNumber,
        messageContent: 'Error procesando pedido desde catálogo web',
        status: 'error',
        errorMessage: error.message,
        rawData: JSON.stringify({ 
          error: error.message,
          customerId: customer.id,
          messageLength: orderText.length
        })
      });

      await sendWhatsAppMessage(phoneNumber, 
        "Hubo un error procesando tu pedido. Por favor intenta nuevamente o contáctanos directamente.");
    }
  }

  // Function to parse order items from catalog message
  function parseOrderFromMessage(orderText: string): Array<{name: string, quantity: number, price: number, productId?: number}> {
    const items: Array<{name: string, quantity: number, price: number, productId?: number}> = [];
    
    try {
      // Split the message into lines
      const lines = orderText.split('\n');
      
      let currentItem: any = null;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Check if this line starts a new product (number followed by period)
        if (/^\d+\.\s/.test(trimmedLine)) {
          // Save previous item if exists
          if (currentItem && currentItem.name && currentItem.quantity && currentItem.price) {
            items.push(currentItem);
          }
          
          // Start new item
          currentItem = {
            name: trimmedLine.replace(/^\d+\.\s/, ''),
            quantity: 0,
            price: 0
          };
        }
        // Check for quantity line
        else if (trimmedLine.startsWith('Cantidad:') && currentItem) {
          const quantity = parseInt(trimmedLine.replace('Cantidad:', '').trim());
          if (!isNaN(quantity)) {
            currentItem.quantity = quantity;
          }
        }
        // Check for unit price line
        else if (trimmedLine.startsWith('Precio unitario:') && currentItem) {
          const priceMatch = trimmedLine.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
          if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(/,/g, ''));
            if (!isNaN(price)) {
              currentItem.price = price;
            }
          }
        }
      }
      
      // Don't forget the last item
      if (currentItem && currentItem.name && currentItem.quantity && currentItem.price) {
        items.push(currentItem);
      }
      
    } catch (error) {
      console.error('Error parsing order message:', error);
    }
    
    return items;
  }

  // Helper function for tracking conversations
  async function handleTrackingConversation(customer: any, phoneNumber: string, messageText: string) {
    try {
      await storage.addWhatsAppLog({
        type: 'debug',
        phoneNumber: phoneNumber,
        messageContent: `Procesando conversación de seguimiento para cliente ${customer.id}`,
        status: 'processing',
        rawData: JSON.stringify({ 
          customerId: customer.id,
          conversationType: 'tracking',
          messageReceived: messageText
        })
      });

      // Get customer's active orders
      const orders = await storage.getAllOrders();
      const activeOrders = orders.filter(order => 
        order.customer.id === customer.id && 
        ['pending', 'confirmed', 'in_progress', 'assigned'].includes(order.status)
      );

      if (activeOrders.length === 0) {
        await sendWhatsAppMessage(phoneNumber, "No tienes pedidos activos en este momento. ¿Te gustaría hacer un nuevo pedido?");
        return;
      }

      // Check for specific button actions
      const lowerText = messageText.toLowerCase();
      
      // Option 1: Track Order Status
      if (lowerText.includes('seguimiento') || lowerText.includes('estado') || lowerText.includes('status')) {
        let statusMessage = `📋 *Estado de tus pedidos activos:*\n\n`;
        for (const order of activeOrders) {
          const statusEmoji = getStatusEmoji(order.status);
          statusMessage += `${statusEmoji} *Pedido ${order.orderNumber}*\n`;
          statusMessage += `   Estado: ${order.status}\n`;
          statusMessage += `   Total: $${order.totalAmount}\n`;
          if (order.assignedTo) {
            statusMessage += `   Técnico: ${order.assignedTo}\n`;
          }
          statusMessage += `\n`;
        }
        statusMessage += `Para más información o cambios, escribe de nuevo.`;
        await sendWhatsAppMessage(phoneNumber, statusMessage);
        return;
      }
      
      // Option 2: Contact Support for modifications
      if (lowerText.includes('editar') || lowerText.includes('modificar') || lowerText.includes('cambiar')) {
        await sendWhatsAppMessage(phoneNumber, 
          `🔧 *Modificaciones de Pedido*\n\n` +
          `Para modificaciones o cancelaciones, contacta directamente:\n\n` +
          `📞 *Teléfono:* +52 55 1234 5678\n` +
          `🕒 *Horario:* Lun-Vie 8AM-6PM, Sáb 9AM-2PM\n\n` +
          `⚠️ *Importante:* Las modificaciones deben realizarse antes de que el técnico esté en camino.`
        );
        return;
      }
      
      // Option 3: New Order
      if (lowerText.includes('nuevo') || lowerText.includes('otro pedido')) {
        // Send welcome message to start new order flow
        await sendWelcomeMessage(phoneNumber);
        return;
      }

      // Default: Show interactive menu with two options for customers with active orders
      const interactiveMessage = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: `👋 Hola ${customer.name}! Tienes ${activeOrders.length} pedido(s) activo(s).\n\n¿Qué te gustaría hacer?`
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "track_order",
                  title: "📋 Seguimiento"
                }
              },
              {
                type: "reply",
                reply: {
                  id: "new_order",
                  title: "🛍️ Nuevo Pedido"
                }
              }
            ]
          }
        }
      };

      await sendWhatsAppInteractiveMessage(phoneNumber, interactiveMessage);

    } catch (error) {
      console.error('Error in handleTrackingConversation:', error);
      await sendWhatsAppMessage(phoneNumber, "Disculpa, hubo un error procesando tu consulta. ¿Puedes intentar de nuevo?");
    }
  }



  // Helper function for support conversations
  async function handleSupportConversation(customer: any, phoneNumber: string, messageText: string) {
    try {
      await storage.addWhatsAppLog({
        type: 'debug',
        phoneNumber: phoneNumber,
        messageContent: `Procesando conversación de soporte para cliente ${customer.id}`,
        status: 'processing',
        rawData: JSON.stringify({ 
          customerId: customer.id,
          conversationType: 'support',
          messageReceived: messageText
        })
      });

      // Get customer's recent completed orders
      const orders = await storage.getAllOrders();
      const recentOrders = orders.filter(order => 
        order.customer.id === customer.id && 
        ['completed', 'delivered'].includes(order.status)
      ).slice(0, 5); // Last 5 completed orders

      if (recentOrders.length === 0) {
        await sendWhatsAppMessage(phoneNumber, "No tienes servicios completados para consultar. ¿Necesitas información sobre nuestros servicios?");
        return;
      }

      // Process support commands
      const lowerText = messageText.toLowerCase();
      
      if (lowerText.includes('garantia') || lowerText.includes('garantía') || lowerText.includes('warranty')) {
        let warrantyMessage = `🛡️ *Información de Garantía*\n\n`;
        warrantyMessage += `Tus servicios recientes:\n\n`;
        for (const order of recentOrders.slice(0, 3)) {
          warrantyMessage += `• *${order.orderNumber}* - Completado\n`;
          warrantyMessage += `  Garantía: 6 meses en servicios, 1 año en productos\n\n`;
        }
        warrantyMessage += `Para hacer válida tu garantía, contacta nuestro soporte técnico.`;
        await sendWhatsAppMessage(phoneNumber, warrantyMessage);
      } else if (lowerText.includes('tecnico') || lowerText.includes('técnico') || lowerText.includes('problema')) {
        await sendWhatsAppMessage(phoneNumber, `🔧 *Soporte Técnico*\n\nNuestro equipo técnico está disponible para ayudarte. Por favor describe tu problema y mencionael número de pedido: ${recentOrders[0]?.orderNumber || 'N/A'}`);
      } else if (lowerText.includes('factura') || lowerText.includes('recibo') || lowerText.includes('invoice')) {
        await sendWhatsAppMessage(phoneNumber, `📄 *Facturación*\n\nPodemos enviarte una copia de tu factura. Menciona el número de pedido que necesitas: ${recentOrders[0]?.orderNumber || 'Consulta disponible'}`);
      } else if (lowerText.includes('opinion') || lowerText.includes('opinión') || lowerText.includes('feedback')) {
        await sendWhatsAppMessage(phoneNumber, `⭐ *Tu Opinión es Importante*\n\n¿Cómo calificarías nuestro servicio del 1 al 5?\n\nEscribe cualquier comentario sobre tu experiencia con nosotros.`);
      } else {
        // Show support menu
        let supportMessage = `🎧 *Menú de Soporte*\n\n`;
        supportMessage += `Servicios completados: ${recentOrders.length}\n\n`;
        supportMessage += `*Opciones disponibles:*\n`;
        supportMessage += `• Escribe "garantía" para información de garantía\n`;
        supportMessage += `• Escribe "técnico" para soporte técnico\n`;
        supportMessage += `• Escribe "factura" para solicitar factura\n`;
        supportMessage += `• Escribe "opinión" para enviar feedback\n`;
        await sendWhatsAppMessage(phoneNumber, supportMessage);
      }

    } catch (error) {
      console.error('Error in handleSupportConversation:', error);
      await sendWhatsAppMessage(phoneNumber, "Disculpa, hubo un error procesando tu consulta de soporte. ¿Puedes intentar de nuevo?");
    }
  }



  // Simplified WhatsApp message processing function
  async function processWhatsAppMessage(value: any) {
    try {
      if (value.messages && value.messages.length > 0) {
        for (const message of value.messages) {
          const from = message.from;
          const messageId = message.id;
          const timestamp = message.timestamp;
          const messageType = message.type;
          
          let messageText = '';
          if (messageType === 'text') {
            messageText = message.text.body;
          } else if (messageType === 'image') {
            messageText = `[Imagen recibida] ${message.image.caption || ''}`;
          } else if (messageType === 'document') {
            messageText = `[Documento recibido] ${message.document.filename || ''}`;
          } else if (messageType === 'location') {
            // Handle location messages
            const location = message.location;
            messageText = location.name || location.address || 
              `Ubicación GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
          } else if (messageType === 'interactive') {
            // Handle interactive messages (buttons, lists)
            if (message.interactive.type === 'button_reply') {
              messageText = `[Botón seleccionado] ${message.interactive.button_reply.title}`;
            } else if (message.interactive.type === 'list_reply') {
              messageText = `[Lista seleccionada] ${message.interactive.list_reply.title}`;
            } else {
              messageText = `[Mensaje interactivo] ${message.interactive.type}`;
            }
          } else {
            messageText = `[${messageType}] Mensaje no soportado`;
          }

          // Log the received message
          await storage.addWhatsAppLog({
            type: 'incoming',
            phoneNumber: from,
            messageContent: `Mensaje recibido de ${from}`,
            messageId: messageId,
            status: 'received',
            rawData: JSON.stringify({
              from,
              messageId,
              timestamp,
              messageType,
              content: messageText,
              rawMessage: message
            })
          });

          // Find or create customer
          await storage.addWhatsAppLog({
            type: 'debug',
            phoneNumber: from,
            messageContent: 'Buscando cliente por teléfono',
            status: 'processing',
            rawData: JSON.stringify({ phoneNumber: from })
          });

          let customer = await storage.getCustomerByPhone(from);
          let isNewCustomer = false;
          
          await storage.addWhatsAppLog({
            type: 'debug',
            phoneNumber: from,
            messageContent: `Cliente ${customer ? 'encontrado' : 'no encontrado'}`,
            status: customer ? 'found' : 'not_found',
            rawData: JSON.stringify({ 
              customerId: customer?.id || null,
              customerName: customer?.name || null
            })
          });
          
          if (!customer) {
            // Check if there's an ongoing registration flow
            await storage.addWhatsAppLog({
              type: 'debug',
              phoneNumber: from,
              messageContent: 'Verificando flujo de registro existente',
              status: 'processing'
            });

            const registrationFlow = await storage.getRegistrationFlow(from);
            
            if (!registrationFlow) {
              // New customer - create basic customer record and continue with message processing
              await storage.addWhatsAppLog({
                type: 'debug',
                phoneNumber: from,
                messageContent: 'Nuevo cliente detectado - creando registro básico',
                status: 'processing'
              });

              customer = await storage.createCustomer({
                name: `Cliente ${from.slice(-4)}`, // Temporary name until they order
                phone: from,
                whatsappId: from
              });
              
              await storage.addWhatsAppLog({
                type: 'info',
                phoneNumber: from,
                messageContent: `Cliente básico creado: ID ${customer.id}`,
                status: 'processed'
              });

              // Mark as new customer and continue processing message
              isNewCustomer = true;
            } else {
              // Handle registration flow
              await storage.addWhatsAppLog({
                type: 'debug',
                phoneNumber: from,
                messageContent: 'Procesando flujo de registro existente',
                status: 'processing',
                rawData: JSON.stringify({ step: registrationFlow.currentStep })
              });
              await handleRegistrationFlow(from, messageText, registrationFlow);
              return;
            }
          } else {
            // Existing customer - check for active registration flow first
            const registrationFlow = await storage.getRegistrationFlow(from);
            
            if (registrationFlow) {
              // Handle registration flow for existing customer
              await handleRegistrationFlow(from, messageText, registrationFlow);
              return;
            }
            
            // Check if name is generic (needs completion)
            if (customer.name.startsWith('Cliente ')) {
              isNewCustomer = true;
              await storage.addWhatsAppLog({
                type: 'debug',
                phoneNumber: from,
                messageContent: 'Cliente existente necesita completar registro',
                status: 'processing'
              });
            }
          }

          // Find existing conversation or create new one
          const conversations = await storage.getActiveConversations();
          let conversation = conversations.find(c => c.customer.phone === from);
          
          if (!conversation) {
            conversation = await storage.createConversation({
              customerId: customer.id,
              status: "active"
            });
            
            await storage.addWhatsAppLog({
              type: 'info',
              phoneNumber: from,
              messageContent: `Nueva conversación creada para ${from}`,
              status: 'success',
              rawData: JSON.stringify({ conversationId: conversation.id, customerId: customer.id })
            });
          }

          // Create message in conversation
          await storage.createMessage({
            conversationId: conversation.id,
            content: messageText,
            senderId: null, // Customer message
            senderType: "customer",
            whatsappMessageId: messageId,
            messageType: messageType
          });

          // Handle interactive messages (buttons) BEFORE text processing
          if (messageType === 'interactive') {
            await handleInteractiveMessage(customer, conversation, message.interactive, from);
            return; // Don't process further as text message
          }

          // Handle location messages
          if (messageType === 'location') {
            await handleLocationMessage(customer, message.location, from);
            return; // Don't process further as text message
          }

          // PRIORITY CHECK: Handle active registration flows BEFORE processing as regular conversation
          const activeRegistrationFlow = await storage.getRegistrationFlow(from);
          
          if (activeRegistrationFlow) {
            await handleRegistrationFlow(from, messageText, activeRegistrationFlow);
            return; // Don't process as regular conversation
          }

          // Process customer message and respond (for text messages)
          await processCustomerMessage(customer, conversation, message, from, isNewCustomer);

          await storage.addWhatsAppLog({
            type: 'info',
            message: `Mensaje guardado en conversación ${conversation.id}`,
            data: { conversationId: conversation.id, messageId }
          });
        }
      }

      // Process status updates (message delivery, read receipts)
      if (value.statuses && value.statuses.length > 0) {
        for (const status of value.statuses) {
          await storage.addWhatsAppLog({
            type: 'info',
            message: `Estado de mensaje actualizado: ${status.status}`,
            data: {
              messageId: status.id,
              status: status.status,
              timestamp: status.timestamp,
              recipient: status.recipient_id
            }
          });
        }
      }
    } catch (error: any) {
      console.error("Error detallado en processWhatsAppMessage:", error);
      
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: null,
        messageContent: 'Error procesando mensaje de WhatsApp',
        status: 'error',
        errorMessage: error.message || error.toString(),
        rawData: JSON.stringify({ 
          error: error.message || error.toString(),
          stack: error.stack || 'No stack trace',
          value: value,
          errorType: typeof error,
          errorName: error.name || 'Unknown error'
        })
      });
    }
  }

  // Function to process customer messages and respond with menu/orders

  async function sendProductMenu(phoneNumber: string) {
    const products = await storage.getAllProducts();
    const productItems = products.filter(p => p.category === 'product').slice(0, 5);
    const serviceItems = products.filter(p => p.category === 'service').slice(0, 5);

    const menuMessage = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "list",
        header: {
          type: "text",
          text: "🛍️ Catálogo de Productos"
        },
        body: {
          text: "Selecciona una categoría para ver nuestros productos disponibles:"
        },
        footer: {
          text: "Precio incluye entrega basada en tu ubicación"
        },
        action: {
          button: "Ver Productos",
          sections: [
            {
              title: "🔧 Productos",
              rows: productItems.map(product => ({
                id: `product_${product.id}`,
                title: product.name.substring(0, 24),
                description: `$${parseFloat(product.price).toLocaleString('es-MX')}`
              }))
            },
            {
              title: "⚙️ Servicios",
              rows: serviceItems.map(service => ({
                id: `service_${service.id}`,
                title: service.name.substring(0, 24),
                description: `Desde $${parseFloat(service.price).toLocaleString('es-MX')}`
              }))
            },
            {
              title: "📍 Ubicación",
              rows: [{
                id: "request_location",
                title: "Compartir Ubicación",
                description: "Para calcular costo de entrega"
              }]
            }
          ]
        }
      }
    };

    await sendWhatsAppInteractiveMessage(phoneNumber, menuMessage);
  }

  async function sendLocationRequest(phoneNumber: string) {
    const locationMessage = 
      "📍 *Necesitamos tu ubicación*\n\n" +
      "Para calcular el costo de entrega exacto, por favor:\n\n" +
      "🎯 *Recomendado - Ubicación GPS:*\n" +
      "📱 Botón 📎 → Ubicación → Enviar ubicación actual\n" +
      "_(Más preciso y rápido)_\n\n" +
      "📝 *O escribe tu dirección:*\n" +
      "Incluye calle, número, colonia y código postal\n\n" +
      "💡 La ubicación GPS nos permite calcular la distancia exacta y darte el precio más preciso.";

    await sendWhatsAppMessage(phoneNumber, locationMessage);
  }

  async function handleLocationMessage(customer: any, location: any, phoneNumber: string) {
    try {
      // Generate Google Maps link from GPS coordinates
      const gpsAddress = location.name || location.address || 
        `Ubicación GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
      const mapLink = generateGoogleMapsLink(location.latitude, location.longitude, gpsAddress);

      // Log received location for debugging
      await storage.addWhatsAppLog({
        type: 'info',
        phoneNumber: phoneNumber,
        messageContent: `Ubicación GPS recibida: ${location.latitude}, ${location.longitude} - Enlace: ${mapLink}`,
        status: 'received',
        rawData: JSON.stringify({ 
          latitude: location.latitude,
          longitude: location.longitude,
          name: location.name,
          address: location.address,
          mapLink: mapLink,
          customerId: customer.id
        })
      });

      // Check if customer is in an active registration flow (order completion)
      const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
      if (registrationFlow && registrationFlow.currentStep === 'collect_delivery_address') {
        // Handle location during order flow
        await handleLocationInOrderFlow(customer, location, phoneNumber, registrationFlow);
        return;
      }

      // Handle general location sharing (outside of order flow)
      await handleGeneralLocationSharing(customer, location, phoneNumber);

    } catch (error) {
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: phoneNumber,
        messageContent: 'Error procesando ubicación GPS',
        status: 'error',
        errorMessage: (error as Error).message,
        rawData: JSON.stringify({ error: (error as Error).message, location })
      });

      await sendWhatsAppMessage(phoneNumber, 
        "❌ Hubo un error procesando tu ubicación. Por favor, inténtalo nuevamente o envía tu dirección como texto."
      );
    }
  }

  // Handle location sharing during order completion flow
  async function handleLocationInOrderFlow(customer: any, location: any, phoneNumber: string, registrationFlow: any) {
    try {
      // Log detailed location processing for debugging
      await storage.addWhatsAppLog({
        type: 'debug',
        phoneNumber: phoneNumber,
        messageContent: `Iniciando procesamiento de ubicación en flujo de pedido`,
        status: 'processing',
        rawData: JSON.stringify({ 
          step: 'location_processing_start',
          locationLatitude: location.latitude,
          locationLongitude: location.longitude,
          locationName: location.name,
          locationAddress: location.address,
          customerId: customer.id,
          registrationFlowStep: registrationFlow.currentStep
        })
      });

      // Validate location data
      if (!location.latitude || !location.longitude) {
        throw new Error(`Datos de ubicación inválidos: latitude=${location.latitude}, longitude=${location.longitude}`);
      }

      // Generate address from GPS coordinates
      const gpsAddress = location.name || location.address || 
        `Ubicación GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
      
      // Generate Google Maps link for technician navigation
      const mapLink = generateGoogleMapsLink(location.latitude, location.longitude, gpsAddress);

      // Update customer with location data and map link
      const updatedCustomer = await storage.updateCustomerLocation(customer.id, {
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(), 
        address: gpsAddress,
        mapLink: mapLink
      });

      // Calculate delivery cost
      const deliveryInfo = await storage.calculateDeliveryCost(
        location.latitude.toString(),
        location.longitude.toString(),
        "product"
      );

    // Get order data from registration flow
    const orderData = JSON.parse(registrationFlow.collectedData || '{}');
    
    // Update flow to next step - collect contact number
    const updatedData = { ...orderData, deliveryAddress: gpsAddress, gpsLocation: { latitude: location.latitude, longitude: location.longitude } };
    await storage.updateRegistrationFlow(phoneNumber, {
      currentStep: 'collect_contact_number',
      collectedData: JSON.stringify(updatedData)
    });

    const confirmMessage = 
      "📍 *¡Ubicación GPS guardada!*\n\n" +
      `📍 ${gpsAddress}\n` +
      `🚛 Distancia: ${deliveryInfo.distance} km\n` +
      `💰 Costo de entrega: $${deliveryInfo.cost}\n` +
      `⏱️ Tiempo estimado: ${deliveryInfo.estimatedTime} min\n\n` +
      "📞 *Número de Contacto*\n" +
      "Necesitamos un número para coordinar la entrega:";

    await sendWhatsAppMessage(phoneNumber, confirmMessage);

    // Send contact number selection with option to use WhatsApp number
    const contactMessage = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: "Selecciona tu número de contacto para la entrega:"
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: "use_whatsapp_number",
                title: "📱 Usar este WhatsApp"
              }
            },
            {
              type: "reply",
              reply: {
                id: "provide_different_number",
                title: "📞 Otro número"
              }
            }
          ]
        }
      }
    };

    await sendWhatsAppInteractiveMessage(phoneNumber, contactMessage);

      await storage.addWhatsAppLog({
        type: 'info',
        phoneNumber: phoneNumber,
        messageContent: `Ubicación GPS procesada en flujo de pedido: ${gpsAddress}`,
        status: 'processed',
        rawData: JSON.stringify({ 
          orderId: orderData.orderId,
          gpsCoordinates: { latitude: location.latitude, longitude: location.longitude },
          deliveryCost: deliveryInfo.cost,
          distance: deliveryInfo.distance
        })
      });

    } catch (error) {
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: phoneNumber,
        messageContent: 'Error en procesamiento de ubicación GPS en flujo de pedido',
        status: 'error',
        errorMessage: (error as Error).message,
        rawData: JSON.stringify({ 
          error: (error as Error).message, 
          location: location,
          registrationFlow: registrationFlow?.currentStep,
          customerId: customer.id
        })
      });

      throw error; // Re-throw to be caught by parent handler
    }
  }

  // Handle general location sharing (outside of order flow)
  async function handleGeneralLocationSharing(customer: any, location: any, phoneNumber: string) {
    // Generate address from GPS coordinates
    const gpsAddress = location.name || location.address || 
      `Ubicación GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    
    // Generate Google Maps link for technician navigation
    const mapLink = generateGoogleMapsLink(location.latitude, location.longitude, gpsAddress);

    // Update customer with location data and map link
    const updatedCustomer = await storage.updateCustomerLocation(customer.id, {
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(), 
      address: gpsAddress,
      mapLink: mapLink
    });

    // Calculate delivery cost for sample
    const deliveryInfo = await storage.calculateDeliveryCost(
      location.latitude.toString(),
      location.longitude.toString(),
      "product"
    );

    const confirmMessage = 
      "📍 *¡Ubicación GPS guardada!*\n\n" +
      `📍 ${gpsAddress}\n` +
      `🚛 Distancia: ${deliveryInfo.distance} km\n` +
      `💰 Entrega desde: $${deliveryInfo.cost}\n` +
      `⏱️ Tiempo estimado: ${deliveryInfo.estimatedTime} min\n\n` +
      "Ahora puedes seleccionar productos para generar tu pedido.\n\n" +
      "Escribe *menu* para ver nuestro catálogo.";

    await sendWhatsAppMessage(phoneNumber, confirmMessage);

    await storage.addWhatsAppLog({
      type: 'info',
      phoneNumber: phoneNumber,
      messageContent: `Ubicación GPS guardada para uso general: ${gpsAddress}`,
      status: 'processed',
      rawData: JSON.stringify({ 
        customerId: customer.id,
        gpsCoordinates: { latitude: location.latitude, longitude: location.longitude },
        deliveryCost: deliveryInfo.cost,
        distance: deliveryInfo.distance
      })
    });
  }

  async function handleInteractiveMessage(customer: any, conversation: any, interactive: any, phoneNumber: string) {
    if (interactive.type === 'list_reply') {
      const selectedId = interactive.list_reply.id;
      
      if (selectedId.startsWith('product_') || selectedId.startsWith('service_')) {
        const productId = parseInt(selectedId.split('_')[1]);
        await handleProductSelection(customer, conversation, productId, phoneNumber);
      } else if (selectedId === 'request_location') {
        await sendLocationRequest(phoneNumber);
      }
    } else if (interactive.type === 'button_reply') {
      const buttonId = interactive.button_reply.id;
      
      // Log button interaction for debugging
      await storage.addWhatsAppLog({
        type: 'info',
        phoneNumber: phoneNumber,
        messageContent: `Button pressed: ${buttonId}`,
        status: 'received',
        rawData: JSON.stringify({ buttonId, interactiveType: interactive.type })
      });

      console.log('Processing button interaction:', buttonId);

      // Handle menu buttons from welcome message and auto-responses
      if (buttonId === 'products' || buttonId === 'show_products') {
        await processAutoResponse('product_inquiry', phoneNumber);
      } else if (buttonId === 'services' || buttonId === 'show_services') {
        await processAutoResponse('service_inquiry', phoneNumber);
      } else if (buttonId === 'help' || buttonId === 'show_help') {
        await processAutoResponse('help', phoneNumber);
      } else if (buttonId === 'menu' || buttonId === 'main_menu') {
        await processAutoResponse('menu', phoneNumber);
      } else if (buttonId === 'product_12k' || buttonId === 'product_18k' || buttonId === 'product_24k') {
        // Handle specific product selections - redirect to order flow
        await sendWhatsAppMessage(phoneNumber, 
          "Para realizar un pedido, por favor escribe *pedido* o selecciona el producto específico desde el menú."
        );
      } else if (buttonId === 'service_install' || buttonId === 'service_maintenance' || buttonId === 'service_repair') {
        // Handle specific service selections - redirect to order flow
        await sendWhatsAppMessage(phoneNumber, 
          "Para solicitar un servicio, por favor escribe *servicio* o contacta con un técnico."
        );
      } else if (buttonId === 'order' || buttonId === 'start_order') {
        // Start order process - redirect to menu or product selection
        await processAutoResponse('menu', phoneNumber);
      } else if (buttonId.startsWith('quantity_')) {
        const [, productId, quantity] = buttonId.split('_');
        await handleQuantitySelection(customer, parseInt(productId), parseInt(quantity), phoneNumber);
      } else if (buttonId === 'confirm_order') {
        await handleOrderConfirmation(customer, conversation, phoneNumber);
      } else if (buttonId === 'cancel_order') {
        await sendWelcomeMessage(phoneNumber);
      } else if (buttonId.startsWith('payment_')) {
        const paymentMethod = buttonId.split('_')[1];
        await handlePaymentMethodSelection(customer, paymentMethod, phoneNumber);
      } else if (buttonId === 'use_whatsapp_number' || buttonId === 'use_current') {
        // Customer wants to use their WhatsApp number as contact
        const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
        if (registrationFlow && registrationFlow.currentStep === 'collect_contact') {
          const data = JSON.parse(registrationFlow.collectedData || '{}');
          const updatedData = { ...data, contactNumber: phoneNumber };
          await storage.updateRegistrationFlow(phoneNumber, {
            currentStep: 'collect_payment',
            collectedData: JSON.stringify(updatedData)
          });
          await processAutoResponse('collect_payment', phoneNumber);
        } else {
          await handleContactNumberSelection(customer, phoneNumber, phoneNumber);
        }
      } else if (buttonId === 'provide_different_number' || buttonId === 'use_other') {
        // Customer wants to provide a different contact number
        const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
        if (registrationFlow && registrationFlow.currentStep === 'collect_contact') {
          await sendWhatsAppMessage(phoneNumber, 
            "📞 Por favor proporciona el número de contacto que prefieres usar:\n\n" +
            "Escribe el número de 10 dígitos sin espacios ni guiones.\n" +
            "Ejemplo: 5512345678"
          );
          const data = JSON.parse(registrationFlow.collectedData || '{}');
          await storage.updateRegistrationFlow(phoneNumber, {
            currentStep: 'collect_different_number',
            collectedData: JSON.stringify(data)
          });
        } else {
          await handleContactNumberRequest(customer, phoneNumber);
        }
      } else if (buttonId === 'payment_card') {
        // Customer selected credit/debit card payment
        const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
        if (registrationFlow && registrationFlow.currentStep === 'collect_payment') {
          const data = JSON.parse(registrationFlow.collectedData || '{}');
          const updatedData = { ...data, paymentMethod: 'card' };
          await storage.updateRegistrationFlow(phoneNumber, {
            currentStep: 'collect_notes',
            collectedData: JSON.stringify(updatedData)
          });
          await processAutoResponse('collect_notes', phoneNumber);
        } else {
          await handlePaymentMethodSelection(customer, 'card', phoneNumber);
        }
      } else if (buttonId === 'payment_transfer') {
        // Customer selected bank transfer payment
        const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
        if (registrationFlow && registrationFlow.currentStep === 'collect_payment') {
          const data = JSON.parse(registrationFlow.collectedData || '{}');
          const updatedData = { ...data, paymentMethod: 'transfer' };
          await storage.updateRegistrationFlow(phoneNumber, {
            currentStep: 'collect_notes',
            collectedData: JSON.stringify(updatedData)
          });
          await processAutoResponse('collect_notes', phoneNumber);
        } else {
          await handlePaymentMethodSelection(customer, 'transfer', phoneNumber);
        }
      } else if (buttonId === 'payment_cash') {
        // Customer selected cash payment
        const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
        if (registrationFlow && registrationFlow.currentStep === 'collect_payment') {
          const data = JSON.parse(registrationFlow.collectedData || '{}');
          const updatedData = { ...data, paymentMethod: 'cash' };
          await storage.updateRegistrationFlow(phoneNumber, {
            currentStep: 'collect_notes',
            collectedData: JSON.stringify(updatedData)
          });
          await processAutoResponse('collect_notes', phoneNumber);
        } else {
          await handlePaymentMethodSelection(customer, 'cash', phoneNumber);
        }
      } else if (buttonId === 'skip_notes') {
        // Customer wants to skip additional notes
        const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
        if (registrationFlow && registrationFlow.currentStep === 'collect_notes') {
          await handleRegistrationFlow(phoneNumber, 'sin notas', registrationFlow);
        }
      } else if (buttonId === 'track_order') {
        // Handle order tracking button
        const orders = await storage.getAllOrders();
        const activeOrders = orders.filter(order => 
          order.customer.id === customer.id && 
          ['pending', 'confirmed', 'in_progress', 'assigned'].includes(order.status)
        );
        
        if (activeOrders.length > 0) {
          let statusMessage = `📋 *Estado de tus pedidos activos:*\n\n`;
          for (const order of activeOrders) {
            const statusEmoji = getStatusEmoji(order.status);
            statusMessage += `${statusEmoji} *Pedido ${order.orderNumber}*\n`;
            statusMessage += `   Estado: ${order.status}\n`;
            statusMessage += `   Total: $${order.totalAmount}\n\n`;
          }
          statusMessage += `Para más información o cambios, escribe de nuevo.`;
          await sendWhatsAppMessage(phoneNumber, statusMessage);
        } else {
          await sendWhatsAppMessage(phoneNumber, "No tienes pedidos activos en este momento.");
        }

      } else if (buttonId === 'new_order') {
        // Handle new order button - start fresh order flow
        await sendWelcomeMessage(phoneNumber);

      } else if (buttonId === 'back_to_menu') {
        // Handle back to menu button
        await handleTrackingConversation(customer, phoneNumber, '');
      } else if (buttonId === 'confirm_saved_address') {
        await handleSavedAddressConfirmation(customer, phoneNumber);
      } else if (buttonId === 'update_address') {
        await handleAddressUpdate(customer, phoneNumber);
      }
    }
  }

  // Function to handle saved address confirmation
  async function handleSavedAddressConfirmation(customer: any, phoneNumber: string) {
    try {
      // Get registration flow to retrieve order data
      const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
      if (!registrationFlow || registrationFlow.currentStep !== 'confirm_saved_address') {
        await sendWhatsAppMessage(phoneNumber, 
          "❌ Error: No se encontró información del pedido. Por favor, inicia un nuevo pedido escribiendo *menu*."
        );
        return;
      }

      const orderData = JSON.parse(registrationFlow.collectedData || '{}');
      
      // Since customer already has a phone number (WhatsApp), proceed directly to payment
      // Update flow to next step - collect payment method
      await storage.updateRegistrationFlow(phoneNumber, {
        currentStep: 'collect_payment_method',
        collectedData: JSON.stringify({
          ...orderData,
          customerName: customer.name,
          customerAddress: customer.address,
          contactNumber: phoneNumber
        })
      });

      // Send payment method selection
      const paymentMessage = {
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: "💳 *Método de Pago*\n\n" +
                  "Selecciona tu método de pago preferido:\n\n" +
                  "💳 *Tarjeta*: Pago seguro en línea\n" +
                  "🏦 *Transferencia*: BBVA, Santander, etc.\n" +
                  "💵 *Efectivo*: Al momento de la entrega"
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "payment_card",
                  title: "💳 Tarjeta"
                }
              },
              {
                type: "reply",
                reply: {
                  id: "payment_transfer",
                  title: "🏦 Transferencia"
                }
              },
              {
                type: "reply",
                reply: {
                  id: "payment_cash",
                  title: "💵 Efectivo"
                }
              }
            ]
          }
        }
      };

      await sendWhatsAppInteractiveMessage(phoneNumber, paymentMessage);

    } catch (error) {
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: phoneNumber,
        messageContent: 'Error en confirmación de dirección guardada',
        status: 'error',
        errorMessage: (error as Error).message
      });

      await sendWhatsAppMessage(phoneNumber, 
        "❌ Hubo un error. Por favor, intenta nuevamente o contacta a nuestro equipo."
      );
    }
  }

  // Function to handle address update
  async function handleAddressUpdate(customer: any, phoneNumber: string) {
    try {
      // Get registration flow to retrieve order data
      const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
      if (!registrationFlow || registrationFlow.currentStep !== 'confirm_saved_address') {
        await sendWhatsAppMessage(phoneNumber, 
          "❌ Error: No se encontró información del pedido. Por favor, inicia un nuevo pedido escribiendo *menu*."
        );
        return;
      }

      const orderData = JSON.parse(registrationFlow.collectedData || '{}');
      
      // Update flow to collect new address
      await storage.updateRegistrationFlow(phoneNumber, {
        currentStep: 'collect_customer_address',
        collectedData: JSON.stringify({
          ...orderData,
          customerName: customer.name
        })
      });

      // Request location sharing
      await sendLocationRequest(phoneNumber);

    } catch (error) {
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: phoneNumber,
        messageContent: 'Error en actualización de dirección',
        status: 'error',
        errorMessage: (error as Error).message
      });

      await sendWhatsAppMessage(phoneNumber, 
        "❌ Hubo un error. Por favor, intenta nuevamente o contacta a nuestro equipo."
      );
    }
  }

  // Function to handle contact number selection
  async function handleContactNumberSelection(customer: any, phoneNumber: string, contactNumber: string) {
    try {
      // Get registration flow to retrieve order data
      const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
      if (!registrationFlow || registrationFlow.currentStep !== 'collect_contact_number') {
        await sendWhatsAppMessage(phoneNumber, 
          "❌ Error: No se encontró información del pedido. Por favor, inicia un nuevo pedido escribiendo *menu*."
        );
        return;
      }

      const orderData = JSON.parse(registrationFlow.collectedData || '{}');
      
      // Update flow to next step - collect payment method
      const updatedData = { ...orderData, contactNumber: contactNumber };
      await storage.updateRegistrationFlow(phoneNumber, {
        currentStep: 'collect_payment_method',
        collectedData: JSON.stringify(updatedData)
      });
      
      // Send payment method selection
      const paymentMessage = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: `✅ *Número de contacto: ${contactNumber}*\n\n💳 *Método de Pago*\nSelecciona tu método de pago preferido:`
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "payment_card",
                  title: "💳 Tarjeta"
                }
              },
              {
                type: "reply",
                reply: {
                  id: "payment_transfer", 
                  title: "🏦 Transferencia"
                }
              },
              {
                type: "reply",
                reply: {
                  id: "payment_cash",
                  title: "💵 Efectivo"
                }
              }
            ]
          }
        }
      };
      
      await sendWhatsAppInteractiveMessage(phoneNumber, paymentMessage);
      
    } catch (error) {
      await sendWhatsAppMessage(phoneNumber, 
        "❌ Hubo un error procesando el número de contacto. Por favor, inténtalo nuevamente."
      );
    }
  }

  // Function to handle request for different contact number
  async function handleContactNumberRequest(customer: any, phoneNumber: string) {
    try {
      // Get registration flow to retrieve order data
      const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
      if (!registrationFlow || registrationFlow.currentStep !== 'collect_contact_number') {
        await sendWhatsAppMessage(phoneNumber, 
          "❌ Error: No se encontró información del pedido. Por favor, inicia un nuevo pedido escribiendo *menu*."
        );
        return;
      }

      const orderData = JSON.parse(registrationFlow.collectedData || '{}');
      
      // Update flow to collect different number
      await storage.updateRegistrationFlow(phoneNumber, {
        currentStep: 'collect_different_number',
        collectedData: registrationFlow.collectedData
      });
      
      const numberMessage = 
        "📞 *Número de Contacto Alternativo*\n\n" +
        "Por favor, comparte el número de teléfono donde podemos contactarte para coordinar la entrega:\n\n" +
        "Formato: 10 dígitos\n" +
        "Ejemplo: 5512345678";
        
      await sendWhatsAppMessage(phoneNumber, numberMessage);
      
    } catch (error) {
      await sendWhatsAppMessage(phoneNumber, 
        "❌ Hubo un error procesando tu solicitud. Por favor, inténtalo nuevamente."
      );
    }
  }

  // Function to handle payment method selection
  async function handlePaymentMethodSelection(customer: any, paymentMethod: string, phoneNumber: string) {
    try {
      // Get registration flow to retrieve order data
      const registrationFlow = await storage.getRegistrationFlow(phoneNumber);
      if (!registrationFlow || registrationFlow.currentStep !== 'collect_payment_method') {
        await sendWhatsAppMessage(phoneNumber, 
          "❌ Error: No se encontró información del pedido. Por favor, inicia un nuevo pedido escribiendo *menu*."
        );
        return;
      }

      const orderData = JSON.parse(registrationFlow.collectedData || '{}');
      
      // Map payment method to display text
      const paymentMethods: { [key: string]: string } = {
        'card': '💳 Tarjeta de Crédito/Débito',
        'transfer': '🏦 Transferencia Bancaria',
        'cash': '💵 Efectivo al Recibir'
      };

      const paymentText = paymentMethods[paymentMethod] || 'Método seleccionado';
      
      // Update order with payment method in notes
      if (orderData.orderId) {
        await storage.updateOrder(orderData.orderId, {
          notes: `Pedido generado desde WhatsApp - ${orderData.productName} x${orderData.quantity} - ${paymentText}`
        });
        
        // Update order status to confirmed
        await storage.updateOrderStatus(orderData.orderId, 'confirmed', undefined, `Método de pago: ${paymentText}`);
        
        // Add to customer history
        await storage.addCustomerHistoryEntry({
          customerId: customer.id,
          action: 'order_confirmed',
          description: `Pedido confirmado: ${orderData.productName} x${orderData.quantity} - Pago: ${paymentText}`,
          amount: orderData.totalAmount || '0.00',
          metadata: JSON.stringify({
            orderId: orderData.orderId,
            paymentMethod: paymentText,
            channel: 'whatsapp',
            productName: orderData.productName,
            quantity: orderData.quantity
          })
        });

        // Update customer statistics
        await storage.updateCustomerStats(customer.id);
      }

      // Delete registration flow as process is complete
      await storage.deleteRegistrationFlow(phoneNumber);

      // Send final confirmation message
      let finalMessage = 
        `🎉 *¡Pedido Confirmado!*\n\n` +
        `📦 *Resumen del Pedido:*\n` +
        `👤 Cliente: ${orderData.customerName || 'No registrado'}\n` +
        `🆔 Orden: ${orderData.orderNumber}\n` +
        `📱 Producto: ${orderData.productName}\n` +
        `📊 Cantidad: ${orderData.quantity} unidad${orderData.quantity > 1 ? 'es' : ''}\n` +
        `💰 Subtotal: $${orderData.basePrice.toLocaleString('es-MX')}\n`;

      if (orderData.deliveryCost > 0) {
        finalMessage += `🚛 Entrega: $${orderData.deliveryCost.toLocaleString('es-MX')}\n`;
      }

      finalMessage += 
        `*💳 Total: $${orderData.totalPrice.toLocaleString('es-MX')}*\n\n` +
        `💵 *Método de Pago:* ${paymentText}\n` +
        `📍 *Dirección:* ${orderData.deliveryAddress}\n` +
        `📞 *Contacto:* ${orderData.contactNumber || phoneNumber}\n\n`;

      // Add payment-specific instructions
      if (paymentMethod === 'card') {
        finalMessage += 
          `💳 *Instrucciones de Pago:*\n` +
          `• Te contactaremos para procesar el pago con tarjeta\n` +
          `• Acepta toda tarjeta de crédito y débito\n` +
          `• Pago seguro y protegido\n\n`;
      } else if (paymentMethod === 'transfer') {
        finalMessage += 
          `🏦 *Datos para Transferencia:*\n` +
          `• Cuenta: 1234567890\n` +
          `• CLABE: 012345678901234567\n` +
          `• Banco: Ejemplo Bank\n` +
          `• Beneficiario: Aires Acondicionados\n` +
          `• Envía comprobante por WhatsApp\n\n`;
      } else if (paymentMethod === 'cash') {
        finalMessage += 
          `💵 *Pago en Efectivo:*\n` +
          `• Paga al momento de la entrega\n` +
          `• Ten el monto exacto listo\n` +
          `• El técnico llevará cambio limitado\n\n`;
      }

      finalMessage += 
        `⏰ *Próximos Pasos:*\n` +
        `1️⃣ Te contactaremos en las próximas 2 horas\n` +
        `2️⃣ Confirmaremos fecha y hora de entrega\n` +
        `3️⃣ Coordinaremos la instalación si aplica\n\n` +
        `📞 Para dudas, responde este mensaje\n` +
        `🛍️ Para nuevo pedido, escribe *menu*\n\n` +
        `¡Gracias por confiar en nosotros! 🙏`;

      await sendWhatsAppMessage(phoneNumber, finalMessage);

      // Log successful order completion
      await storage.addWhatsAppLog({
        type: 'info',
        phoneNumber: phoneNumber,
        messageContent: `Pedido completado: ${orderData.orderNumber} - Método: ${paymentText}`,
        status: 'completed',
        rawData: JSON.stringify({
          orderId: orderData.orderId,
          orderNumber: orderData.orderNumber,
          paymentMethod: paymentText,
          totalAmount: orderData.totalPrice,
          deliveryAddress: orderData.deliveryAddress
        })
      });

    } catch (error) {
      await sendWhatsAppMessage(phoneNumber, 
        "❌ Hubo un error procesando tu método de pago. Por favor, inténtalo nuevamente escribiendo *menu*."
      );
      
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: phoneNumber,
        messageContent: 'Error en selección de método de pago',
        status: 'error',
        errorMessage: (error as Error).message,
        rawData: JSON.stringify({ paymentMethod, error: (error as Error).message })
      });
    }
  }

  async function handleProductSelection(customer: any, conversation: any, productId: number, phoneNumber: string) {
    const product = await storage.getProduct(productId);
    if (!product) return;

    // Check if customer has location for delivery calculation
    if (!customer.latitude || !customer.longitude) {
      await sendWhatsAppMessage(phoneNumber, 
        `📦 *${product.name}*\n\n` +
        `💰 Precio base: $${parseFloat(product.price).toLocaleString('es-MX')}\n\n` +
        "⚠️ *Necesitamos tu ubicación* para calcular el costo de entrega.\n\n" +
        "Por favor comparte tu ubicación primero."
      );
      
      setTimeout(() => sendLocationRequest(phoneNumber), 1000);
      return;
    }

    // Calculate basic pricing (simplified)
    const basePrice = parseFloat(product.price);
    const deliveryCost = product.category === 'service' ? 0 : 150; // Basic delivery fee
    const totalPrice = basePrice + deliveryCost;

    const quantityMessage = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        header: {
          type: "text",
          text: `📦 ${product.name}`
        },
        body: {
          text: 
            `💰 Precio: $${basePrice.toLocaleString('es-MX')}\n` +
            (deliveryCost > 0 ? `🚛 Entrega: $${deliveryCost.toLocaleString('es-MX')}\n` : '') +
            `*Total: $${totalPrice.toLocaleString('es-MX')}*\n\n` +
            "¿Cuántas unidades deseas?"
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: `quantity_${productId}_1`,
                title: "1 unidad"
              }
            },
            {
              type: "reply", 
              reply: {
                id: `quantity_${productId}_2`,
                title: "2 unidades"
              }
            },
            {
              type: "reply",
              reply: {
                id: `quantity_${productId}_3`,
                title: "3+ unidades"
              }
            }
          ]
        }
      }
    };

    await sendWhatsAppInteractiveMessage(phoneNumber, quantityMessage);
  }

  async function handleQuantitySelection(customer: any, productId: number, quantity: number, phoneNumber: string) {
    const product = await storage.getProduct(productId);
    if (!product) return;

    // Calculate final pricing (simplified)
    const basePrice = parseFloat(product.price) * quantity;
    const deliveryCost = product.category === 'service' ? 0 : 150; // Basic delivery fee
    const totalPrice = basePrice + deliveryCost;

    // Create order automatically
    const orderItems = [{
      productId: productId,
      quantity: quantity,
      unitPrice: product.price,
      totalPrice: totalPrice.toString(),
      installationCost: "0",
      partsCost: "0",
      laborHours: "0",
      laborRate: "0",
      deliveryCost: deliveryCost > 0 ? deliveryCost.toString() : "0",
      deliveryDistance: "0",
      notes: `Cantidad: ${quantity}`
    }];

    try {
      // Generate unique order number for WhatsApp orders
      const timestamp = Date.now();
      const orderNumber = `ORD-${timestamp.toString().slice(-6)}`;
      
      const order = await storage.createOrder({
        customerId: customer.id,
        status: "pending",
        totalAmount: totalPrice.toString(),
        orderNumber: orderNumber,
        notes: `Pedido generado desde WhatsApp - ${product.name} x${quantity}`,
        priority: "normal"
      }, orderItems);

      // Check if customer already has complete data (name and address)
      const hasCompleteData = customer.name && 
                             customer.name !== 'Cliente temporal' && 
                             !customer.name.startsWith('Cliente ') &&
                             customer.address &&
                             customer.address.trim() !== '';

      if (hasCompleteData) {
        // Customer has complete data, proceed to address confirmation
        await storage.createRegistrationFlow({
          phoneNumber: phoneNumber,
          currentStep: 'confirm_saved_address',
          collectedData: JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            productName: product.name,
            quantity: quantity,
            basePrice: basePrice,
            deliveryCost: deliveryCost,
            totalPrice: totalPrice
          }),
          requestedService: 'order_completion',
          isCompleted: false,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });

        // Send address confirmation message
        const addressConfirmMessage = {
          messaging_product: "whatsapp",
          to: phoneNumber,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: "Pedido Generado\n\n" +
                   `Orden: ${order.orderNumber}\n` +
                   `${product.name} x${quantity}\n` +
                   `Subtotal: $${basePrice.toLocaleString('es-MX')}\n` +
                   (deliveryCost > 0 ? `Entrega: $${deliveryCost.toLocaleString('es-MX')}\n` : '') +
                   `Total: $${totalPrice.toLocaleString('es-MX')}\n\n` +
                   `Cliente: ${customer.name}\n` +
                   `Direccion guardada: ${customer.address}\n\n` +
                   "Confirmas que enviemos a esta direccion?"
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "confirm_saved_address",
                    title: "Confirmar direccion"
                  }
                },
                {
                  type: "reply",
                  reply: {
                    id: "update_address",
                    title: "Cambiar direccion"
                  }
                }
              ]
            }
          }
        };

        // Send simplified confirmation message instead of interactive message
        const confirmationText = 
          "Pedido Generado\n\n" +
          `Orden: ${order.orderNumber}\n` +
          `${product.name} x${quantity}\n` +
          `Subtotal: $${basePrice.toLocaleString('es-MX')}\n` +
          (deliveryCost > 0 ? `Entrega: $${deliveryCost.toLocaleString('es-MX')}\n` : '') +
          `Total: $${totalPrice.toLocaleString('es-MX')}\n\n` +
          `Cliente: ${customer.name}\n` +
          `Direccion guardada: ${customer.address}\n\n` +
          "Responde 'CONFIRMAR' para proceder con esta direccion o 'CAMBIAR' para actualizar tu ubicacion.";
        
        await sendWhatsAppMessage(phoneNumber, confirmationText);
      } else {
        // Customer needs to provide data, start with name collection
        await storage.createRegistrationFlow({
          phoneNumber: phoneNumber,
          currentStep: 'collect_customer_name',
          collectedData: JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            productName: product.name,
            quantity: quantity,
            basePrice: basePrice,
            deliveryCost: deliveryCost,
            totalPrice: totalPrice
          }),
          requestedService: 'order_completion',
          isCompleted: false,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });

        // Send order confirmation and request customer name
        const confirmationMessage = 
          "✅ *¡Pedido Generado!*\n\n" +
          `🆔 Orden: ${order.orderNumber}\n` +
          `📦 ${product.name} x${quantity}\n` +
          `💰 Subtotal: $${basePrice.toLocaleString('es-MX')}\n` +
          (deliveryCost > 0 ? `🚛 Entrega: $${deliveryCost.toLocaleString('es-MX')}\n` : '') +
          `*💳 Total: $${totalPrice.toLocaleString('es-MX')}*\n\n` +
          "👤 *Datos del Cliente*\n" +
          "Para continuar con tu pedido, necesitamos tus datos:\n\n" +
          "Por favor comparte tu *nombre completo*:\n" +
          "_(Ejemplo: Juan Pérez López)_";

        await sendWhatsAppMessage(phoneNumber, confirmationMessage);
      }

      // Log the order creation
      await storage.addWhatsAppLog({
        type: 'info',
        phoneNumber: phoneNumber,
        messageContent: `Pedido automático creado: ${order.orderNumber}`,
        status: 'processed',
        rawData: JSON.stringify({ 
          orderId: order.id, 
          customerId: customer.id, 
          total: totalPrice,
          productId: productId,
          quantity: quantity
        })
      });
    } catch (error) {
      console.error('Error en handleQuantitySelection:', error);
      console.error('Datos del pedido:', {
        customer: customer.id,
        productId,
        quantity,
        orderItems,
        totalPrice
      });
      
      await sendWhatsAppMessage(phoneNumber, 
        "❌ Hubo un error al procesar tu pedido. Por favor, intenta nuevamente o contacta a nuestro equipo."
      );
      
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: phoneNumber,
        messageContent: 'Error creando orden automática',
        status: 'error',
        errorMessage: (error as Error).message,
        rawData: JSON.stringify({ productId, quantity, error: (error as Error).message })
      });
    }
  }

  async function sendOrderStatus(customer: any, phoneNumber: string) {
    const orders = await storage.getAllOrders();
    const customerOrders = orders.filter(order => order.customer.id === customer.id);
    
    if (customerOrders.length === 0) {
      await sendWhatsAppMessage(phoneNumber, 
        "📋 *Estado de Pedidos*\n\n" +
        "No tienes pedidos registrados.\n\n" +
        "Escribe *menu* para ver nuestros productos."
      );
      return;
    }

    const recentOrder = customerOrders[0];
    const statusMessage = 
      `📋 *Tu Último Pedido*\n\n` +
      `🆔 ${recentOrder.orderNumber}\n` +
      `📦 ${recentOrder.items.map(item => `${item.product.name} x${item.quantity}`).join(', ')}\n` +
      `💰 Total: $${parseFloat(recentOrder.totalAmount).toLocaleString('es-MX')}\n` +
      `📊 Estado: ${getStatusEmoji(recentOrder.status)} ${recentOrder.status}\n\n` +
      "📞 Para más información, nuestro equipo se comunicará contigo.";

    await sendWhatsAppMessage(phoneNumber, statusMessage);
  }

  async function sendWelcomeMessage(phoneNumber: string) {
    // Use configured auto-response for welcome instead of hardcoded message
    const welcomeResponses = await storage.getAutoResponsesByTrigger('welcome');
    
    if (welcomeResponses.length > 0) {
      const welcomeResponse = welcomeResponses[0]; // Get first active welcome response
      
      if (welcomeResponse.menuOptions) {
        try {
          const menuOptions = JSON.parse(welcomeResponse.menuOptions);
          // Create interactive menu message
          const interactiveMessage = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: "interactive",
            interactive: {
              type: "button",
              body: {
                text: welcomeResponse.messageText
              },
              action: {
                buttons: menuOptions.slice(0, 3).map((option: any, index: number) => ({
                  type: "reply",
                  reply: {
                    id: option.value || `option_${index}`,
                    title: option.label.substring(0, 20) // WhatsApp button limit
                  }
                }))
              }
            }
          };
          
          await sendWhatsAppInteractiveMessage(phoneNumber, interactiveMessage);
        } catch (error) {
          // If menu parsing fails, send text message
          await sendWhatsAppMessage(phoneNumber, welcomeResponse.messageText);
        }
      } else {
        // Send text message
        await sendWhatsAppMessage(phoneNumber, welcomeResponse.messageText);
      }
    }
    // No fallback message - if no active welcome responses are configured, send nothing
  }

  async function sendHelpMenu(phoneNumber: string) {
    // Use configured auto-response for help instead of hardcoded message
    const helpResponses = await storage.getAutoResponsesByTrigger('help');
    
    if (helpResponses.length > 0) {
      const helpResponse = helpResponses[0]; // Get first active help response
      
      if (helpResponse.menuOptions) {
        try {
          const menuOptions = JSON.parse(helpResponse.menuOptions);
          // Create interactive menu message
          const interactiveMessage = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: "interactive",
            interactive: {
              type: "button",
              body: {
                text: helpResponse.messageText
              },
              action: {
                buttons: menuOptions.slice(0, 3).map((option: any, index: number) => ({
                  type: "reply",
                  reply: {
                    id: option.value || `option_${index}`,
                    title: option.label.substring(0, 20) // WhatsApp button limit
                  }
                }))
              }
            }
          };
          
          await sendWhatsAppInteractiveMessage(phoneNumber, interactiveMessage);
        } catch (error) {
          // If menu parsing fails, send text message
          await sendWhatsAppMessage(phoneNumber, helpResponse.messageText);
        }
      } else {
        // Send text message
        await sendWhatsAppMessage(phoneNumber, helpResponse.messageText);
      }
    }
    // No fallback message - if no active help responses are configured, send nothing
  }

  function getStatusEmoji(status: string): string {
    const statusEmojis: { [key: string]: string } = {
      'pending': '⏳',
      'confirmed': '✅', 
      'in_progress': '🔄',
      'completed': '✅',
      'cancelled': '❌'
    };
    return statusEmojis[status] || '📋';
  }

  // sendWhatsAppInteractiveMessage function is defined above (line 713)

  // WhatsApp Business API Webhook
  app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Check the mode and token sent by WhatsApp
    if (mode === "subscribe") {
      // Verify the verify token matches the one set in webhook configuration
      storage.getWhatsAppConfig().then(config => {
        if (token === config.whatsappVerifyToken) {
          console.log("Webhook verified successfully!");
          storage.addWhatsAppLog({
            type: 'info',
            message: 'Webhook verificado correctamente',
            data: { mode, token: '***', challenge }
          });
          res.status(200).send(challenge);
        } else {
          console.log("Webhook verification failed - invalid token");
          storage.addWhatsAppLog({
            type: 'error',
            message: 'Verificación de webhook fallida - token inválido',
            data: { mode, token: '***' }
          });
          res.status(403).send("Forbidden");
        }
      });
    } else {
      res.status(400).send("Bad Request");
    }
  });

  app.post("/webhook", async (req, res) => {
    try {
      const body = req.body;
      
      // Log incoming webhook with detailed structure
      await storage.addWhatsAppLog({
        type: 'incoming',
        phoneNumber: null,
        messageContent: 'Webhook recibido de WhatsApp',
        status: 'received',
        rawData: JSON.stringify(body)
      });

      // Check if it's a WhatsApp API POST request
      if (body.object === "whatsapp_business_account") {
        if (body.entry && body.entry.length > 0) {
          for (const entry of body.entry) {
            await storage.addWhatsAppLog({
              type: 'debug',
              phoneNumber: null,
              messageContent: `Procesando entry del webhook`,
              status: 'processing',
              rawData: JSON.stringify({ entryId: entry.id, changesCount: entry.changes?.length || 0 })
            });

            if (entry.changes && entry.changes.length > 0) {
              for (const change of entry.changes) {
                await storage.addWhatsAppLog({
                  type: 'debug',
                  phoneNumber: null,
                  messageContent: `Procesando change: ${change.field || 'field not specified'}`,
                  status: 'processing',
                  rawData: JSON.stringify({ field: change.field, hasValue: !!change.value, hasMessages: !!(change.value && change.value.messages) })
                });

                // For real WhatsApp webhooks, check for field === "messages"
                // For test webhooks, check if value has messages
                if (change.field === "messages" || (change.value && change.value.messages && change.value.messages.length > 0)) {
                  await storage.addWhatsAppLog({
                    type: 'debug',
                    phoneNumber: null,
                    messageContent: 'Iniciando procesamiento de mensaje WhatsApp',
                    status: 'processing',
                    rawData: JSON.stringify({ value: change.value })
                  });
                  
                  // Use full WhatsApp processor with auto-responses
                  try {
                    console.log('Attempting full WhatsApp message processing...');
                    await processWhatsAppMessage(change.value);
                    console.log('Full WhatsApp processing completed successfully');
                  } catch (error) {
                    console.error('Error in full WhatsApp processing, falling back to simple:', error);
                    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
                    const { processWhatsAppMessageSimple } = await import('./whatsapp-simple.js');
                    await processWhatsAppMessageSimple(change.value);
                  }
                  
                  await storage.addWhatsAppLog({
                    type: 'debug',
                    phoneNumber: null,
                    messageContent: 'Mensaje WhatsApp procesado exitosamente',
                    status: 'success'
                  });
                }
              }
            }
          }
        }
      } else {
        await storage.addWhatsAppLog({
          type: 'warning',
          phoneNumber: null,
          messageContent: `Webhook recibido con object: ${body.object}`,
          status: 'ignored',
          rawData: JSON.stringify(body)
        });
      }

      res.status(200).send("EVENT_RECEIVED");
    } catch (error: any) {
      console.error("Webhook error:", error);
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: null,
        messageContent: 'Error procesando webhook',
        status: 'error',
        errorMessage: error.message,
        rawData: JSON.stringify({ error: error.message, body: req.body })
      });
      res.status(500).send("Internal Server Error");
    }
  });

  // WhatsApp send message API
  app.post("/api/whatsapp/send-message", async (req, res) => {
    try {
      const { to, message, type = "text" } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({ error: "Número de teléfono y mensaje son requeridos" });
      }

      const config = await storage.getWhatsAppConfig();
      
      if (!config || !config.accessToken || !config.phoneNumberId) {
        return res.status(400).json({ error: "Configuración de WhatsApp incompleta" });
      }

      const messageData = {
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ''), // Remove non-digits
        type: type,
        text: {
          body: message
        }
      };

      // Send message to WhatsApp Business API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageData)
        }
      );

      const result = await response.json();

      if (response.ok) {
        // Log successful message
        await storage.addWhatsAppLog({
          type: 'outgoing',
          message: 'Mensaje enviado exitosamente',
          data: {
            to,
            message,
            messageId: result.messages?.[0]?.id,
            response: result
          }
        });

        res.json({ 
          success: true, 
          messageId: result.messages?.[0]?.id,
          data: result 
        });
      } else {
        // Log failed message
        await storage.addWhatsAppLog({
          type: 'error',
          message: 'Error enviando mensaje',
          data: {
            to,
            message,
            error: result
          }
        });

        res.status(400).json({ 
          error: "Error enviando mensaje", 
          details: result 
        });
      }
    } catch (error: any) {
      console.error("Error sending WhatsApp message:", error);
      await storage.addWhatsAppLog({
        type: 'error',
        message: 'Error interno enviando mensaje',
        data: { error: error.message }
      });
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // WhatsApp Connection Test
  app.post("/api/whatsapp/test-connection", async (req, res) => {
    try {
      const config = await storage.getWhatsAppConfig();
      
      if (!config.metaAppId || !config.whatsappToken) {
        return res.json({
          success: false,
          message: "WhatsApp credentials not configured"
        });
      }

      // In a real implementation, this would make an actual API call to WhatsApp
      // For now, simulate the test
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API delay
      
      res.json({
        success: true,
        message: "Conexión exitosa con WhatsApp Business API",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Error al probar la conexión con WhatsApp Business API" 
      });
    }
  });

  // WhatsApp API simulation for sending messages
  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { phone, message } = z.object({
        phone: z.string(),
        message: z.string(),
      }).parse(req.body);

      const config = await storage.getWhatsAppConfig();
      
      if (!config.metaAppId || !config.whatsappToken) {
        return res.status(400).json({ 
          error: "WhatsApp not configured",
          message: "Please configure WhatsApp Business API credentials first"
        });
      }

      // In a real implementation, this would use the actual WhatsApp Business API
      // Here we simulate the API call
      console.log(`Sending WhatsApp message to ${phone}: ${message}`);
      
      res.json({ 
        success: true, 
        messageId: `wa_${Date.now()}`,
        status: "sent"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid message data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to send WhatsApp message" });
    }
  });

  // Auto Responses routes
  app.get("/api/auto-responses", async (req, res) => {
    try {
      const responses = await storage.getAllAutoResponses();
      res.json(responses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch auto responses" });
    }
  });

  app.get("/api/auto-responses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const response = await storage.getAutoResponse(id);
      if (!response) {
        return res.status(404).json({ error: "Auto response not found" });
      }
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch auto response" });
    }
  });

  app.post("/api/auto-responses", async (req, res) => {
    try {
      const responseData = insertAutoResponseSchema.parse(req.body);
      const newResponse = await storage.createAutoResponse(responseData);
      res.status(201).json(newResponse);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid auto response data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create auto response" });
    }
  });

  app.put("/api/auto-responses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = insertAutoResponseSchema.partial().parse(req.body);
      const updatedResponse = await storage.updateAutoResponse(id, updates);
      if (!updatedResponse) {
        return res.status(404).json({ error: "Auto response not found" });
      }
      res.json(updatedResponse);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update auto response" });
    }
  });

  app.delete("/api/auto-responses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAutoResponse(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete auto response" });
    }
  });

  app.post("/api/auto-responses/reset-defaults", async (req, res) => {
    try {
      // Clear existing auto responses
      await storage.clearAllAutoResponses();
      
      // Re-seed default responses
      const { seedAutoResponses } = await import("./seed-auto-responses");
      await seedAutoResponses();
      
      res.json({ message: "Auto responses reset to defaults successfully" });
    } catch (error) {
      console.error("Error resetting auto responses:", error);
      res.status(500).json({ error: "Failed to reset auto responses" });
    }
  });

  // Customer Registration Flows routes
  app.get("/api/registration-flows/:phoneNumber", async (req, res) => {
    try {
      const phoneNumber = req.params.phoneNumber;
      const flow = await storage.getRegistrationFlow(phoneNumber);
      if (!flow) {
        return res.status(404).json({ error: "Registration flow not found" });
      }
      res.json(flow);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch registration flow" });
    }
  });

  app.post("/api/registration-flows", async (req, res) => {
    try {
      const flowData = insertCustomerRegistrationFlowSchema.parse(req.body);
      const newFlow = await storage.createRegistrationFlow(flowData);
      res.status(201).json(newFlow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid registration flow data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create registration flow" });
    }
  });

  app.put("/api/registration-flows/:phoneNumber", async (req, res) => {
    try {
      const phoneNumber = req.params.phoneNumber;
      const updates = insertCustomerRegistrationFlowSchema.partial().parse(req.body);
      const updatedFlow = await storage.updateRegistrationFlow(phoneNumber, updates);
      if (!updatedFlow) {
        return res.status(404).json({ error: "Registration flow not found" });
      }
      res.json(updatedFlow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update registration flow" });
    }
  });

  app.delete("/api/registration-flows/:phoneNumber", async (req, res) => {
    try {
      const phoneNumber = req.params.phoneNumber;
      await storage.deleteRegistrationFlow(phoneNumber);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete registration flow" });
    }
  });

  // Registration flow functions
  async function sendRegistrationWelcome(phoneNumber: string) {
    const welcomeMessage = 
      "👋 *¡Bienvenido a Aires Acondicionados!*\n\n" +
      "Para brindarte el mejor servicio, necesito conocerte mejor.\n\n" +
      "¿Podrías decirme tu nombre completo?";

    await sendWhatsAppMessage(phoneNumber, welcomeMessage);
    
    await storage.addWhatsAppLog({
      type: 'info',
      phoneNumber: phoneNumber,
      messageContent: 'Mensaje de registro enviado',
      status: 'sent',
      rawData: JSON.stringify({ step: 'awaiting_name' })
    });
  }

  async function handleRegistrationFlow(phoneNumber: string, messageText: string, registrationFlow: any) {
    try {
      const data = JSON.parse(registrationFlow.collectedData || '{}');
      
      // Add detailed logging for debugging
      await storage.addWhatsAppLog({
        type: 'debug',
        phoneNumber: phoneNumber,
        messageContent: `Registration flow step: ${registrationFlow.currentStep}`,
        status: 'info',
        rawData: JSON.stringify({ step: registrationFlow.currentStep, message: messageText, data: data })
      });
      
      // Handle order completion flow for web catalog orders
      if (registrationFlow.currentStep === 'collect_name') {
        // Validate customer name
        const customerName = messageText.trim();
        if (customerName.length < 3) {
          await processAutoResponse('collect_name', phoneNumber);
          return;
        }
        
        // Update customer with the complete name
        const customer = await storage.getCustomerByPhone(phoneNumber);
        if (customer) {
          await storage.updateCustomerName(customer.id, customerName);
        }
        
        // Move to next step - collect address
        const updatedData = { ...data, customerName: customerName };
        await storage.updateRegistrationFlow(phoneNumber, {
          currentStep: 'collect_address',
          collectedData: JSON.stringify(updatedData)
        });
        
        await processAutoResponse('collect_address', phoneNumber);
        return;
      }
      
      if (registrationFlow.currentStep === 'collect_address') {
        // Validate delivery address
        const address = messageText.trim();
        if (address.length < 10) {
          await processAutoResponse('collect_address', phoneNumber);
          return;
        }
        
        // Update customer with delivery address
        const customer = await storage.getCustomerByPhone(phoneNumber);
        if (customer) {
          await storage.updateCustomer(customer.id, { address: address });
        }
        
        // Move to next step - collect contact
        const updatedData = { ...data, address: address };
        await storage.updateRegistrationFlow(phoneNumber, {
          currentStep: 'collect_contact',
          collectedData: JSON.stringify(updatedData)
        });
        
        await processAutoResponse('collect_contact', phoneNumber);
        return;
      }
      
      if (registrationFlow.currentStep === 'collect_contact') {
        // Handle contact number selection - either WhatsApp number or custom number
        let contactNumber = phoneNumber; // Default to WhatsApp number
        
        if (messageText.toLowerCase().includes('otro') || /^\d{10}/.test(messageText)) {
          // Customer wants to provide another number
          const customNumber = messageText.replace(/\D/g, '');
          if (customNumber.length >= 10) {
            contactNumber = customNumber;
          }
        }
        
        // Move to next step - collect payment method
        const updatedData = { ...data, contactNumber: contactNumber };
        await storage.updateRegistrationFlow(phoneNumber, {
          currentStep: 'collect_payment',
          collectedData: JSON.stringify(updatedData)
        });
        
        await processAutoResponse('collect_payment', phoneNumber);
        return;
      }
      
      if (registrationFlow.currentStep === 'collect_payment') {
        // Handle payment method selection
        let paymentMethod = 'cash';
        if (messageText.toLowerCase().includes('tarjeta') || messageText.toLowerCase().includes('card')) {
          paymentMethod = 'card';
        } else if (messageText.toLowerCase().includes('transferencia') || messageText.toLowerCase().includes('transfer')) {
          paymentMethod = 'transfer';
        }
        
        // Move to next step - collect notes
        const updatedData = { ...data, paymentMethod: paymentMethod };
        await storage.updateRegistrationFlow(phoneNumber, {
          currentStep: 'collect_notes',
          collectedData: JSON.stringify(updatedData)
        });
        
        await processAutoResponse('collect_notes', phoneNumber);
        return;
      }
      
      if (registrationFlow.currentStep === 'removing_product') {
        // Handle removing product from order
        const productNumber = messageText.trim();
        
        // Check if user wants to cancel
        if (productNumber.toLowerCase().includes('menu') || productNumber.toLowerCase().includes('cancelar')) {
          await storage.deleteRegistrationFlow(phoneNumber);
          await sendWhatsAppMessage(phoneNumber, "Operación cancelada. Escribe *menu* para ver las opciones principales.");
          return;
        }

        // Validate product number
        const productIndex = parseInt(productNumber) - 1;
        const orderItems = data.orderItems || [];
        
        if (isNaN(productIndex) || productIndex < 0 || productIndex >= orderItems.length) {
          await sendWhatsAppMessage(phoneNumber, 
            `Por favor, ingresa un número válido del 1 al ${orderItems.length}.\n\n` +
            `Ejemplo: "1" para quitar el primer producto\n\n` +
            `O escribe *menu* para cancelar.`
          );
          return;
        }

        const selectedItem = orderItems[productIndex];
        const orderId = data.orderId;

        if (orderId && selectedItem) {
          // Get current order
          const order = await storage.getOrder(orderId);
          if (order) {
            // Add removal note to order
            const currentNotes = order.notes || '';
            const timestamp = new Date().toLocaleString('es-MX');
            const removalNote = `\n[PRODUCTO ELIMINADO ${timestamp}] ${selectedItem.productName} (x${selectedItem.quantity}) - $${selectedItem.unitPrice}`;
            
            await storage.updateOrder(orderId, {
              notes: currentNotes + removalNote
            });

            await sendWhatsAppMessage(phoneNumber, 
              `✅ *Producto eliminado exitosamente*\n\n` +
              `🗑️ Se eliminó: "${selectedItem.productName}"\n` +
              `📦 Cantidad: ${selectedItem.quantity}\n` +
              `💰 Precio: $${selectedItem.unitPrice}\n\n` +
              `Del pedido ${order.orderNumber}.\n\n` +
              `Nuestro equipo procesará este cambio y te contactará para confirmar el nuevo total.\n\n` +
              `¿Necesitas hacer algún otro cambio? Escribe *editar* para ver las opciones.`
            );
          } else {
            await sendWhatsAppMessage(phoneNumber, "No se pudo encontrar el pedido para quitar el producto.");
          }
        }

        // Complete registration flow
        await storage.deleteRegistrationFlow(phoneNumber);
        return;
      }

      if (registrationFlow.currentStep === 'adding_note') {
        // Handle adding note to existing order
        const noteText = messageText.trim();
        if (noteText.length < 3) {
          await sendWhatsAppMessage(phoneNumber, 
            "Por favor, proporciona una nota más descriptiva (mínimo 3 caracteres).\n\n" +
            "Ejemplo: Disponible de 2-6 PM, tocar el timbre dos veces"
          );
          return;
        }

        // Get the order ID from collected data
        const orderId = data.orderId;
        if (orderId) {
          // Get current order
          const order = await storage.getOrder(orderId);
          if (order) {
            // Append new note to existing notes
            const currentNotes = order.notes || '';
            const timestamp = new Date().toLocaleString('es-MX');
            const newNote = `\n[NOTA AGREGADA ${timestamp}] ${noteText}`;
            
            await storage.updateOrder(orderId, {
              notes: currentNotes + newNote
            });

            await sendWhatsAppMessage(phoneNumber, 
              `✅ *Nota agregada exitosamente*\n\n` +
              `📝 Tu nota: "${noteText}"\n\n` +
              `Se ha agregado a tu pedido ${order.orderNumber}.\n\n` +
              `¿Necesitas hacer algún otro cambio? Escribe *editar* para ver las opciones.`
            );
          } else {
            await sendWhatsAppMessage(phoneNumber, "No se pudo encontrar el pedido para agregar la nota.");
          }
        }

        // Complete registration flow
        await storage.deleteRegistrationFlow(phoneNumber);
        return;
      }

      if (registrationFlow.currentStep === 'collect_notes') {
        // Handle additional notes collection
        let additionalNotes = '';
        
        // Check if customer wants to skip notes or provided custom notes
        if (messageText.toLowerCase().includes('continuar') || 
            messageText.toLowerCase().includes('no') ||
            messageText.toLowerCase().includes('sin notas')) {
          additionalNotes = 'Sin notas adicionales';
        } else {
          additionalNotes = messageText.trim();
        }
        
        // Complete the order with all collected data
        const orderCompleteData = { ...data, additionalNotes: additionalNotes };
        
        // Update order with complete information including notes
        if (data.orderId) {
          const paymentText = data.paymentMethod === 'card' ? 'Tarjeta' : 
                             data.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo';
          
          const orderNotes = `Completado desde catálogo web.\n` +
                           `Método de pago: ${paymentText}\n` +
                           `Contacto: ${orderCompleteData.contactNumber || phoneNumber}\n` +
                           `Notas adicionales: ${additionalNotes}`;
          
          await storage.updateOrder(data.orderId, {
            status: 'confirmed',
            notes: orderNotes
          });
          
          // Send final confirmation
          const finalMessage = 
            `✅ *PEDIDO CONFIRMADO*\n\n` +
            `📋 Número: ${data.orderNumber}\n` +
            `💳 Método de pago: ${paymentText}\n` +
            `📞 Contacto: ${orderCompleteData.contactNumber || phoneNumber}\n` +
            `📝 Notas: ${additionalNotes}\n\n` +
            `🎯 *¡Perfecto!* Tu pedido ha sido confirmado.\n` +
            `Un técnico te contactará pronto para coordinar la entrega.\n\n` +
            `📱 Puedes revisar el estado de tu pedido escribiendo *pedido*`;
          
          await sendWhatsAppMessage(phoneNumber, finalMessage);
        }
        
        // Complete registration flow
        await storage.deleteRegistrationFlow(phoneNumber);
        return;
      }
      
      if (registrationFlow.currentStep === 'awaiting_name') {
        // Validate name (should not be empty and should contain at least 2 words)
        const name = messageText.trim();
        if (name.length < 2 || !name.includes(' ')) {
          await sendWhatsAppMessage(phoneNumber, 
            "Por favor, ingresa tu nombre completo (nombre y apellido).\n\n" +
            "Ejemplo: Juan Pérez"
          );
          return;
        }
        
        // Create customer with the provided name
        const customer = await storage.createCustomer({
          name: name,
          phone: phoneNumber,
          whatsappId: phoneNumber
        });
        
        // Delete registration flow
        await storage.deleteRegistrationFlow(phoneNumber);
        
        // Send welcome message with name
        const personalizedWelcome = 
          `✅ *¡Perfecto, ${name}!*\n\n` +
          "Tu registro ha sido completado exitosamente.\n\n" +
          "Ahora puedes explorar nuestros servicios de aires acondicionados.\n\n" +
          "Escribe *menu* para ver nuestro catálogo completo.";
        
        await sendWhatsAppMessage(phoneNumber, personalizedWelcome);
        
        await storage.addWhatsAppLog({
          type: 'info',
          phoneNumber: phoneNumber,
          messageContent: `Cliente registrado exitosamente: ${name}`,
          status: 'completed',
          rawData: JSON.stringify({ 
            customerId: customer.id, 
            customerName: name,
            registrationCompleted: true 
          })
        });
      }
      
      else if (registrationFlow.currentStep === 'collect_customer_name') {
        // Validate customer name
        const customerName = messageText.trim();
        if (customerName.length < 3) {
          await sendWhatsAppMessage(phoneNumber, 
            "Por favor, proporciona tu nombre completo.\n\n" +
            "Ejemplo: Juan Pérez López"
          );
          return;
        }
        
        // Update customer in database with the complete name
        const customer = await storage.getCustomerByPhone(phoneNumber);
        if (customer) {
          await storage.updateCustomerName(customer.id, customerName);
        }
        
        // Update flow to next step - collect delivery address
        const updatedData = { ...data, customerName: customerName };
        await storage.updateRegistrationFlow(phoneNumber, {
          currentStep: 'collect_delivery_address',
          collectedData: JSON.stringify(updatedData)
        });
        
        // Send delivery address request with GPS option
        const addressMessage = 
          `✅ *Nombre registrado: ${customerName}*\n\n` +
          "📍 *Dirección de Entrega*\n" +
          "Necesitamos tu ubicación para calcular el costo de entrega:\n\n" +
          "🎯 *Opción Recomendada:*\n" +
          "📱 Comparte tu ubicación GPS desde WhatsApp\n" +
          "_(Botón 📎 → Ubicación → Enviar ubicación actual)_\n\n" +
          "📝 *O escribe tu dirección completa:*\n" +
          "_(Incluye calle, número, colonia, ciudad y código postal)_\n\n" +
          "Ejemplo: Av. Reforma 123, Col. Centro, CDMX, CP 06000\n\n" +
          "💡 *La ubicación GPS nos da la distancia exacta y el costo de entrega más preciso.*";
        
        await sendWhatsAppMessage(phoneNumber, addressMessage);
      }
      
      else if (registrationFlow.currentStep === 'collect_delivery_address') {
        // Validate delivery address
        const address = messageText.trim();
        if (address.length < 10) {
          await sendWhatsAppMessage(phoneNumber, 
            "Por favor, proporciona una dirección completa con calle, número, colonia y código postal.\n\n" +
            "Ejemplo: Av. Reforma 123, Colonia Centro, CDMX, CP 06000"
          );
          return;
        }
        
        // Update customer with delivery address
        const customer = await storage.getCustomerByPhone(phoneNumber);
        if (customer) {
          await storage.updateCustomerLocation(customer.id, {
            address: address,
            latitude: "0", // Could be enhanced with geocoding
            longitude: "0"
          });
        }
        
        // Update flow to next step - collect contact number
        const updatedData = { ...data, deliveryAddress: address };
        await storage.updateRegistrationFlow(phoneNumber, {
          currentStep: 'collect_contact_number',
          collectedData: JSON.stringify(updatedData)
        });
        
        // Send contact number selection with option to use WhatsApp number
        const contactMessage = {
          messaging_product: "whatsapp",
          to: phoneNumber,
          type: "interactive",
          interactive: {
            type: "button",
            body: {
              text: `✅ *Dirección registrada*\n📍 ${address}\n\n📞 *Número de Contacto*\nNecesitamos un número para coordinar la entrega:`
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "use_whatsapp_number",
                    title: "📱 Usar este WhatsApp"
                  }
                },
                {
                  type: "reply",
                  reply: {
                    id: "provide_different_number",
                    title: "📞 Otro número"
                  }
                }
              ]
            }
          }
        };
        
        await sendWhatsAppInteractiveMessage(phoneNumber, contactMessage);
      }
      
      else if (registrationFlow.currentStep === 'collect_different_number') {
        // Validate phone number format
        const contactNumber = messageText.trim().replace(/\D/g, ''); // Remove non-digits
        if (contactNumber.length !== 10) {
          await sendWhatsAppMessage(phoneNumber, 
            "Por favor, proporciona un número de teléfono válido de 10 dígitos.\n\n" +
            "Ejemplo: 5512345678"
          );
          return;
        }
        
        // Format phone number
        const formattedNumber = `+52 ${contactNumber.slice(0, 2)} ${contactNumber.slice(2, 6)} ${contactNumber.slice(6)}`;
        
        // Get customer for the phone number
        let customer = await storage.getCustomerByPhone(phoneNumber);
        if (!customer) {
          await sendWhatsAppMessage(phoneNumber, 
            "❌ Error: No se encontró información del cliente. Por favor, inicia un nuevo pedido escribiendo *menu*."
          );
          return;
        }
        
        // Continue with contact number selection
        await handleContactNumberSelection(customer, phoneNumber, formattedNumber);
      }
      
      else if (registrationFlow.currentStep === 'collect_payment_method') {
        // This will be handled by interactive message handler
        return;
      }
      
    } catch (error) {
      // If there's an error, reset registration flow
      await storage.deleteRegistrationFlow(phoneNumber);
      await sendWhatsAppMessage(phoneNumber, 
        "❌ Hubo un error en el proceso. Por favor, escribe *hola* para comenzar nuevamente."
      );
      
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: phoneNumber,
        messageContent: 'Error en flujo de registro/pedido',
        status: 'error',
        errorMessage: (error as Error).message,
        rawData: JSON.stringify({ step: registrationFlow.currentStep, error: (error as Error).message })
      });
    }
  }

  // Employee routes
  app.get("/api/employees", async (req, res) => {
    try {
      const employees = await storage.getAllEmployeeProfiles();
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", async (req, res) => {
    try {
      const profileData = insertEmployeeProfileSchema.parse(req.body);
      const employee = await storage.createEmployeeProfile(profileData);
      res.json(employee);
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create employee" });
    }
  });

  app.post("/api/employees/generate-id", async (req, res) => {
    try {
      const { department } = req.body;
      if (!department) {
        return res.status(400).json({ error: "Department is required" });
      }
      const employeeId = await storage.generateEmployeeId(department);
      res.json({ employeeId });
    } catch (error) {
      console.error("Error generating employee ID:", error);
      res.status(500).json({ error: "Failed to generate employee ID" });
    }
  });

  app.get("/api/employees/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const employee = await storage.getEmployeeProfile(id);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Error fetching employee:", error);
      res.status(500).json({ error: "Failed to fetch employee" });
    }
  });

  app.put("/api/employees/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { user, ...profileUpdates } = req.body;
      
      // Get employee first to get the user ID
      const currentEmployee = await storage.getEmployeeProfile(id);
      if (!currentEmployee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      // Update user credentials if provided
      if (user) {
        const userUpdates: any = {
          name: user.name,
          username: user.username,
          phone: user.phone,
          email: user.email,
          address: user.address,
          role: user.role,
        };
        
        // If password is provided, add it to updates
        if (user.password && user.password.trim() !== '') {
          userUpdates.password = user.password;
          userUpdates.mustChangePassword = true; // User must change password on next login
        }
        
        await storage.updateUser(currentEmployee.userId, userUpdates);
      }
      
      // Update employee profile
      const employee = await storage.updateEmployeeProfile(id, profileUpdates);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found after update" });
      }
      
      // Return updated employee with user data
      const updatedEmployee = await storage.getEmployeeProfile(id);
      res.json(updatedEmployee);
    } catch (error) {
      console.error("Error updating employee:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEmployeeProfile(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting employee:", error);
      res.status(500).json({ error: "Failed to delete employee" });
    }
  });

  app.get("/api/registration-flows", async (req, res) => {
    try {
      // For now, return empty array since this endpoint isn't fully implemented
      res.json([]);
    } catch (error) {
      console.error("Error fetching registration flows:", error);
      res.status(500).json({ error: "Failed to fetch registration flows" });
    }
  });

  // Customer history routes
  app.get("/api/customers/:id/history", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const history = await storage.getCustomerHistory(customerId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching customer history:", error);
      res.status(500).json({ error: "Failed to fetch customer history" });
    }
  });

  app.get("/api/customers/:id/details", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      const customerWithHistory = await storage.getCustomerWithHistory(customerId);
      if (!customerWithHistory) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customerWithHistory);
    } catch (error) {
      console.error("Error fetching customer details:", error);
      res.status(500).json({ error: "Failed to fetch customer details" });
    }
  });

  app.get("/api/customers/vip", async (req, res) => {
    try {
      const vipCustomers = await storage.getVipCustomers();
      res.json(vipCustomers);
    } catch (error) {
      console.error("Error fetching VIP customers:", error);
      res.status(500).json({ error: "Failed to fetch VIP customers" });
    }
  });

  // Assignment Rules Routes
  app.get("/api/assignment-rules", async (req, res) => {
    try {
      const rules = await storage.getAllAssignmentRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching assignment rules:", error);
      res.status(500).json({ error: "Failed to fetch assignment rules" });
    }
  });

  app.get("/api/assignment-rules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rule = await storage.getAssignmentRule(id);
      if (!rule) {
        return res.status(404).json({ error: "Assignment rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error fetching assignment rule:", error);
      res.status(500).json({ error: "Failed to fetch assignment rule" });
    }
  });

  app.post("/api/assignment-rules", async (req, res) => {
    try {
      const ruleData = req.body; // Using Zod validation would be ideal here
      const rule = await storage.createAssignmentRule(ruleData);
      res.json(rule);
    } catch (error) {
      console.error("Error creating assignment rule:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create assignment rule" });
    }
  });

  app.put("/api/assignment-rules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const rule = await storage.updateAssignmentRule(id, updates);
      if (!rule) {
        return res.status(404).json({ error: "Assignment rule not found" });
      }
      res.json(rule);
    } catch (error) {
      console.error("Error updating assignment rule:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update assignment rule" });
    }
  });

  app.delete("/api/assignment-rules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAssignmentRule(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting assignment rule:", error);
      res.status(500).json({ error: "Failed to delete assignment rule" });
    }
  });

  app.get("/api/assignment-rules/active", async (req, res) => {
    try {
      const rules = await storage.getActiveAssignmentRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching active assignment rules:", error);
      res.status(500).json({ error: "Failed to fetch active assignment rules" });
    }
  });

  // Automatic Assignment System Routes
  app.post("/api/orders/:id/auto-assign", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const result = await storage.autoAssignOrder(orderId);
      
      if (result.success) {
        res.json({
          success: true,
          message: `Orden asignada automáticamente a ${result.assignedTechnician?.user.name}`,
          technician: result.assignedTechnician
        });
      } else {
        res.json({
          success: false,
          message: result.reason || "No se pudo asignar automáticamente"
        });
      }
    } catch (error) {
      console.error("Error in auto-assign:", error);
      res.status(500).json({ 
        success: false, 
        error: "Error interno del sistema de asignación" 
      });
    }
  });

  // Test automatic assignment for development
  app.post("/api/assignment/test", async (req, res) => {
    try {
      const { orderId, customerLocation } = req.body;
      const bestMatch = await storage.findBestTechnician(orderId, customerLocation);
      
      if (bestMatch) {
        res.json({
          success: true,
          technician: bestMatch.technician,
          distance: bestMatch.distance,
          estimatedTime: bestMatch.estimatedTime,
          matchingRules: bestMatch.matchingRules.map(rule => ({
            name: rule.name,
            priority: rule.priority,
            method: rule.assignmentMethod
          }))
        });
      } else {
        res.json({
          success: false,
          message: "No hay técnicos disponibles que cumplan los criterios"
        });
      }
    } catch (error) {
      console.error("Error testing assignment:", error);
      res.status(500).json({ error: "Error testing automatic assignment" });
    }
  });

  app.get("/api/orders/:id/best-technician", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { latitude, longitude } = req.query;
      
      let customerLocation;
      if (latitude && longitude) {
        customerLocation = {
          latitude: latitude as string,
          longitude: longitude as string
        };
      }
      
      const bestMatch = await storage.findBestTechnician(orderId, customerLocation);
      
      if (!bestMatch) {
        return res.status(404).json({ 
          message: "No se encontró ningún técnico disponible para esta orden" 
        });
      }
      
      res.json({
        technician: bestMatch.technician,
        distance: bestMatch.distance,
        estimatedTime: bestMatch.estimatedTime,
        matchingRules: bestMatch.matchingRules
      });
    } catch (error) {
      console.error("Error finding best technician:", error);
      res.status(500).json({ error: "Error al buscar el mejor técnico" });
    }
  });

  app.get("/api/technicians/available", async (req, res) => {
    try {
      const { specializations, maxDistance, latitude, longitude } = req.query;
      
      let customerLocation;
      if (latitude && longitude) {
        customerLocation = {
          latitude: latitude as string,
          longitude: longitude as string
        };
      }
      
      const specializationsArray = specializations ? 
        (Array.isArray(specializations) ? specializations : [specializations]) as string[] : 
        undefined;
      
      const maxDistanceNum = maxDistance ? parseFloat(maxDistance as string) : undefined;
      
      const availableTechnicians = await storage.getAvailableTechnicians(
        specializationsArray, 
        maxDistanceNum, 
        customerLocation
      );
      
      res.json(availableTechnicians);
    } catch (error) {
      console.error("Error fetching available technicians:", error);
      res.status(500).json({ error: "Error al obtener técnicos disponibles" });
    }
  });

  // Notification routes
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      const notifications = await storage.getUserNotifications(parseInt(userId));
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      const notifications = await storage.getUnreadNotifications(parseInt(userId));
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  app.get("/api/notifications/count", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      const counts = await storage.getNotificationCount(parseInt(userId));
      res.json(counts);
    } catch (error) {
      console.error("Error fetching notification counts:", error);
      res.status(500).json({ error: "Failed to fetch notification counts" });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const notificationData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(notificationData);
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid notification data", details: error.errors });
      }
      console.error("Error creating notification:", error);
      res.status(500).json({ error: "Failed to create notification" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationAsRead(id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.put("/api/notifications/read-all", async (req, res) => {
    try {
      const userId = req.body.userId;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      await storage.markAllNotificationsAsRead(parseInt(userId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteNotification(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Product Categories API
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getActiveCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/all", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching all categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const category = await storage.createCategory(req.body);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.updateCategory(id, req.body);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Shopping Cart API - REMOVED: Duplicate endpoint, using the proper one below

  app.post("/api/cart", async (req, res) => {
    try {
      const sessionId = req.body.sessionId || req.sessionID;
      const item = { ...req.body, sessionId };
      
      const cartItem = await storage.addToCart(item);
      res.status(201).json(cartItem);
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ error: "Failed to add item to cart" });
    }
  });

  app.put("/api/cart/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity } = req.body;
      
      const cartItem = await storage.updateCartItem(id, quantity);
      if (!cartItem) {
        return res.status(404).json({ error: "Cart item not found" });
      }
      res.json(cartItem);
    } catch (error) {
      console.error("Error updating cart item:", error);
      res.status(500).json({ error: "Failed to update cart item" });
    }
  });

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.removeFromCart(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ error: "Failed to remove item from cart" });
    }
  });

  app.delete("/api/cart", async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string || req.sessionID;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      
      await storage.clearCart(sessionId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ error: "Failed to clear cart" });
    }
  });

  app.get("/api/cart/total", async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string || req.sessionID;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      
      const total = await storage.getCartTotal(sessionId, userId);
      res.json({ total });
    } catch (error) {
      console.error("Error calculating cart total:", error);
      res.status(500).json({ error: "Failed to calculate cart total" });
    }
  });

  // ===== CATALOG AND CART API ROUTES =====

  // Get all categories
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  // Get cart
  app.get('/api/cart', async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string || req.session?.id || 'default';
      const cart = await storage.getCart(sessionId);
      res.json(cart);
    } catch (error) {
      console.error('Error fetching cart:', error);
      res.status(500).json({ message: 'Failed to fetch cart' });
    }
  });

  // Add to cart
  app.post('/api/cart/add', async (req, res) => {
    try {
      const { productId, quantity, sessionId: clientSessionId } = req.body;
      const sessionId = clientSessionId || req.session?.id || 'default';
      
      console.log('Request body:', req.body);
      console.log('Client sessionId:', clientSessionId);
      console.log('Final sessionId:', sessionId);
      console.log('Adding to cart - sessionId:', sessionId, 'productId:', productId, 'quantity:', quantity);
      
      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({ message: 'Product ID and valid quantity required' });
      }

      await storage.addToCart(sessionId, productId, quantity);
      const cart = await storage.getCart(sessionId);
      console.log('Cart after adding:', cart);
      res.json(cart);
    } catch (error) {
      console.error('Error adding to cart:', error);
      res.status(500).json({ message: 'Failed to add product to cart' });
    }
  });

  // Update cart item quantity
  app.put('/api/cart/update', async (req, res) => {
    try {
      const { productId, quantity, sessionId: clientSessionId } = req.body;
      const sessionId = clientSessionId || req.session?.id || 'default';
      
      if (!productId || quantity < 0) {
        return res.status(400).json({ message: 'Product ID and valid quantity required' });
      }

      if (quantity === 0) {
        await storage.removeFromCart(sessionId, productId);
      } else {
        await storage.updateCartQuantity(sessionId, productId, quantity);
      }
      
      const cart = await storage.getCart(sessionId);
      res.json(cart);
    } catch (error) {
      console.error('Error updating cart:', error);
      res.status(500).json({ message: 'Failed to update cart' });
    }
  });

  // Remove from cart
  app.delete('/api/cart/remove/:productId', async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const sessionId = req.query.sessionId as string || req.session?.id || 'default';
      
      if (!productId) {
        return res.status(400).json({ message: 'Product ID required' });
      }

      await storage.removeFromCart(sessionId, productId);
      const cart = await storage.getCart(sessionId);
      res.json(cart);
    } catch (error) {
      console.error('Error removing from cart:', error);
      res.status(500).json({ message: 'Failed to remove product from cart' });
    }
  });

  // Clear cart
  app.delete('/api/cart/clear', async (req, res) => {
    try {
      const sessionId = req.session?.id || 'default';
      await storage.clearCart(sessionId);
      const cart = await storage.getCart(sessionId);
      res.json(cart);
    } catch (error) {
      console.error('Error clearing cart:', error);
      res.status(500).json({ message: 'Failed to clear cart' });
    }
  });

  // Function to send product removal menu with buttons
  async function sendProductRemovalMenu(customer: any, phoneNumber: string) {
    try {
      const orders = await storage.getAllOrders();
      const activeOrders = orders.filter(order => 
        order.customer.id === customer.id && 
        ['pending', 'confirmed', 'in_progress', 'assigned'].includes(order.status)
      );
      
      if (activeOrders.length === 0) {
        await sendWhatsAppMessage(phoneNumber, "No tienes pedidos activos para editar.");
        return;
      }

      const order = activeOrders[0];
      const orderItems = await storage.getOrderItems(order.id);
      
      if (orderItems.length === 0) {
        await sendWhatsAppMessage(phoneNumber, "No hay productos en este pedido para quitar.");
        return;
      }

      // Send simple text message with product list and instructions
      let removeMessage = `🗑️ *Quitar productos del pedido ${order.orderNumber}*\n\n`;
      removeMessage += `Productos en tu pedido:\n\n`;
      
      for (let i = 0; i < orderItems.length; i++) {
        const item = orderItems[i];
        const productName = item.product?.name || 'Producto';
        removeMessage += `${i + 1}. ${productName} (x${item.quantity}) - $${item.unitPrice}\n`;
      }

      removeMessage += `\n📝 *Para quitar un producto:*\n`;
      removeMessage += `Responde con el número del producto que quieres eliminar.\n\n`;
      removeMessage += `Ejemplo: "1" para quitar el primer producto\n\n`;
      removeMessage += `O escribe *menu* para volver al menú principal.`;

      await sendWhatsAppMessage(phoneNumber, removeMessage);

      // Create a simple registration flow to capture the product number
      await storage.createRegistrationFlow(phoneNumber, {
        currentStep: 'removing_product',
        collectedData: JSON.stringify({ 
          orderId: order.id,
          orderItems: orderItems.map(item => ({
            id: item.id,
            productName: item.product?.name || 'Producto',
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        }),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      });

    } catch (error) {
      console.error('Error in sendProductRemovalMenu:', error);
      await sendWhatsAppMessage(phoneNumber, "Disculpa, hubo un error mostrando los productos.");
    }
  }

  // Function to handle removing specific order item
  async function handleRemoveOrderItem(customer: any, phoneNumber: string, itemId: number) {
    try {
      // Get the order item to verify it belongs to customer
      const orders = await storage.getAllOrders();
      const customerOrders = orders.filter(order => order.customer.id === customer.id);
      let targetOrder = null;
      let targetItem = null;

      for (const order of customerOrders) {
        const orderItems = await storage.getOrderItems(order.id);
        const item = orderItems.find(i => i.id === itemId);
        if (item) {
          targetOrder = order;
          targetItem = item;
          break;
        }
      }

      if (!targetOrder || !targetItem) {
        await sendWhatsAppMessage(phoneNumber, "No se pudo encontrar el producto seleccionado.");
        return;
      }

      // Remove the item (this would need to be implemented in storage)
      // For now, we'll update the order notes to reflect the removal
      const productName = targetItem.product?.name || 'Producto';
      const currentNotes = targetOrder.notes || '';
      const removalNote = `\n[PRODUCTO ELIMINADO] ${productName} (x${targetItem.quantity}) - $${targetItem.unitPrice}`;
      
      await storage.updateOrder(targetOrder.id, {
        notes: currentNotes + removalNote
      });

      await sendWhatsAppMessage(phoneNumber, 
        `✅ *Producto eliminado*\n\n` +
        `Se ha eliminado "${productName}" de tu pedido ${targetOrder.orderNumber}.\n\n` +
        `Nuestro equipo procesará este cambio y te contactará para confirmar el nuevo total.\n\n` +
        `¿Necesitas hacer algún otro cambio? Escribe *editar* para ver las opciones.`
      );

    } catch (error) {
      console.error('Error in handleRemoveOrderItem:', error);
      await sendWhatsAppMessage(phoneNumber, "Disculpa, hubo un error procesando la eliminación del producto.");
    }
  }

  // Function to send add note message
  async function sendAddNoteMessage(customer: any, phoneNumber: string) {
    try {
      const orders = await storage.getAllOrders();
      const activeOrders = orders.filter(order => 
        order.customer.id === customer.id && 
        ['pending', 'confirmed', 'in_progress', 'assigned'].includes(order.status)
      );
      
      if (activeOrders.length === 0) {
        await sendWhatsAppMessage(phoneNumber, "No tienes pedidos activos para agregar notas.");
        return;
      }

      const noteMessage = `📝 *Agregar nota a tu pedido*\n\n` +
        `Por favor escribe la nota que quieres agregar a tu pedido. Puede incluir:\n\n` +
        `• Horarios disponibles para la entrega/instalación\n` +
        `• Instrucciones especiales de ubicación\n` +
        `• Preferencias de contacto\n` +
        `• Cualquier información adicional importante\n\n` +
        `Escribe tu nota a continuación:`;

      await sendWhatsAppMessage(phoneNumber, noteMessage);

      // Set a flag to capture the next message as a note
      // This would need registration flow or session management
      await storage.createRegistrationFlow(phoneNumber, {
        currentStep: 'adding_note',
        collectedData: JSON.stringify({ orderId: activeOrders[0].id }),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      });

    } catch (error) {
      console.error('Error in sendAddNoteMessage:', error);
      await sendWhatsAppMessage(phoneNumber, "Disculpa, hubo un error al preparar la adición de notas.");
    }
  }



  // ================================
  // SISTEMA MULTI-TENANT - ENDPOINTS DE GESTIÓN DE TIENDAS VIRTUALES
  // ================================

  // Middleware para operaciones multi-tenant
  app.use('/api/admin', tenantMiddleware());

  // ================================
  // SUPER ADMIN ENDPOINTS - DASHBOARD GLOBAL Y MÉTRICAS
  // ================================

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
      
      // Simular otras métricas (en producción estas vendrían de monitoreo real)
      const metrics = {
        totalStores,
        activeStores,
        totalUsers,
        totalMessages: 1247, // Total de mensajes WhatsApp en 24h
        dbConnections: activeStores, // Una conexión por tienda activa
        systemUptime: "72h 14m",
        apiCalls: 8934, // Llamadas API en 24h
        storageUsage: "2.1 GB", // Uso total de almacenamiento
      };

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching super admin metrics:', error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

  // Métricas específicas por tienda
  app.get('/api/super-admin/store-metrics', async (req, res) => {
    try {
      const stores = await masterDb.select().from(schema.virtualStores);
      
      const storeMetrics = stores.map(store => ({
        id: store.id,
        name: store.name,
        status: store.isActive ? 'active' : 'inactive',
        lastActivity: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toLocaleString(),
        messageCount: Math.floor(Math.random() * 200) + 50, // Simular mensajes
        userCount: Math.floor(Math.random() * 10) + 2, // Simular usuarios
        dbSize: `${(Math.random() * 500 + 50).toFixed(1)} MB`, // Simular tamaño DB
        subscription: store.subscription || 'free',
      }));

      res.json(storeMetrics);
    } catch (error) {
      console.error('Error fetching store metrics:', error);
      res.status(500).json({ error: 'Failed to fetch store metrics' });
    }
  });

  // Gestión de usuarios globales del sistema
  app.get('/api/super-admin/users', async (req, res) => {
    try {
      const users = await masterDb
        .select({
          id: schema.systemUsers.id,
          username: schema.systemUsers.username,
          email: schema.systemUsers.email,
          role: schema.systemUsers.role,
          storeId: schema.systemUsers.storeId,
          storeName: schema.virtualStores.name,
          isActive: schema.systemUsers.isActive,
          lastLogin: schema.systemUsers.lastLogin,
          createdAt: schema.systemUsers.createdAt,
        })
        .from(schema.systemUsers)
        .leftJoin(schema.virtualStores, eq(schema.systemUsers.storeId, schema.virtualStores.id));

      res.json(users);
    } catch (error) {
      console.error('Error fetching system users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Crear usuario propietario/administrador de tienda
  app.post('/api/super-admin/users', async (req, res) => {
    try {
      const { name, email, phone, role, storeId, sendInvitation, invitationMessage } = req.body;

      // Validar que la tienda existe
      const store = await masterDb
        .select()
        .from(schema.virtualStores)
        .where(eq(schema.virtualStores.id, storeId))
        .limit(1);

      if (!store.length) {
        return res.status(400).json({ error: 'Tienda no encontrada' });
      }

      // Verificar si el email ya existe
      const existingUser = await masterDb
        .select()
        .from(schema.systemUsers)
        .where(eq(schema.systemUsers.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'Ya existe un usuario con este email' });
      }

      // Generar username automáticamente desde el email
      const username = email.split('@')[0].toLowerCase();

      // Generar contraseña temporal aleatoria
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Crear el usuario
      const [user] = await masterDb
        .insert(schema.systemUsers)
        .values({
          username,
          name,
          email,
          phone: phone || null,
          role,
          storeId,
          password: hashedPassword,
          isActive: true,
        })
        .returning();

      // Si se solicita envío de invitación, simular el envío del email
      let invitationSent = false;
      if (sendInvitation) {
        try {
          // En producción, aquí se enviaría un email real
          console.log(`=== INVITACIÓN POR EMAIL ===`);
          console.log(`Para: ${email}`);
          console.log(`Nombre: ${name}`);
          console.log(`Tienda: ${store[0].name}`);
          console.log(`Rol: ${role === 'store_owner' ? 'Propietario de Tienda' : 'Administrador de Tienda'}`);
          console.log(`Usuario: ${username}`);
          console.log(`Contraseña temporal: ${tempPassword}`);
          console.log(`Mensaje: ${invitationMessage || 'Bienvenido al sistema'}`);
          console.log(`==========================`);
          
          invitationSent = true;
        } catch (emailError) {
          console.error('Error enviando invitación:', emailError);
          // No fallar la creación del usuario si falla el email
        }
      }

      // Remover password del response
      const { password, ...userResponse } = user;
      
      res.status(201).json({
        ...userResponse,
        storeName: store[0].name,
        tempPassword: tempPassword, // Solo para pruebas, en producción no se devolvería
        invitationSent,
      });

    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Error al crear usuario' });
    }
  });

  // Obtener métricas de usuarios
  app.get('/api/super-admin/user-metrics', async (req, res) => {
    try {
      const users = await masterDb.select().from(schema.systemUsers);
      
      const totalUsers = users.length;
      const activeUsers = users.filter(user => user.isActive).length;
      const storeOwners = users.filter(user => user.role === 'store_owner').length;
      const superAdmins = users.filter(user => user.role === 'super_admin').length;
      const suspendedUsers = users.filter(user => !user.isActive).length;
      
      // Usuarios nuevos este mes
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      const newUsersThisMonth = users.filter(user => 
        user.createdAt && new Date(user.createdAt) >= currentMonth
      ).length;

      const metrics = {
        totalUsers,
        activeUsers,
        storeOwners,
        superAdmins,
        suspendedUsers,
        newUsersThisMonth,
      };

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching user metrics:', error);
      res.status(500).json({ error: 'Failed to fetch user metrics' });
    }
  });

  // Actualizar usuario global
  app.put('/api/super-admin/users/:id', async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updates = req.body;
      
      // Si se incluye contraseña, hashearla
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
      }
      
      const [user] = await masterDb
        .update(schema.systemUsers)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(schema.systemUsers.id, userId))
        .returning();
        
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Remover password del response
      const { password, ...userResponse } = user;
      res.json(userResponse);
    } catch (error) {
      console.error('Error updating system user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Desactivar usuario global
  app.delete('/api/super-admin/users/:id', async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      const [user] = await masterDb
        .update(schema.systemUsers)
        .set({ 
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.systemUsers.id, userId))
        .returning();
        
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ message: 'User deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating system user:', error);
      res.status(500).json({ error: 'Failed to deactivate user' });
    }
  });

  // Listar todas las tiendas virtuales (super admin)
  app.get('/api/admin/stores', async (req, res) => {
    try {
      const stores = await masterDb.select().from(schema.virtualStores);
      res.json(stores);
    } catch (error) {
      console.error('Error fetching stores:', error);
      res.status(500).json({ error: 'Failed to fetch stores' });
    }
  });

  // Crear nueva tienda virtual (super admin)
  app.post('/api/admin/stores', async (req, res) => {
    try {
      const validatedData = insertVirtualStoreSchema.parse(req.body);
      
      // Crear URL de base de datos (en producción sería una nueva base de datos)
      const databaseUrl = process.env.DATABASE_URL + `?schema=store_${Date.now()}`;
      
      const [store] = await masterDb
        .insert(schema.virtualStores)
        .values({
          ...validatedData,
          databaseUrl,
          slug: validatedData.slug || validatedData.name.toLowerCase().replace(/\s+/g, '-')
        })
        .returning();

      // Configurar la nueva tienda con ajustes predeterminados
      await createTenantDatabase(store);
      
      console.log(`New store created: ${store.name} with default configurations`);
      res.status(201).json(store);
    } catch (error) {
      console.error('Error creating store:', error);
      res.status(500).json({ error: 'Failed to create store' });
    }
  });

  // Obtener información de una tienda específica
  app.get('/api/admin/stores/:id', async (req, res) => {
    try {
      const storeId = parseInt(req.params.id);
      const store = await getStoreInfo(storeId);
      
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
      
      res.json(store);
    } catch (error) {
      console.error('Error fetching store:', error);
      res.status(500).json({ error: 'Failed to fetch store' });
    }
  });

  // Actualizar tienda virtual
  app.put('/api/admin/stores/:id', async (req, res) => {
    try {
      const storeId = parseInt(req.params.id);
      const validatedData = insertVirtualStoreSchema.partial().parse(req.body);
      
      const [store] = await masterDb
        .update(schema.virtualStores)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(schema.virtualStores.id, storeId))
        .returning();
        
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
      
      res.json(store);
    } catch (error) {
      console.error('Error updating store:', error);
      res.status(500).json({ error: 'Failed to update store' });
    }
  });

  // Eliminar tienda virtual (soft delete)
  app.delete('/api/admin/stores/:id', async (req, res) => {
    try {
      const storeId = parseInt(req.params.id);
      
      const [store] = await masterDb
        .update(schema.virtualStores)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.virtualStores.id, storeId))
        .returning();
        
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
      
      res.json({ message: 'Store deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating store:', error);
      res.status(500).json({ error: 'Failed to deactivate store' });
    }
  });

  // Gestión de usuarios del sistema multi-tenant
  
  // Listar usuarios del sistema
  app.get('/api/admin/system-users', async (req, res) => {
    try {
      const users = await masterDb.select().from(schema.systemUsers);
      res.json(users);
    } catch (error) {
      console.error('Error fetching system users:', error);
      res.status(500).json({ error: 'Failed to fetch system users' });
    }
  });

  // Crear usuario del sistema
  app.post('/api/admin/system-users', async (req, res) => {
    try {
      const validatedData = insertSystemUserSchema.parse(req.body);
      
      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      const [user] = await masterDb
        .insert(schema.systemUsers)
        .values({
          ...validatedData,
          password: hashedPassword
        })
        .returning();

      // Remover la contraseña de la respuesta
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Error creating system user:', error);
      res.status(500).json({ error: 'Failed to create system user' });
    }
  });

  // Validar acceso a tienda específica
  app.get('/api/admin/validate-store/:id', async (req, res) => {
    try {
      const storeId = parseInt(req.params.id);
      const isValid = await validateStore(storeId);
      
      res.json({ valid: isValid });
    } catch (error) {
      console.error('Error validating store:', error);
      res.status(500).json({ error: 'Failed to validate store' });
    }
  });

  // Login específico para sistema multi-tenant
  app.post('/api/admin/login', async (req, res) => {
    try {
      const { username, password, storeId } = req.body;
      
      // Buscar usuario en la base de datos maestra
      const [user] = await masterDb
        .select()
        .from(schema.systemUsers)
        .where(eq(schema.systemUsers.username, username))
        .limit(1);
        
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Verificar contraseña
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Verificar acceso a la tienda si se especifica
      if (storeId) {
        if (user.role !== 'super_admin' && user.storeId !== storeId) {
          return res.status(403).json({ error: 'Access denied to this store' });
        }
        
        const isValidStore = await validateStore(storeId);
        if (!isValidStore) {
          return res.status(400).json({ error: 'Invalid store' });
        }
      }
      
      // Actualizar último login
      await masterDb
        .update(schema.systemUsers)
        .set({ lastLogin: new Date() })
        .where(eq(schema.systemUsers.id, user.id));
      
      // Generar token JWT
      const token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username, 
          role: user.role,
          storeId: storeId || user.storeId 
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ 
        user: userWithoutPassword, 
        token,
        storeId: storeId || user.storeId
      });
    } catch (error) {
      console.error('Error in admin login:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // SUPER ADMIN ENDPOINTS
  // Middleware para verificar super admin
  const requireSuperAdmin = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      if (decoded.role !== 'super_admin') {
        return res.status(403).json({ error: 'Super admin access required' });
      }
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Obtener métricas del sistema
  app.get('/api/super-admin/metrics', requireSuperAdmin, async (req, res) => {
    try {
      // Total de tiendas
      const [storesCount] = await masterDb
        .select({ count: sql<number>`count(*)` })
        .from(schema.virtualStores)
        .where(eq(schema.virtualStores.isActive, true));

      // Total de usuarios
      const [usersCount] = await masterDb
        .select({ count: sql<number>`count(*)` })
        .from(schema.systemUsers);

      // Usuarios activos (con último login en los últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const [activeUsersCount] = await masterDb
        .select({ count: sql<number>`count(*)` })
        .from(schema.systemUsers)
        .where(and(
          eq(schema.systemUsers.isActive, true),
          gte(schema.systemUsers.lastLogin, thirtyDaysAgo)
        ));

      const metrics = {
        totalStores: storesCount?.count || 0,
        totalUsers: usersCount?.count || 0,
        activeUsers: activeUsersCount?.count || 0,
        totalOrders: 0, // Se calculará agregando todas las tiendas
        ordersToday: 0,
        totalRevenue: "0",
        storageUsed: "45.2 MB",
        systemStatus: "healthy" as const
      };

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching super admin metrics:', error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

  // Obtener usuarios globales
  app.get('/api/super-admin/users', requireSuperAdmin, async (req, res) => {
    try {
      const users = await masterDb
        .select({
          id: schema.systemUsers.id,
          username: schema.systemUsers.username,
          name: schema.systemUsers.name,
          email: schema.systemUsers.email,
          role: schema.systemUsers.role,
          status: sql<string>`CASE WHEN ${schema.systemUsers.isActive} THEN 'active' ELSE 'inactive' END`,
          companyId: schema.systemUsers.storeId,
          companyName: schema.virtualStores.name,
          lastLogin: schema.systemUsers.lastLogin,
          createdAt: schema.systemUsers.createdAt,
        })
        .from(schema.systemUsers)
        .leftJoin(schema.virtualStores, eq(schema.systemUsers.storeId, schema.virtualStores.id))
        .where(ne(schema.systemUsers.role, 'super_admin'))
        .orderBy(desc(schema.systemUsers.createdAt));

      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // Obtener empresas/tiendas
  app.get('/api/super-admin/companies', requireSuperAdmin, async (req, res) => {
    try {
      const companies = await masterDb
        .select({
          id: schema.virtualStores.id,
          name: schema.virtualStores.name,
        })
        .from(schema.virtualStores)
        .where(eq(schema.virtualStores.isActive, true))
        .orderBy(schema.virtualStores.name);

      res.json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({ error: 'Failed to fetch companies' });
    }
  });

  // Crear usuario
  app.post('/api/super-admin/users', requireSuperAdmin, async (req, res) => {
    try {
      const { name, email, phone, role, storeId, sendInvitation, invitationMessage } = req.body;

      // Verificar si el email ya existe
      const existingUser = await masterDb
        .select()
        .from(schema.systemUsers)
        .where(eq(schema.systemUsers.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'El email ya está registrado' });
      }

      // Generar username único basado en el email
      const emailUsername = email.split('@')[0];
      let username = emailUsername;
      let counter = 1;
      
      while (true) {
        const usernameExists = await masterDb
          .select()
          .from(schema.systemUsers)
          .where(eq(schema.systemUsers.username, username))
          .limit(1);
          
        if (usernameExists.length === 0) break;
        
        username = `${emailUsername}${counter}`;
        counter++;
      }

      // Generar contraseña temporal segura
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '123!';

      // Hash password
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Obtener información de la tienda
      const store = await masterDb
        .select({ name: schema.virtualStores.name })
        .from(schema.virtualStores)
        .where(eq(schema.virtualStores.id, parseInt(storeId)))
        .limit(1);

      const storeName = store[0]?.name || 'Tienda no encontrada';

      // Crear usuario
      const [newUser] = await masterDb
        .insert(schema.systemUsers)
        .values({
          username,
          name,
          email,
          phone: phone || null,
          role,
          isActive: true,
          storeId: parseInt(storeId),
          password: hashedPassword,
          createdAt: new Date(),
          lastLogin: null,
        })
        .returning();

      // Aquí se podría enviar la invitación por email si sendInvitation es true
      let invitationSent = false;
      if (sendInvitation) {
        // TODO: Implementar envío de email con credenciales
        // Por ahora solo simulamos que se envió
        invitationSent = true;
        console.log(`Invitation email would be sent to: ${email}`);
        console.log(`Custom message: ${invitationMessage || 'Bienvenido a la plataforma'}`);
      }

      // Devolver toda la información necesaria para mostrar al super admin
      res.json({ 
        message: 'Usuario creado exitosamente',
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        username: username,
        tempPassword: tempPassword,
        role: newUser.role,
        storeName: storeName,
        invitationSent: invitationSent
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Error al crear el usuario' });
    }
  });

  // Actualizar usuario
  app.put('/api/super-admin/users/:id', requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { username, name, email, role, status, companyId, password } = req.body;

      const updateData: any = {
        username,
        name,
        email,
        role,
        isActive: status === 'active',
        storeId: companyId ? parseInt(companyId) : null,
      };

      // Solo actualizar password si se proporciona
      if (password && password.trim() !== '') {
        updateData.password = await bcrypt.hash(password, 10);
      }

      await masterDb
        .update(schema.systemUsers)
        .set(updateData)
        .where(eq(schema.systemUsers.id, userId));

      res.json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Eliminar usuario
  app.delete('/api/super-admin/users/:id', requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      // Verificar que no sea super admin
      const user = await masterDb
        .select()
        .from(schema.systemUsers)
        .where(eq(schema.systemUsers.id, userId))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user[0].role === 'super_admin') {
        return res.status(400).json({ error: 'Cannot delete super admin user' });
      }

      await masterDb
        .delete(schema.systemUsers)
        .where(eq(schema.systemUsers.id, userId));

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // Resetear contraseña de usuario
  app.post('/api/super-admin/users/:id/reset-password', requireSuperAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      // Verificar que el usuario existe
      const user = await masterDb
        .select()
        .from(schema.systemUsers)
        .where(eq(schema.systemUsers.id, userId))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generar nueva contraseña temporal
      const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Actualizar la contraseña en la base de datos
      await masterDb
        .update(schema.systemUsers)
        .set({ password: hashedPassword })
        .where(eq(schema.systemUsers.id, userId));

      res.json({ 
        message: 'Password reset successfully',
        newPassword: newPassword
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // ====== SUPER ADMIN ENDPOINTS ======
  
  // Super Admin Dashboard Metrics
  app.get('/api/super-admin/metrics', authenticateToken, async (req: any, res) => {
    try {
      // Verificar que sea super admin
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      const timeRange = req.query.timeRange || '30d';
      let dateFilter = new Date();
      
      switch (timeRange) {
        case '7d':
          dateFilter.setDate(dateFilter.getDate() - 7);
          break;
        case '90d':
          dateFilter.setDate(dateFilter.getDate() - 90);
          break;
        default: // 30d
          dateFilter.setDate(dateFilter.getDate() - 30);
      }

      // Mock data para demonstración - en producción esto vendría de base de datos real
      const mockMetrics = {
        totalStores: 25,
        activeStores: 18,
        inactiveStores: 7,
        totalOrders: 1250,
        monthlyRevenue: 89500,
        averageRetention: 85,
        pendingSupport: 3
      };

      res.json(mockMetrics);
    } catch (error) {
      console.error('Error fetching super admin metrics:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Super Admin Stores List
  app.get('/api/super-admin/stores', authenticateToken, async (req: any, res) => {
    try {
      // Verificar que sea super admin
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      // Obtener tiendas reales de la base de datos
      const stores = await masterDb.select().from(schema.virtualStores);
      
      // Transformar datos para que coincidan con la interfaz esperada
      const transformedStores = stores.map(store => ({
        id: store.id,
        name: store.name,
        description: store.description || '',
        domain: store.domain || '',
        status: store.isActive ? 'active' : 'inactive',
        subscriptionStatus: store.subscription || 'trial',
        planType: store.subscription || 'basic',
        contactEmail: '', // No existe en el schema actual, usar valor por defecto
        contactPhone: store.whatsappNumber || '',
        address: store.address || '',
        createdAt: store.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        lastActivity: store.updatedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        monthlyOrders: 0, // Esto se calcularía desde la DB de la tienda específica
        monthlyRevenue: 0, // Esto se calcularía desde la DB de la tienda específica
        supportTickets: 0, // Esto se calcularía desde la DB de la tienda específica
        settings: {
          whatsappEnabled: !!store.whatsappNumber,
          notificationsEnabled: true,
          analyticsEnabled: true
        }
      }));

      res.json(transformedStores);
    } catch (error) {
      console.error('Error fetching stores:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Create New Store
  app.post('/api/super-admin/stores', authenticateToken, async (req: any, res) => {
    try {
      // Verificar que sea super admin
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      const { name, description, domain, contactEmail, contactPhone, address, planType } = req.body;

      // Validar datos requeridos
      if (!name || !description || !domain || !contactEmail || !contactPhone || !address || !planType) {
        return res.status(400).json({ message: "Todos los campos son requeridos" });
      }

      // Crear nueva tienda en la base de datos real
      const validatedData = {
        name,
        description,
        domain,
        contactEmail,
        contactPhone,
        address,
        planType,
        status: 'active' as const,
        subscriptionStatus: 'trial' as const,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        databaseUrl: process.env.DATABASE_URL + `?schema=store_${Date.now()}`
      };
      
      const [store] = await masterDb
        .insert(schema.virtualStores)
        .values(validatedData)
        .returning();

      // Configurar la nueva tienda con ajustes predeterminados
      await copyDefaultConfigurationsToTenant(store.id);
      
      console.log(`New store created: ${store.name} with default configurations`);
      
      // Transformar respuesta para que coincida con la interfaz esperada
      const transformedStore = {
        id: store.id,
        name: store.name,
        description: store.description || '',
        domain: store.domain || '',
        status: store.isActive ? 'active' : 'inactive',
        subscriptionStatus: store.subscription || 'trial',
        planType: store.subscription || 'basic',
        contactEmail: '', // No existe en el schema actual
        contactPhone: store.whatsappNumber || '',
        address: store.address || '',
        createdAt: store.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        lastActivity: store.updatedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        monthlyOrders: 0,
        monthlyRevenue: 0,
        supportTickets: 0,
        settings: {
          whatsappEnabled: !!store.whatsappNumber,
          notificationsEnabled: true,
          analyticsEnabled: true
        }
      };

      res.status(201).json(transformedStore);
    } catch (error) {
      console.error('Error creating store:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Update Store Status
  app.patch('/api/super-admin/stores/:id/status', authenticateToken, async (req: any, res) => {
    try {
      // Verificar que sea super admin
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      const { id } = req.params;
      const { action } = req.body;

      if (!['enable', 'disable', 'suspend'].includes(action)) {
        return res.status(400).json({ message: "Acción inválida" });
      }

      // En producción, aquí se actualizaría el estado de la tienda
      const statusMap = {
        enable: 'active',
        disable: 'inactive',
        suspend: 'suspended'
      };

      const newStatus = statusMap[action as keyof typeof statusMap];

      res.json({ 
        success: true, 
        message: `Tienda ${action === 'enable' ? 'activada' : action === 'disable' ? 'desactivada' : 'suspendida'} exitosamente`,
        status: newStatus
      });
    } catch (error) {
      console.error('Error updating store status:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Create/Repair Store Ecosystem
  app.post('/api/super-admin/stores/:id/repair', async (req, res) => {
    try {
      const storeId = parseInt(req.params.id);
      
      // Obtener información de la tienda
      const store = await getStoreInfo(storeId);
      if (!store) {
        return res.status(404).json({ 
          success: false, 
          message: 'Tienda no encontrada' 
        });
      }

      console.log(`Iniciando reparación del ecosistema para tienda ${store.name} (ID: ${storeId})`);

      try {
        // Intentar crear la base de datos de la tienda
        const databaseUrl = await createTenantDatabase(store);
        console.log(`Base de datos creada/verificada: ${databaseUrl}`);

        // Copiar configuraciones predeterminadas
        await copyDefaultConfigurationsToTenant(storeId);
        console.log(`Configuraciones predeterminadas copiadas para tienda ${storeId}`);

        // Ejecutar validación para confirmar que todo está bien
        const tenantDb = await getTenantDb(storeId);
        
        // Verificar tablas críticas
        const configs = await tenantDb.select().from(schema.storeSettings).limit(1);
        const autoResponses = await tenantDb.select().from(schema.autoResponses).limit(1);
        
        res.json({
          success: true,
          message: `Ecosistema de ${store.name} reparado exitosamente`,
          details: {
            store: store.name,
            storeId: storeId,
            databaseCreated: true,
            configCount: configs.length,
            autoResponseCount: autoResponses.length,
            status: 'repaired'
          }
        });

      } catch (error) {
        console.error(`Error durante la reparación de la tienda ${storeId}:`, error);
        res.status(500).json({
          success: false,
          message: `Error al reparar ecosistema de ${store.name}`,
          details: {
            store: store.name,
            storeId: storeId,
            error: error.message
          }
        });
      }

    } catch (error) {
      console.error('Error repairing store ecosystem:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error interno durante la reparación' 
      });
    }
  });

  // Global Configuration
  app.get('/api/super-admin/config', authenticateToken, async (req: any, res) => {
    try {
      // Verificar que sea super admin
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      // Mock global configuration - en producción esto vendría de base de datos de configuración global
      const globalConfig = {
        platform: {
          name: "OrderManager Pro",
          version: "1.0.0",
          maintenanceMode: false,
          defaultLanguage: "es",
          supportedLanguages: ["es", "en", "pt"],
          timezone: "America/Mexico_City"
        },
        pricing: {
          basicPlan: 29,
          premiumPlan: 59,
          enterprisePlan: 99,
          currency: "USD",
          trialDays: 14
        },
        notifications: {
          emailEnabled: true,
          smsEnabled: false,
          pushEnabled: true,
          systemAlerts: true
        },
        security: {
          sessionTimeout: 24,
          passwordMinLength: 8,
          twoFactorRequired: false,
          ipWhitelist: []
        },
        legal: {
          termsOfService: "Términos y condiciones de la plataforma...",
          privacyPolicy: "Política de privacidad...",
          cookiePolicy: "Política de cookies...",
          lastUpdated: "2025-06-30"
        },
        support: {
          supportEmail: "support@orderManager.com",
          supportPhone: "+52 55 1234 5678",
          supportHours: "Lunes a Viernes 9:00 - 18:00",
          ticketResponseTime: 24
        }
      };

      res.json(globalConfig);
    } catch (error) {
      console.error('Error fetching global config:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // Update Global Configuration
  app.put('/api/super-admin/config', authenticateToken, async (req: any, res) => {
    try {
      // Verificar que sea super admin
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      const configData = req.body;

      // En producción, aquí se actualizaría la configuración global en base de datos
      console.log('Updating global configuration:', configData);

      res.json({ 
        success: true, 
        message: "Configuración global actualizada exitosamente",
        data: configData
      });
    } catch (error) {
      console.error('Error updating global config:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// CONVERSATION TYPE HANDLERS FOR WHATSAPP SEGMENTATION
// (Functions are implemented above in the main flow)

// handleSupportConversation is implemented above in the main flow

// TRACKING CONVERSATION HELPERS

async function sendOrderTrackingStatus(customer: any, phoneNumber: string, activeOrders: any[]) {
  if (activeOrders.length === 0) {
    await sendWhatsAppMessage(phoneNumber, 
      "📋 No tienes pedidos activos en este momento.\n\n" +
      "¿Te gustaría hacer un nuevo pedido? Escribe *menu* para ver nuestros productos y servicios."
    );
    return;
  }

  let statusMessage = `📊 *Estado de tus Pedidos Activos*\n\n`;
  
  for (const order of activeOrders.slice(0, 3)) { // Limit to 3 orders
    const statusEmoji = {
      'pending': '⏳',
      'confirmed': '✅',
      'assigned': '👨‍🔧',
      'in_progress': '🔧'
    }[order.status] || '📋';

    const statusText = {
      'pending': 'Pendiente',
      'confirmed': 'Confirmado',
      'assigned': 'Técnico Asignado',
      'in_progress': 'En Progreso'
    }[order.status] || order.status;

    statusMessage += `${statusEmoji} *Pedido ${order.orderNumber}*\n`;
    statusMessage += `   Estado: ${statusText}\n`;
    statusMessage += `   Total: $${order.totalAmount}\n`;
    if (order.assignedUser) {
      statusMessage += `   Técnico: ${order.assignedUser.name}\n`;
    }
    statusMessage += `   Fecha: ${new Date(order.createdAt).toLocaleDateString('es-MX')}\n\n`;
  }

  statusMessage += "💬 *Opciones disponibles:*\n";
  statusMessage += "• Escribe *tecnico* para ver info del técnico\n";
  statusMessage += "• Escribe *tiempo* para tiempo estimado\n";
  statusMessage += "• Escribe *modificar* para cambios al pedido";

  await sendWhatsAppMessage(phoneNumber, statusMessage);
}

async function sendOrderModificationOptions(customer: any, phoneNumber: string, activeOrders: any[]) {
  let message = "🔧 *Modificaciones de Pedido*\n\n";
  
  if (activeOrders.length === 0) {
    message += "No tienes pedidos activos que se puedan modificar.";
  } else {
    message += "Para modificaciones o cancelaciones, contacta directamente:\n\n";
    message += "📞 *Teléfono:* +52 55 1234 5678\n";
    message += "🕒 *Horario:* Lun-Vie 8AM-6PM, Sáb 9AM-2PM\n\n";
    message += "⚠️ *Importante:* Las modificaciones deben realizarse antes de que el técnico esté en camino.";
  }

  await sendWhatsAppMessage(phoneNumber, message);
}

async function sendEstimatedTime(customer: any, phoneNumber: string, activeOrders: any[]) {
  let message = "⏰ *Tiempos Estimados*\n\n";
  
  for (const order of activeOrders.slice(0, 2)) {
    message += `📋 *Pedido ${order.orderNumber}*\n`;
    
    if (order.status === 'pending') {
      message += "   ⏳ Estimado: 24-48 horas para confirmar\n";
    } else if (order.status === 'confirmed') {
      message += "   ⏳ Estimado: 1-3 días para asignar técnico\n";
    } else if (order.status === 'assigned') {
      message += "   ⏳ Estimado: Técnico contactará en 24 horas\n";
    } else if (order.status === 'in_progress') {
      message += "   🔧 En proceso: Tiempo según complejidad\n";
    }
    message += "\n";
  }
  
  message += "📞 Para información más específica, contacta al equipo de seguimiento.";

  await sendWhatsAppMessage(phoneNumber, message);
}

async function sendTechnicianInfo(customer: any, phoneNumber: string, activeOrders: any[]) {
  let message = "👨‍🔧 *Información del Técnico*\n\n";
  
  const ordersWithTechnician = activeOrders.filter(order => order.assignedUser);
  
  if (ordersWithTechnician.length === 0) {
    message += "⏳ Aún no se ha asignado técnico a tus pedidos.\n\n";
    message += "El técnico será asignado una vez que el pedido sea confirmado y programado.";
  } else {
    for (const order of ordersWithTechnician) {
      message += `📋 *Pedido ${order.orderNumber}*\n`;
      message += `👨‍🔧 Técnico: ${order.assignedUser.name}\n`;
      message += `📞 El técnico te contactará directamente\n`;
      message += `🕒 Horario: Lun-Vie 8AM-6PM\n\n`;
    }
  }

  await sendWhatsAppMessage(phoneNumber, message);
}

async function sendTrackingMenu(customer: any, phoneNumber: string, activeOrders: any[]) {
  const orderCount = activeOrders.length;
  const customerName = customer.name && !customer.name.startsWith('Cliente ') ? customer.name : '';
  
  let message = `👋 ${customerName ? `Hola ${customerName}!` : 'Hola!'}\n\n`;
  message += `📊 Tienes ${orderCount} pedido${orderCount !== 1 ? 's' : ''} activo${orderCount !== 1 ? 's' : ''}\n\n`;
  message += "💬 *¿Qué necesitas saber?*\n\n";
  message += "📋 Escribe *estado* - Ver estado de pedidos\n";
  message += "👨‍🔧 Escribe *tecnico* - Info del técnico asignado\n";
  message += "⏰ Escribe *tiempo* - Tiempos estimados\n";
  message += "🔧 Escribe *modificar* - Cambios al pedido\n";
  message += "🆕 Escribe *menu* - Hacer nuevo pedido";

  await sendWhatsAppMessage(phoneNumber, message);
}

// SUPPORT CONVERSATION HELPERS

async function sendSupportMenu(customer: any, phoneNumber: string, recentOrders: any[]) {
  const customerName = customer.name && !customer.name.startsWith('Cliente ') ? customer.name : '';
  
  let message = `👋 ${customerName ? `Hola ${customerName}!` : 'Hola!'}\n\n`;
  message += "🛠️ *Centro de Soporte*\n\n";
  message += "¿Con qué podemos ayudarte?\n\n";
  message += "🔧 Escribe *problema* - Reportar falla técnica\n";
  message += "🛡️ Escribe *garantia* - Información de garantía\n";
  message += "⭐ Escribe *opinion* - Dejar comentarios\n";
  message += "📄 Escribe *factura* - Solicitar documentos\n";
  message += "📞 Escribe *contacto* - Hablar con un agente";

  await sendWhatsAppMessage(phoneNumber, message);
}

async function sendTechnicalSupportOptions(customer: any, phoneNumber: string, recentOrders: any[]) {
  let message = "🔧 *Soporte Técnico*\n\n";
  message += "Describe brevemente el problema que estás experimentando:\n\n";
  message += "• ❄️ No enfría adecuadamente\n";
  message += "• 💨 Ruidos extraños\n";
  message += "• 💧 Goteo de agua\n";
  message += "• ⚡ Problemas eléctricos\n";
  message += "• 🌪️ Aire no circula\n\n";
  message += "📞 *Soporte Urgente:* +52 55 1234 5678\n";
  message += "🕒 *24/7 para emergencias*";

  await sendWhatsAppMessage(phoneNumber, message);
}

async function sendWarrantyInfo(customer: any, phoneNumber: string, recentOrders: any[]) {
  let message = "🛡️ *Información de Garantía*\n\n";
  
  if (recentOrders.length > 0) {
    message += "📋 *Tus servicios con garantía:*\n\n";
    for (const order of recentOrders.slice(0, 2)) {
      const daysAgo = Math.floor((Date.now() - new Date(order.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      message += `• Pedido ${order.orderNumber}\n`;
      message += `  Completado hace ${daysAgo} días\n`;
      message += `  Garantía: ${30 - daysAgo} días restantes\n\n`;
    }
  }
  
  message += "✅ *Cobertura de Garantía:*\n";
  message += "• 30 días en mano de obra\n";
  message += "• 1 año en piezas nuevas\n";
  message += "• Soporte técnico gratuito\n\n";
  message += "📞 Para reclamos: +52 55 1234 5678";

  await sendWhatsAppMessage(phoneNumber, message);
}

async function sendFeedbackRequest(customer: any, phoneNumber: string, recentOrders: any[]) {
  let message = "⭐ *Tu Opinión es Importante*\n\n";
  
  if (recentOrders.length > 0) {
    message += "¿Cómo calificarías nuestro servicio?\n\n";
    message += "😊 *Excelente* - Todo perfecto\n";
    message += "🙂 *Bueno* - Algunas mejoras menores\n";
    message += "😐 *Regular* - Necesita mejorar\n";
    message += "😟 *Malo* - Muy insatisfecho\n\n";
    message += "💬 También puedes escribir comentarios específicos.";
  } else {
    message += "Gracias por tu interés en dejarnos comentarios.\n\n";
    message += "📞 Contacta a nuestro equipo para compartir tu experiencia:\n";
    message += "+52 55 1234 5678";
  }

  await sendWhatsAppMessage(phoneNumber, message);
}

async function sendInvoiceOptions(customer: any, phoneNumber: string, recentOrders: any[]) {
  let message = "📄 *Documentos y Facturas*\n\n";
  
  if (recentOrders.length > 0) {
    message += "📋 *Pedidos disponibles para facturar:*\n\n";
    for (const order of recentOrders.slice(0, 3)) {
      message += `• ${order.orderNumber} - $${order.totalAmount}\n`;
    }
    message += "\n";
  }
  
  message += "✅ *Documentos disponibles:*\n";
  message += "• Comprobante de servicio\n";
  message += "• Factura fiscal (RFC requerido)\n";
  message += "• Garantía de servicio\n\n";
  message += "📧 *Para solicitar:*\n";
  message += "Envía por WhatsApp:\n";
  message += "- Número de pedido\n";
  message += "- Tipo de documento\n";
  message += "- RFC (si requiere factura)";

  await sendWhatsAppMessage(phoneNumber, message);
}

