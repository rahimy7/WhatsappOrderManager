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
} from "@shared/schema";
import { loginSchema, AuthUser } from "@shared/auth";

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
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
      }

      // Comparar contraseña (en producción deberían estar hasheadas)
      if (user.password !== password) {
        return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
      }

      // Generar token JWT
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role 
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
        phone: user.phone,
        email: user.email,
        department: user.department,
      };

      res.json({ user: authUser, token });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Datos inválidos", details: error.errors });
      }
      res.status(500).json({ message: "Error interno del servidor" });
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
        phone: user.phone,
        email: user.email,
        department: user.department,
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

  app.post("/api/products", async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create product" });
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
      let config = await storage.getWhatsAppConfig();
      
      // Initialize config with environment variables if not set
      if (!config || !config.accessToken) {
        const envConfig = {
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
          webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
          businessAccountId: "",
          appId: ""
        };
        
        config = await storage.updateWhatsAppConfig(envConfig);
      }
      
      // Don't send sensitive data to frontend
      const safeConfig = {
        accessToken: config.accessToken ? "****" + config.accessToken.slice(-8) : "",
        phoneNumberId: config.phoneNumberId || "",
        whatsappVerifyToken: config.webhookVerifyToken ? "****" + config.webhookVerifyToken.slice(-4) : "",
        webhookUrl: process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/webhook` : 'https://tu-dominio-replit.com/webhook',
        isConfigured: !!(config.accessToken && config.phoneNumberId),
        connectionStatus: config.accessToken && config.phoneNumberId ? 'connected' : 'not_configured'
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
      const orderItems = parseOrderFromMessage(orderText);
      
      if (orderItems.length === 0) {
        await sendWhatsAppMessage(phoneNumber, 
          "No pude procesar los productos de tu pedido. ¿Podrías enviarlo nuevamente?");
        return;
      }

      // Create order in the system with items
      const orderNumber = `ORD-${Date.now()}`;
      
      // Calculate total from parsed items
      const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Prepare order items for createOrder method
      const orderItemsForCreation = orderItems.map(item => ({
        productId: item.productId || 0, // Use 0 for unknown products
        quantity: item.quantity,
        unitPrice: item.price.toString(),
        totalPrice: (item.price * item.quantity).toString(),
        notes: item.name
      }));
      
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

      const order = await storage.createOrder({
        customerId: customer.id,
        status: 'pending',
        totalAmount: total.toString(),
        notes: `Pedido automático desde catálogo web. Productos: ${orderItems.map(item => `${item.name} (${item.quantity})`).join(', ')}`
      }, orderItemsForCreation);

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
        ).join('\n\n') + '\n\n' +
        `Para completar tu pedido necesito algunos datos:\n\n` +
        `🏠 Tu dirección de entrega\n` +
        `📞 Número de contacto\n` +
        `💳 Método de pago preferido\n\n` +
        `¿Podrías proporcionarme tu dirección de entrega?`;

      await sendWhatsAppMessage(phoneNumber, confirmationMessage);

      // Start registration flow for order completion
      await storage.createRegistrationFlow({
        phoneNumber: phoneNumber,
        currentStep: 'collect_address',
        customerData: JSON.stringify({ 
          orderId: order.id,
          orderNumber: orderNumber,
          hasName: !customer.name.startsWith('Cliente ')
        })
      });

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

      // Process tracking commands
      const lowerText = messageText.toLowerCase();
      
      if (lowerText.includes('estado') || lowerText.includes('status')) {
        // Send order status
        let statusMessage = `📋 *Estado de tus pedidos activos:*\n\n`;
        for (const order of activeOrders) {
          const statusEmoji = order.status === 'pending' ? '⏳' : 
                             order.status === 'confirmed' ? '✅' : 
                             order.status === 'in_progress' ? '🔧' : '📋';
          statusMessage += `${statusEmoji} *Pedido ${order.orderNumber}*\n`;
          statusMessage += `   Estado: ${order.status}\n`;
          statusMessage += `   Total: $${order.totalAmount}\n\n`;
        }
        statusMessage += `Para más información, escribe "detalles" o contacta a nuestro equipo.`;
        await sendWhatsAppMessage(phoneNumber, statusMessage);
      } else if (lowerText.includes('modificar') || lowerText.includes('cambiar')) {
        await sendWhatsAppMessage(phoneNumber, `Para modificar tu pedido, por favor contacta a nuestro equipo de soporte. Menciona tu número de pedido: ${activeOrders[0]?.orderNumber || 'N/A'}`);
      } else if (lowerText.includes('tiempo') || lowerText.includes('cuando')) {
        await sendWhatsAppMessage(phoneNumber, `El tiempo estimado para completar tu pedido es de 24-48 horas. Te notificaremos cuando esté listo.`);
      } else if (lowerText.includes('tecnico') || lowerText.includes('técnico') || lowerText.includes('quien')) {
        await sendWhatsAppMessage(phoneNumber, `Tu pedido será asignado a uno de nuestros técnicos especializados. Te contactaremos con los detalles del técnico asignado.`);
      } else {
        // Show tracking menu
        let menuMessage = `📱 *Menú de Seguimiento*\n\n`;
        menuMessage += `Tienes ${activeOrders.length} pedido(s) activo(s):\n\n`;
        for (const order of activeOrders) {
          menuMessage += `• *${order.orderNumber}* - ${order.status}\n`;
        }
        menuMessage += `\n*Opciones disponibles:*\n`;
        menuMessage += `• Escribe "estado" para ver el estado actual\n`;
        menuMessage += `• Escribe "tiempo" para tiempo estimado\n`;
        menuMessage += `• Escribe "técnico" para información del técnico\n`;
        menuMessage += `• Escribe "modificar" para cambios en el pedido\n`;
        await sendWhatsAppMessage(phoneNumber, menuMessage);
      }

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

  // Function to process incoming WhatsApp messages
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
            // Existing customer - check if name is generic (needs completion)
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
      // Log received location for debugging
      await storage.addWhatsAppLog({
        type: 'info',
        phoneNumber: phoneNumber,
        messageContent: `Ubicación GPS recibida: ${location.latitude}, ${location.longitude}`,
        status: 'received',
        rawData: JSON.stringify({ 
          latitude: location.latitude,
          longitude: location.longitude,
          name: location.name,
          address: location.address,
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

      // Update customer with location data
      const updatedCustomer = await storage.updateCustomerLocation(customer.id, {
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(), 
        address: gpsAddress
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

    // Update customer with location data
    const updatedCustomer = await storage.updateCustomerLocation(customer.id, {
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(), 
      address: gpsAddress
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
      } else if (buttonId === 'use_whatsapp_number') {
        await handleContactNumberSelection(customer, phoneNumber, phoneNumber);
      } else if (buttonId === 'provide_different_number') {
        await handleContactNumberRequest(customer, phoneNumber);
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
      const order = await storage.createOrder({
        customerId: customer.id,
        status: "pending",
        totalAmount: totalPrice.toString(),
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
                  
                  await processWhatsAppMessage(change.value);
                  
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
          message: `Orden asignada automáticamente a ${result.assignedTechnician?.user.name} (${result.assignedTechnician?.employeeId})`,
          assignedTechnician: result.assignedTechnician
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.reason || "No se pudo asignar automáticamente"
        });
      }
    } catch (error) {
      console.error("Error in auto-assignment:", error);
      res.status(500).json({ error: "Error en el sistema de asignación automática" });
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
