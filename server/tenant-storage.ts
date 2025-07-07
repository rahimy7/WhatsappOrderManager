/**
 * Sistema de storage multi-tenant que utiliza la base de datos específica de cada tienda
 */
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../shared/schema";
import { eq, desc, and, or, count, sql, ilike } from "drizzle-orm";

/**
 * Crea un storage específico para la base de datos tenant del request
 */
export function createTenantStorage(tenantDb: any) {
  return {
    // Orders
    async getAllOrders() {
      return await tenantDb.select().from(schema.orders).orderBy(desc(schema.orders.createdAt));
    },

    async getOrderById(id: number) {
      const [order] = await tenantDb.select().from(schema.orders).where(eq(schema.orders.id, id));
      return order || null;
    },

    async createOrder(orderData: any) {
      const [order] = await tenantDb.insert(schema.orders).values(orderData).returning();
      return order;
    },

    async updateOrder(id: number, orderData: any) {
      const [order] = await tenantDb.update(schema.orders)
        .set(orderData)
        .where(eq(schema.orders.id, id))
        .returning();
      return order;
    },

    async deleteOrder(id: number) {
      await tenantDb.delete(schema.orders).where(eq(schema.orders.id, id));
    },

    // Order Items
    async createOrderItem(orderItemData: any) {
      const [orderItem] = await tenantDb.insert(schema.orderItems).values(orderItemData).returning();
      return orderItem;
    },

    async getOrderItems(orderId: number) {
      return await tenantDb.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
    },

    // Products
    async getAllProducts() {
      return await tenantDb.select().from(schema.products).orderBy(desc(schema.products.createdAt));
    },

    async getProductById(id: number) {
      const [product] = await tenantDb.select().from(schema.products).where(eq(schema.products.id, id));
      return product || null;
    },

    async createProduct(productData: any) {
      const [product] = await tenantDb.insert(schema.products).values(productData).returning();
      return product;
    },

    async updateProduct(id: number, productData: any) {
      const [product] = await tenantDb.update(schema.products)
        .set(productData)
        .where(eq(schema.products.id, id))
        .returning();
      return product;
    },

    async deleteProduct(id: number) {
      await tenantDb.delete(schema.products).where(eq(schema.products.id, id));
    },

    // Categories
    async getAllCategories() {
      return await tenantDb.select().from(schema.categories).orderBy(schema.categories.name);
    },

    async getCategoryById(id: number) {
      const [category] = await tenantDb.select().from(schema.categories).where(eq(schema.categories.id, id));
      return category || null;
    },

    async createCategory(categoryData: any) {
      const [category] = await tenantDb.insert(schema.categories).values(categoryData).returning();
      return category;
    },

    async updateCategory(id: number, categoryData: any) {
      const [category] = await tenantDb.update(schema.categories)
        .set(categoryData)
        .where(eq(schema.categories.id, id))
        .returning();
      return category;
    },

    async deleteCategory(id: number) {
      await tenantDb.delete(schema.categories).where(eq(schema.categories.id, id));
    },

    // Customers
    async getAllCustomers() {
      return await tenantDb.select().from(schema.customers).orderBy(desc(schema.customers.lastContact));
    },

    async getCustomerById(id: number) {
      const [customer] = await tenantDb.select().from(schema.customers).where(eq(schema.customers.id, id));
      return customer || null;
    },

    async getCustomerByPhone(phone: string) {
      const normalizedPhone = phone.replace(/\D/g, ''); // Remove non-digits
      const [customer] = await tenantDb.select().from(schema.customers)
        .where(
          or(
            eq(schema.customers.phone, phone),
            eq(schema.customers.phone, normalizedPhone),
            eq(schema.customers.phone, `+52${normalizedPhone}`),
            eq(schema.customers.phone, `+52 ${normalizedPhone.slice(0, 2)} ${normalizedPhone.slice(2, 6)} ${normalizedPhone.slice(6)}`)
          )
        );
      return customer || null;
    },

    async createCustomer(customerData: any) {
      const [customer] = await tenantDb.insert(schema.customers).values(customerData).returning();
      return customer;
    },

    async updateCustomer(id: number, customerData: any) {
      const [customer] = await tenantDb.update(schema.customers)
        .set(customerData)
        .where(eq(schema.customers.id, id))
        .returning();
      return customer;
    },

    async deleteCustomer(id: number) {
      await tenantDb.delete(schema.customers).where(eq(schema.customers.id, id));
    },

    // Conversations
    async getAllConversations() {
      return await tenantDb.select().from(schema.conversations).orderBy(desc(schema.conversations.lastMessageAt));
    },

    async getConversationById(id: number) {
      const [conversation] = await tenantDb.select().from(schema.conversations).where(eq(schema.conversations.id, id));
      return conversation || null;
    },

    async createConversation(conversationData: any) {
      const [conversation] = await tenantDb.insert(schema.conversations).values(conversationData).returning();
      return conversation;
    },

    async getConversationByCustomerPhone(phone: string) {
      // First normalize the phone number
      const normalizedPhone = phone.replace(/\D/g, '');
      
      // Find customer first
      const [customer] = await tenantDb.select().from(schema.customers)
        .where(
          or(
            eq(schema.customers.phone, phone),
            eq(schema.customers.phone, normalizedPhone),
            eq(schema.customers.phone, `+52${normalizedPhone}`),
            eq(schema.customers.phone, `52${normalizedPhone}`)
          )
        )
        .limit(1);

      if (!customer) return null;

      // Then find conversation for this customer
      const [conversation] = await tenantDb.select().from(schema.conversations)
        .where(eq(schema.conversations.customerId, customer.id))
        .limit(1);

      return conversation || null;
    },

    async updateConversation(id: number, conversationData: any) {
      const [conversation] = await tenantDb.update(schema.conversations)
        .set(conversationData)
        .where(eq(schema.conversations.id, id))
        .returning();
      return conversation;
    },

    // Auto-responses
    async getAllAutoResponses() {
      return await tenantDb.select().from(schema.autoResponses)
        .where(eq(schema.autoResponses.isActive, true))
        .orderBy(schema.autoResponses.id);
    },

    // Messages
    async getMessagesByConversation(conversationId: number) {
      return await tenantDb.select().from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(schema.messages.createdAt);
    },

    async createMessage(messageData: any) {
      const [message] = await tenantDb.insert(schema.messages).values(messageData).returning();
      return message;
    },

    // Dashboard metrics
    async getDashboardMetrics() {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const totalOrders = await tenantDb.select({ count: count() }).from(schema.orders);
      const pendingOrders = await tenantDb.select({ count: count() })
        .from(schema.orders)
        .where(eq(schema.orders.status, 'pending'));
      const todayOrders = await tenantDb.select({ count: count() })
        .from(schema.orders)
        .where(sql`DATE(created_at) = DATE(NOW())`);

      const totalConversations = await tenantDb.select({ count: count() }).from(schema.conversations);
      const totalCustomers = await tenantDb.select({ count: count() }).from(schema.customers);

      return {
        totalOrders: totalOrders[0]?.count || 0,
        pendingOrders: pendingOrders[0]?.count || 0,
        todayOrders: todayOrders[0]?.count || 0,
        totalConversations: totalConversations[0]?.count || 0,
        totalCustomers: totalCustomers[0]?.count || 0,
        dailyRevenue: 0, // Calcular según necesidad
        averageOrderValue: 0,
        activeTechnicians: 0
      };
    },

    // Auto Responses
    async getAutoResponsesByTrigger(trigger: string) {
      return await tenantDb.select().from(schema.autoResponses)
        .where(and(
          eq(schema.autoResponses.trigger, trigger),
          eq(schema.autoResponses.isActive, true)
        ))
        .orderBy(schema.autoResponses.priority);
    },

    // Customer Registration Flows - Enhanced for order completion
    async getRegistrationFlow(phoneNumber: string) {
      const [flow] = await tenantDb.select().from(schema.customerRegistrationFlows)
        .where(eq(schema.customerRegistrationFlows.phoneNumber, phoneNumber));
      return flow || null;
    },

    async getRegistrationFlowByCustomerId(customerId: number) {
      try {
        const result = await tenantDb.execute(
          sql`SELECT * FROM customer_registration_flows WHERE customer_id = ${customerId} LIMIT 1`
        );
        return result.rows[0] || null;
      } catch (error) {
        console.log('Error getting registration flow:', error);
        return null;
      }
    },

    async createRegistrationFlow(flow: any) {
      const [newFlow] = await tenantDb.insert(schema.customerRegistrationFlows).values(flow).returning();
      return newFlow;
    },

    async createOrUpdateRegistrationFlow(flowData: any) {
      try {
        // Get customer phone number first
        const customerResult = await tenantDb.execute(
          sql`SELECT phone_number FROM customers WHERE id = ${flowData.customerId} LIMIT 1`
        );
        
        if (!customerResult.rows[0]) {
          throw new Error(`Customer not found: ${flowData.customerId}`);
        }
        
        const phoneNumber = customerResult.rows[0].phone_number;

        // Check if flow exists
        const existingResult = await tenantDb.execute(
          sql`SELECT * FROM customer_registration_flows WHERE customer_id = ${flowData.customerId} LIMIT 1`
        );

        const collectedDataStr = typeof flowData.collectedData === 'string' 
          ? flowData.collectedData 
          : JSON.stringify(flowData.collectedData);

        if (existingResult.rows[0]) {
          // Update existing flow
          const updateResult = await tenantDb.execute(
            sql`UPDATE customer_registration_flows 
                SET current_step = ${flowData.currentStep},
                    collected_data = ${collectedDataStr},
                    requested_service = ${flowData.flowType || 'order_completion'},
                    expires_at = ${flowData.expiresAt},
                    is_completed = false,
                    updated_at = NOW()
                WHERE customer_id = ${flowData.customerId}
                RETURNING *`
          );
          return updateResult.rows[0];
        } else {
          // Create new flow
          const insertResult = await tenantDb.execute(
            sql`INSERT INTO customer_registration_flows 
                (customer_id, phone_number, current_step, collected_data, requested_service, expires_at, is_completed, created_at, updated_at)
                VALUES (${flowData.customerId}, ${phoneNumber}, ${flowData.currentStep}, ${collectedDataStr}, ${flowData.flowType || 'order_completion'}, ${flowData.expiresAt}, false, NOW(), NOW())
                RETURNING *`
          );
          return insertResult.rows[0];
        }
      } catch (error) {
        console.error('Error in createOrUpdateRegistrationFlow:', error);
        throw error;
      }
    },

    async updateRegistrationFlow(phoneNumber: string, updates: any) {
      const [updatedFlow] = await tenantDb.update(schema.customerRegistrationFlows)
        .set(updates)
        .where(eq(schema.customerRegistrationFlows.phoneNumber, phoneNumber))
        .returning();
      return updatedFlow || null;
    },

    async updateRegistrationFlowStep(customerId: number, newStep: string, newData?: any) {
      const updates: any = {
        currentStep: newStep,
        updatedAt: new Date()
      };

      if (newData) {
        updates.collectedData = newData;
      }

      const [updatedFlow] = await tenantDb
        .update(schema.customerRegistrationFlows)
        .set(updates)
        .where(eq(schema.customerRegistrationFlows.customerId, customerId))
        .returning();
      return updatedFlow;
    },

    async deleteRegistrationFlow(customerId: number) {
      try {
        await tenantDb
          .delete(schema.customerRegistrationFlows)
          .where(eq(schema.customerRegistrationFlows.customerId, customerId));
      } catch (error) {
        console.error('Error deleting registration flow:', error);
      }
    },

    // Conversations by customer
    async getConversationByCustomerId(customerId: number) {
      const [conversation] = await tenantDb.select().from(schema.conversations)
        .where(eq(schema.conversations.customerId, customerId));
      return conversation || null;
    },

    // WhatsApp Logs
    async addWhatsAppLog(log: any) {
      const [newLog] = await tenantDb.insert(schema.whatsappLogs).values(log).returning();
      return newLog;
    },

    // Auto Responses
    async getAllAutoResponses() {
      return await tenantDb.select().from(schema.autoResponses)
        .orderBy(desc(schema.autoResponses.createdAt));
    },

    async getAutoResponseByTrigger(trigger: string) {
      const [response] = await tenantDb.select().from(schema.autoResponses)
        .where(and(
          eq(schema.autoResponses.trigger, trigger),
          eq(schema.autoResponses.isActive, true)
        ));
      return response || null;
    },

    async getActiveAutoResponses() {
      return await tenantDb.select().from(schema.autoResponses)
        .where(eq(schema.autoResponses.isActive, true))
        .orderBy(desc(schema.autoResponses.createdAt));
    },

    // WhatsApp Settings
    async getAllWhatsAppConfigs(storeId: number) {
      return await tenantDb.select().from(schema.whatsappSettings)
        .where(eq(schema.whatsappSettings.storeId, storeId))
        .orderBy(desc(schema.whatsappSettings.createdAt));
    },

    async getWhatsAppConfig(storeId: number) {
      const configs = await tenantDb.select().from(schema.whatsappSettings)
        .where(and(
          eq(schema.whatsappSettings.storeId, storeId),
          eq(schema.whatsappSettings.isActive, true)
        ))
        .orderBy(desc(schema.whatsappSettings.createdAt))
        .limit(1);
      return configs[0] || null;
    },

    async updateWhatsAppConfig(configData: any, storeId: number) {
      const existingConfigs = await tenantDb.select().from(schema.whatsappSettings)
        .where(eq(schema.whatsappSettings.storeId, storeId))
        .limit(1);
      
      if (existingConfigs.length > 0) {
        // Update existing configuration
        const [updated] = await tenantDb.update(schema.whatsappSettings)
          .set({
            accessToken: configData.accessToken,
            phoneNumberId: configData.phoneNumberId,
            webhookVerifyToken: configData.webhookVerifyToken,
            businessAccountId: configData.businessAccountId,
            appId: configData.appId,
            isActive: configData.isActive ?? true,
            updatedAt: new Date()
          })
          .where(eq(schema.whatsappSettings.id, existingConfigs[0].id))
          .returning();
        return updated;
      } else {
        // Create new configuration
        const [created] = await tenantDb.insert(schema.whatsappSettings)
          .values({
            storeId: storeId,
            accessToken: configData.accessToken,
            phoneNumberId: configData.phoneNumberId,
            webhookVerifyToken: configData.webhookVerifyToken,
            businessAccountId: configData.businessAccountId,
            appId: configData.appId,
            isActive: configData.isActive ?? true,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        return created;
      }
    }
  };
}