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

    async updateConversation(id: number, conversationData: any) {
      const [conversation] = await tenantDb.update(schema.conversations)
        .set(conversationData)
        .where(eq(schema.conversations.id, id))
        .returning();
      return conversation;
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

    // Customer Registration Flows
    async getRegistrationFlow(phoneNumber: string) {
      const [flow] = await tenantDb.select().from(schema.customerRegistrationFlows)
        .where(eq(schema.customerRegistrationFlows.phoneNumber, phoneNumber));
      return flow || null;
    },

    async createRegistrationFlow(flow: any) {
      const [newFlow] = await tenantDb.insert(schema.customerRegistrationFlows).values(flow).returning();
      return newFlow;
    },

    async updateRegistrationFlow(phoneNumber: string, updates: any) {
      const [updatedFlow] = await tenantDb.update(schema.customerRegistrationFlows)
        .set(updates)
        .where(eq(schema.customerRegistrationFlows.phoneNumber, phoneNumber))
        .returning();
      return updatedFlow || null;
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
        .where(eq(schema.autoResponses.trigger, trigger));
      return response || null;
    },

    async getActiveAutoResponses() {
      return await tenantDb.select().from(schema.autoResponses)
        .where(eq(schema.autoResponses.isActive, true))
        .orderBy(desc(schema.autoResponses.createdAt));
    }
  };
}