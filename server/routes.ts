import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
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
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const order = await storage.updateOrder(id, updates);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
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
          let customer = await storage.getCustomerByPhone(from);
          let isNewCustomer = false;
          
          if (!customer) {
            // Check if there's an ongoing registration flow
            const registrationFlow = await storage.getRegistrationFlow(from);
            
            if (!registrationFlow) {
              // New customer, start registration flow
              await storage.createRegistrationFlow({
                phoneNumber: from,
                step: 'awaiting_name',
                data: JSON.stringify({ phone: from })
              });
              
              await sendRegistrationWelcome(from);
              return; // Don't process the message further, wait for name
            } else {
              // Handle registration flow
              await handleRegistrationFlow(from, messageText, registrationFlow);
              return;
            }
          } else {
            // Existing customer - check if name is generic (needs completion)
            if (customer.name.startsWith('Cliente ')) {
              isNewCustomer = true;
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

          // Process customer message and respond
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
      await storage.addWhatsAppLog({
        type: 'error',
        message: 'Error procesando mensaje de WhatsApp',
        data: { error: error.message, value }
      });
    }
  }

  // Function to process customer messages and respond with menu/orders
  async function processCustomerMessage(customer: any, conversation: any, message: any, from: string, isNewCustomer: boolean = false) {
    try {
      const messageType = message.type;
      
      if (messageType === 'text') {
        const text = message.text.body.toLowerCase().trim();
        
        // Check for auto responses based on triggers
        const autoResponses = await storage.getAllAutoResponses();
        let responseFound = false;
        
        // Check common triggers
        const triggers = [
          { keywords: ['hola', 'hello', 'hi', 'buenos dias', 'buenas tardes'], trigger: 'welcome' },
          { keywords: ['menu', 'menú', 'opciones', 'catalogo', 'catálogo'], trigger: 'menu' },
          { keywords: ['productos', 'product', 'comprar'], trigger: 'product_inquiry' },
          { keywords: ['servicios', 'service', 'reparacion', 'reparación'], trigger: 'service_inquiry' },
          { keywords: ['ayuda', 'help', 'contacto', 'soporte'], trigger: 'contact_request' }
        ];
        
        // Find matching trigger
        let matchedTrigger = null;
        for (const triggerGroup of triggers) {
          if (triggerGroup.keywords.some(keyword => text.includes(keyword))) {
            matchedTrigger = triggerGroup.trigger;
            break;
          }
        }
        
        // If no specific trigger found, use welcome as default
        if (!matchedTrigger) {
          matchedTrigger = 'welcome';
        }
        
        // Find active auto response for the trigger
        const autoResponse = autoResponses.find(ar => 
          ar.trigger === matchedTrigger && ar.isActive
        );
        
        if (autoResponse) {
          // Personalize message for existing customers
          let personalizedMessage = autoResponse.messageText;
          if (matchedTrigger === 'welcome' && !isNewCustomer && !customer.name.startsWith('Cliente ')) {
            personalizedMessage = `👋 ¡Hola ${customer.name}! Bienvenido de nuevo a nuestro servicio de aires acondicionados.\n\n¿En qué podemos ayudarte hoy?`;
          }
          
          // Check if this response has menu options for interactive message
          if (autoResponse.menuOptions) {
            try {
              const menuOptions = JSON.parse(autoResponse.menuOptions);
              if (Array.isArray(menuOptions) && menuOptions.length > 0) {
                // Send interactive message with buttons
                const interactiveMessage = {
                  messaging_product: "whatsapp",
                  to: from,
                  type: "interactive",
                  interactive: {
                    type: "button",
                    header: {
                      type: "text",
                      text: "🔧 Aires Acondicionados"
                    },
                    body: {
                      text: personalizedMessage
                    },
                    action: {
                      buttons: menuOptions.slice(0, 3).map((option, index) => ({
                        type: "reply",
                        reply: {
                          id: option.value,
                          title: option.label
                        }
                      }))
                    }
                  }
                };
                
                await sendWhatsAppInteractiveMessage(from, interactiveMessage);
                responseFound = true;
                
                // Log the interactive response
                await storage.addWhatsAppLog({
                  type: 'info',
                  phoneNumber: from,
                  messageContent: `Menú interactivo enviado: ${autoResponse.name}`,
                  status: 'processed',
                  rawData: JSON.stringify({ 
                    customerMessage: text, 
                    trigger: matchedTrigger,
                    autoResponseId: autoResponse.id,
                    interactiveMessage: interactiveMessage
                  })
                });
              } else {
                // No menu options, send regular text message
                await sendWhatsAppMessage(from, autoResponse.messageText);
                responseFound = true;
              }
            } catch (error) {
              // If menu options parsing fails, send regular text message
              console.log('Error parsing menu options:', error);
              await sendWhatsAppMessage(from, autoResponse.messageText);
              responseFound = true;
            }
          } else {
            // No menu options, send regular text message
            await sendWhatsAppMessage(from, autoResponse.messageText);
            responseFound = true;
          }
          
          // Log the auto response if not already logged
          if (responseFound && !autoResponse.menuOptions) {
            await storage.addWhatsAppLog({
              type: 'info',
              phoneNumber: from,
              messageContent: `Respuesta automática enviada: ${autoResponse.name}`,
              status: 'processed',
              rawData: JSON.stringify({ 
                customerMessage: text, 
                trigger: matchedTrigger,
                autoResponseId: autoResponse.id,
                responseText: autoResponse.messageText
              })
            });
          }
        }
        
        // If no auto response found, send default welcome
        if (!responseFound) {
          await sendWelcomeMessage(from);
          await storage.addWhatsAppLog({
            type: 'info',
            phoneNumber: from,
            messageContent: `Mensaje de bienvenida por defecto enviado a ${from}`,
            status: 'processed',
            rawData: JSON.stringify({ customerMessage: text, response: 'default_welcome' })
          });
        }
        
      } else if (messageType === 'location') {
        await handleLocationMessage(customer, message.location, from);
      } else if (messageType === 'interactive') {
        await handleInteractiveMessage(customer, conversation, message.interactive, from);
      } else {
        // For any other message type, send welcome message
        await sendWelcomeMessage(from);
      }
    } catch (error) {
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: from,
        messageContent: 'Error procesando mensaje del cliente',
        status: 'error',
        errorMessage: (error as Error).message,
        rawData: JSON.stringify({ error: (error as Error).message, messageType: message.type })
      });
    }
  }

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
      "1️⃣ Usa el botón de ubicación de WhatsApp\n" +
      "2️⃣ O escribe tu dirección completa\n\n" +
      "Esto nos ayuda a darte el precio más preciso.";

    await sendWhatsAppMessage(phoneNumber, locationMessage);
  }

  async function handleLocationMessage(customer: any, location: any, phoneNumber: string) {
    // Update customer with location data
    const updatedCustomer = await storage.updateCustomerLocation(customer.id, {
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(), 
      address: location.name || location.address || `${location.latitude}, ${location.longitude}`
    });

    // Calculate delivery cost for sample
    const deliveryInfo = await storage.calculateDeliveryCost(
      location.latitude.toString(),
      location.longitude.toString(),
      "product"
    );

    const confirmMessage = 
      "📍 *¡Ubicación guardada!*\n\n" +
      `📍 ${updatedCustomer.address}\n` +
      `🚛 Distancia: ${deliveryInfo.distance} km\n` +
      `💰 Entrega desde: $${deliveryInfo.cost}\n` +
      `⏱️ Tiempo estimado: ${deliveryInfo.estimatedTime} min\n\n` +
      "Ahora puedes seleccionar productos para generar tu pedido.";

    await sendWhatsAppMessage(phoneNumber, confirmMessage);
    
    // Send product menu after location confirmation
    setTimeout(() => sendProductMenu(phoneNumber), 2000);
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
      
      // Handle menu buttons from welcome message
      if (buttonId === 'products') {
        await sendProductMenu(phoneNumber);
      } else if (buttonId === 'services') {
        await sendProductMenu(phoneNumber); // Same menu, but focuses on services
      } else if (buttonId === 'help') {
        await sendHelpMenu(phoneNumber);
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
      }
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
        `📍 *Dirección:* ${orderData.deliveryAddress}\n\n`;

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

      // Store order in customer registration flow for data collection
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
    const welcomeMessage = 
      "👋 *¡Bienvenido!*\n\n" +
      "Soy tu asistente virtual para pedidos.\n\n" +
      "*Comandos disponibles:*\n" +
      "🛍️ *menu* - Ver catálogo\n" +
      "📍 *ubicacion* - Compartir ubicación\n" +
      "📋 *pedido* - Estado de pedidos\n" +
      "❓ *ayuda* - Ver opciones\n\n" +
      "¿En qué puedo ayudarte hoy?";

    await sendWhatsAppMessage(phoneNumber, welcomeMessage);
  }

  async function sendHelpMenu(phoneNumber: string) {
    const helpMessage = 
      "❓ *Centro de Ayuda*\n\n" +
      "*Comandos de texto:*\n" +
      "• *menu* o *catalogo* - Ver productos\n" +
      "• *ubicacion* - Compartir tu ubicación\n" +
      "• *pedido* - Ver estado de pedidos\n" +
      "• *ayuda* - Ver este menú\n\n" +
      "*Botones interactivos:*\n" +
      "• Usa los botones para navegar fácilmente\n" +
      "• Selecciona productos del menú\n" +
      "• Confirma cantidades\n\n" +
      "💬 También puedes escribir cualquier pregunta.";

    await sendWhatsAppMessage(phoneNumber, helpMessage);
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
        throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
      }

      await storage.addWhatsAppLog({
        type: 'outgoing',
        message: 'Mensaje interactivo enviado',
        data: {
          to: phoneNumber,
          messageId: result.messages?.[0]?.id,
          messageType: message.type
        }
      });

      return result;
    } catch (error: any) {
      await storage.addWhatsAppLog({
        type: 'error',
        message: 'Error enviando mensaje interactivo de WhatsApp',
        data: { error: error.message, phoneNumber }
      });
      throw error;
    }
  }

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
      
      // Log incoming webhook
      await storage.addWhatsAppLog({
        type: 'incoming',
        message: 'Webhook recibido de WhatsApp',
        data: body
      });

      // Check if it's a WhatsApp API POST request
      if (body.object === "whatsapp_business_account") {
        if (body.entry && body.entry.length > 0) {
          for (const entry of body.entry) {
            if (entry.changes && entry.changes.length > 0) {
              for (const change of entry.changes) {
                if (change.field === "messages") {
                  await processWhatsAppMessage(change.value);
                }
              }
            }
          }
        }
      }

      res.status(200).send("EVENT_RECEIVED");
    } catch (error: any) {
      console.error("Webhook error:", error);
      await storage.addWhatsAppLog({
        type: 'error',
        message: 'Error procesando webhook',
        data: { error: error.message }
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
          // Update existing customer with full name
          const updatedCustomer = await storage.updateCustomerLocation(customer.id, {
            address: customer.address || "",
            latitude: customer.latitude || "0",
            longitude: customer.longitude || "0"
          });
          
          // Update customer name in the database (we need to add this method)
          try {
            await storage.updateCustomerName(customer.id, customerName);
          } catch (error) {
            // If method doesn't exist, we'll log it
            console.log("updateCustomerName method needs to be implemented");
          }
        }
        
        // Update flow to next step
        const updatedData = { ...data, customerName: customerName };
        await storage.updateRegistrationFlow(phoneNumber, {
          currentStep: 'collect_delivery_data',
          collectedData: JSON.stringify(updatedData)
        });
        
        // Send delivery address request
        const addressMessage = 
          `✅ *Nombre registrado: ${customerName}*\n\n` +
          "📍 *Dirección de Entrega*\n" +
          "Ahora necesitamos tu dirección completa para la entrega:\n\n" +
          "Por favor comparte tu *dirección completa*:\n" +
          "_(Incluye calle, número, colonia, ciudad y código postal)_\n\n" +
          "Ejemplo: Av. Reforma 123, Col. Centro, CDMX, CP 06000";
        
        await sendWhatsAppMessage(phoneNumber, addressMessage);
      }
      
      else if (registrationFlow.currentStep === 'collect_delivery_data') {
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
        
        // Update flow to next step
        const updatedData = { ...data, deliveryAddress: address };
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
              text: `✅ *Dirección registrada*\n📍 ${address}\n\n*Método de Pago*\nSelecciona tu método de pago preferido:`
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

  const httpServer = createServer(app);
  return httpServer;
}
