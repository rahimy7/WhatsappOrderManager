// server/storage/tenant-storage.ts
// Implementación del storage para operaciones específicas de tienda

import { eq, desc, and, or, count, sql, ilike, gte, lt } from "drizzle-orm";
import * as schema from "@shared/schema";
import bcrypt from 'bcrypt';

import {
  TenantStorage,
  DashboardMetrics,
  ReportFilters,
  WhatsAppLogFilters,
  CartWithItems,
  TechnicianMatch,
  AutoAssignResult,
  ServicePriceCalculation,
  DeliveryCalculation,
} from "../interfaces/storage";

import {
  User,
  Customer,
  Product,
  Order,
  OrderItem,
  OrderHistory,
  Conversation,
  Message,
  WhatsAppLog,
  AutoResponse,
  CustomerRegistrationFlow,
  EmployeeProfile,
  AssignmentRule,
  Notification,
  ShoppingCart,
  ProductCategory,
  StoreSettings,
  CustomerHistory,
  InsertUser,
  InsertCustomer,
  InsertProduct,
  InsertOrder,
  InsertOrderItem,
  InsertOrderHistory,
  InsertConversation,
  InsertMessage,
  InsertWhatsAppLog,
  InsertAutoResponse,
  InsertCustomerRegistrationFlow,
  InsertEmployeeProfile,
  InsertAssignmentRule,
  InsertNotification,
  InsertShoppingCart,
  InsertProductCategory,
  InsertCustomerHistory,
  OrderItemWithProduct,
  OrderWithDetails,
  ConversationWithDetails,
} from "@shared/schema";

export class TenantStorageService implements TenantStorage {
  readonly storeId: number;

  constructor(private tenantDb: any, storeId: number) {
    this.storeId = storeId;
  }

  // ========================================
  // PRODUCTS
  // ========================================

  async getAllProducts(): Promise<Product[]> {
    try {
      return await this.tenantDb.select().from(schema.products)
        .orderBy(desc(schema.products.createdAt));
    } catch (error) {
      console.error('Error getting all products:', error);
      return [];
    }
  }

  async getProductById(id: number): Promise<Product | null> {
    try {
      const [product] = await this.tenantDb.select().from(schema.products)
        .where(eq(schema.products.id, id))
        .limit(1);
      return product || null;
    } catch (error) {
      console.error('Error getting product by ID:', error);
      return null;
    }
  }

  async getProductBySku(sku: string): Promise<Product | null> {
    try {
      const [product] = await this.tenantDb.select().from(schema.products)
        .where(eq(schema.products.sku, sku))
        .limit(1);
      return product || null;
    } catch (error) {
      console.error('Error getting product by SKU:', error);
      return null;
    }
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    try {
      const [product] = await this.tenantDb.insert(schema.products)
        .values(productData)
        .returning();
      
      console.log(`✅ Product created in store ${this.storeId}: ${product.name}`);
      return product;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product> {
    try {
      const [product] = await this.tenantDb.update(schema.products)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(schema.products.id, id))
        .returning();

      if (!product) {
        throw new Error(`Product with ID ${id} not found in store ${this.storeId}`);
      }

      console.log(`✅ Product updated in store ${this.storeId}: ${product.name}`);
      return product;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  async deleteProduct(id: number): Promise<void> {
    try {
      const result = await this.tenantDb.delete(schema.products)
        .where(eq(schema.products.id, id));

      if (result.rowCount === 0) {
        throw new Error(`Product with ID ${id} not found in store ${this.storeId}`);
      }

      console.log(`✅ Product deleted from store ${this.storeId}: ID ${id}`);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    try {
      return await this.tenantDb.select().from(schema.products)
        .where(eq(schema.products.category, category))
        .orderBy(schema.products.name);
    } catch (error) {
      console.error('Error getting products by category:', error);
      return [];
    }
  }

  async searchProducts(query: string): Promise<Product[]> {
    try {
      return await this.tenantDb.select().from(schema.products)
        .where(or(
          ilike(schema.products.name, `%${query}%`),
          ilike(schema.products.description, `%${query}%`),
          ilike(schema.products.sku, `%${query}%`),
          ilike(schema.products.brand, `%${query}%`)
        ))
        .orderBy(schema.products.name);
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  // ========================================
  // CATEGORIES
  // ========================================

  async getAllCategories(): Promise<ProductCategory[]> {
    try {
      return await this.tenantDb.select().from(schema.productCategories)
        .orderBy(schema.productCategories.name);
    } catch (error) {
      console.error('Error getting all categories:', error);
      return [];
    }
  }

  async getCategoryById(id: number): Promise<ProductCategory | null> {
    try {
      const [category] = await this.tenantDb.select().from(schema.productCategories)
        .where(eq(schema.productCategories.id, id))
        .limit(1);
      return category || null;
    } catch (error) {
      console.error('Error getting category by ID:', error);
      return null;
    }
  }

  async createCategory(categoryData: InsertProductCategory): Promise<ProductCategory> {
    try {
      const [category] = await this.tenantDb.insert(schema.productCategories)
        .values(categoryData)
        .returning();
      
      console.log(`✅ Category created in store ${this.storeId}: ${category.name}`);
      return category;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  async updateCategory(id: number, updates: Partial<InsertProductCategory>): Promise<ProductCategory> {
    try {
      const [category] = await this.tenantDb.update(schema.productCategories)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(schema.productCategories.id, id))
        .returning();

      if (!category) {
        throw new Error(`Category with ID ${id} not found in store ${this.storeId}`);
      }

      console.log(`✅ Category updated in store ${this.storeId}: ${category.name}`);
      return category;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  async deleteCategory(id: number): Promise<void> {
    try {
      const result = await this.tenantDb.delete(schema.productCategories)
        .where(eq(schema.productCategories.id, id));

      if (result.rowCount === 0) {
        throw new Error(`Category with ID ${id} not found in store ${this.storeId}`);
      }

      console.log(`✅ Category deleted from store ${this.storeId}: ID ${id}`);
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  async getActiveCategories(): Promise<ProductCategory[]> {
    try {
      return await this.tenantDb.select().from(schema.productCategories)
        .where(eq(schema.productCategories.isActive, true))
        .orderBy(schema.productCategories.sortOrder, schema.productCategories.name);
    } catch (error) {
      console.error('Error getting active categories:', error);
      return [];
    }
  }

  // ========================================
  // CUSTOMERS
  // ========================================

  async getAllCustomers(): Promise<Customer[]> {
    try {
      return await this.tenantDb.select().from(schema.customers)
        .orderBy(desc(schema.customers.lastContact));
    } catch (error) {
      console.error('Error getting all customers:', error);
      return [];
    }
  }

  async getCustomerById(id: number): Promise<Customer | null> {
    try {
      const [customer] = await this.tenantDb.select().from(schema.customers)
        .where(eq(schema.customers.id, id))
        .limit(1);
      return customer || null;
    } catch (error) {
      console.error('Error getting customer by ID:', error);
      return null;
    }
  }

  async getCustomerByPhone(phone: string): Promise<Customer | null> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phone);
      const [customer] = await this.tenantDb.select().from(schema.customers)
        .where(or(
          eq(schema.customers.phone, phone),
          eq(schema.customers.phone, normalizedPhone),
          eq(schema.customers.phone, `+52${normalizedPhone}`),
          eq(schema.customers.phone, `52${normalizedPhone}`)
        ))
        .limit(1);
      return customer || null;
    } catch (error) {
      console.error('Error getting customer by phone:', error);
      return null;
    }
  }

  async getCustomerByEmail(email: string): Promise<Customer | null> {
    try {
      const [customer] = await this.tenantDb.select().from(schema.customers)
        .where(eq(schema.customers.email, email))
        .limit(1);
      return customer || null;
    } catch (error) {
      console.error('Error getting customer by email:', error);
      return null;
    }
  }

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    try {
      const [customer] = await this.tenantDb.insert(schema.customers)
        .values(customerData)
        .returning();
      
      console.log(`✅ Customer created in store ${this.storeId}: ${customer.name}`);
      return customer;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  async updateCustomer(id: number, updates: Partial<InsertCustomer>): Promise<Customer> {
    try {
      const [customer] = await this.tenantDb.update(schema.customers)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(schema.customers.id, id))
        .returning();

      if (!customer) {
        throw new Error(`Customer with ID ${id} not found in store ${this.storeId}`);
      }

      console.log(`✅ Customer updated in store ${this.storeId}: ${customer.name}`);
      return customer;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  async deleteCustomer(id: number): Promise<void> {
    try {
      // Limpiar relaciones primero
      await this.tenantDb.delete(schema.customerHistory)
        .where(eq(schema.customerHistory.customerId, id));
      
      const conversations = await this.tenantDb.select().from(schema.conversations)
        .where(eq(schema.conversations.customerId, id));
      
      for (const conversation of conversations) {
        await this.tenantDb.delete(schema.messages)
          .where(eq(schema.messages.conversationId, conversation.id));
      }
      
      await this.tenantDb.delete(schema.conversations)
        .where(eq(schema.conversations.customerId, id));
      
      // Actualizar órdenes para remover relación
      await this.tenantDb.update(schema.orders)
        .set({ customerId: null } as any)
        .where(eq(schema.orders.customerId, id));

      // Finalmente eliminar el cliente
      const result = await this.tenantDb.delete(schema.customers)
        .where(eq(schema.customers.id, id));

      if (result.rowCount === 0) {
        throw new Error(`Customer with ID ${id} not found in store ${this.storeId}`);
      }

      console.log(`✅ Customer deleted from store ${this.storeId}: ID ${id}`);
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  async updateCustomerLocation(id: number, location: {
    latitude: string;
    longitude: string;
    address: string;
    mapLink?: string;
  }): Promise<Customer> {
    try {
      const updateData: any = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        updatedAt: new Date()
      };

      if (location.mapLink) {
        updateData.mapLink = location.mapLink;
      }

      const [customer] = await this.tenantDb.update(schema.customers)
        .set(updateData)
        .where(eq(schema.customers.id, id))
        .returning();

      if (!customer) {
        throw new Error(`Customer with ID ${id} not found in store ${this.storeId}`);
      }

      console.log(`✅ Customer location updated in store ${this.storeId}: ${customer.name}`);
      return customer;
    } catch (error) {
      console.error('Error updating customer location:', error);
      throw error;
    }
  }

  async getVipCustomers(): Promise<Customer[]> {
    try {
      return await this.tenantDb.select().from(schema.customers)
        .where(eq(schema.customers.isVip, true))
        .orderBy(desc(schema.customers.totalSpent));
    } catch (error) {
      console.error('Error getting VIP customers:', error);
      return [];
    }
  }

  // ========================================
  // ORDERS
  // ========================================

  async getAllOrders(): Promise<OrderWithDetails[]> {
    try {
      const ordersData = await this.tenantDb.select({
        order: schema.orders,
        customer: schema.customers,
        assignedUser: schema.users
      })
      .from(schema.orders)
      .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
      .leftJoin(schema.users, eq(schema.orders.assignedUserId, schema.users.id))
      .orderBy(desc(schema.orders.createdAt));

      const ordersWithDetails = await Promise.all(
        ordersData.map(async ({ order, customer, assignedUser }) => {
          const items = await this.getOrderItems(order.id);
          return {
            ...order,
            customer,
            assignedUser,
            items
          };
        })
      );

      return ordersWithDetails as OrderWithDetails[];
    } catch (error) {
      console.error('Error getting all orders:', error);
      return [];
    }
  }

  async getOrderById(id: number): Promise<OrderWithDetails | null> {
    try {
      const ordersData = await this.tenantDb.select({
        order: schema.orders,
        customer: schema.customers,
        assignedUser: schema.users
      })
      .from(schema.orders)
      .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
      .leftJoin(schema.users, eq(schema.orders.assignedUserId, schema.users.id))
      .where(eq(schema.orders.id, id));

      if (ordersData.length === 0) return null;

      const { order, customer, assignedUser } = ordersData[0];
      const items = await this.getOrderItems(id);

      return {
        ...order,
        customer,
        assignedUser,
        items
      } as OrderWithDetails;
    } catch (error) {
      console.error('Error getting order by ID:', error);
      return null;
    }
  }

  async getOrderByNumber(orderNumber: string): Promise<OrderWithDetails | null> {
    try {
      const [order] = await this.tenantDb.select().from(schema.orders)
        .where(eq(schema.orders.orderNumber, orderNumber))
        .limit(1);

      if (!order) return null;

      return await this.getOrderById(order.id);
    } catch (error) {
      console.error('Error getting order by number:', error);
      return null;
    }
  }

  async createOrder(orderData: InsertOrder, items: InsertOrderItem[]): Promise<OrderWithDetails> {
    try {
      const orderNumber = orderData.orderNumber || `ORD-${Date.now().toString().slice(-6)}`;

      const [order] = await this.tenantDb.insert(schema.orders)
        .values({ ...orderData, orderNumber })
        .returning();

      for (const item of items) {
        await this.tenantDb.insert(schema.orderItems)
          .values({ ...item, orderId: order.id });
      }

      await this.tenantDb.insert(schema.orderHistory)
        .values({
          orderId: order.id,
          statusTo: order.status,
          action: 'created'
        });

      console.log(`✅ Order created in store ${this.storeId}: ${orderNumber}`);

      // Intentar asignación automática
      setTimeout(() => this.attemptAutoAssignment(order.id), 1000);

      return await this.getOrderById(order.id) as OrderWithDetails;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  async updateOrder(id: number, updates: Partial<InsertOrder>): Promise<Order> {
    try {
      const [order] = await this.tenantDb.update(schema.orders)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(schema.orders.id, id))
        .returning();

      if (!order) {
        throw new Error(`Order with ID ${id} not found in store ${this.storeId}`);
      }

      console.log(`✅ Order updated in store ${this.storeId}: ${order.orderNumber}`);
      return order;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  async deleteOrder(id: number): Promise<void> {
    try {
      // Limpiar relaciones
      await this.tenantDb.update(schema.conversations)
        .set({ orderId: null } as any)
        .where(eq(schema.conversations.orderId, id));

      await this.tenantDb.delete(schema.orderHistory)
        .where(eq(schema.orderHistory.orderId, id));

      await this.tenantDb.delete(schema.orderItems)
        .where(eq(schema.orderItems.orderId, id));

      const result = await this.tenantDb.delete(schema.orders)
        .where(eq(schema.orders.id, id));

      if (result.rowCount === 0) {
        throw new Error(`Order with ID ${id} not found in store ${this.storeId}`);
      }

      console.log(`✅ Order deleted from store ${this.storeId}: ID ${id}`);
    } catch (error) {
      console.error('Error deleting order:', error);
      throw error;
    }
  }

  async assignOrder(orderId: number, userId: number): Promise<Order> {
    try {
      const [order] = await this.tenantDb.update(schema.orders)
        .set({
          assignedUserId: userId,
          status: 'assigned',
          updatedAt: new Date()
        } as any)
        .where(eq(schema.orders.id, orderId))
        .returning();

      if (!order) {
        throw new Error(`Order with ID ${orderId} not found in store ${this.storeId}`);
      }

      await this.tenantDb.insert(schema.orderHistory)
        .values({
          orderId,
          userId,
          statusFrom: 'pending',
          statusTo: 'assigned',
          action: 'assigned'
        } as any);

      console.log(`✅ Order assigned in store ${this.storeId}: ${order.orderNumber} to user ${userId}`);
      return order;
    } catch (error) {
      console.error('Error assigning order:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: number, status: string, userId?: number, notes?: string): Promise<Order> {
    try {
      const currentOrder = await this.tenantDb.select().from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .limit(1);

      if (currentOrder.length === 0) {
        throw new Error(`Order with ID ${orderId} not found in store ${this.storeId}`);
      }

      const [order] = await this.tenantDb.update(schema.orders)
        .set({ status, updatedAt: new Date() } as any)
        .where(eq(schema.orders.id, orderId))
        .returning();

      await this.tenantDb.insert(schema.orderHistory)
        .values({
          orderId,
          userId,
          statusFrom: currentOrder[0].status,
          statusTo: status,
          action: this.getActionFromStatus(status),
          notes
        } as any);

      console.log(`✅ Order status updated in store ${this.storeId}: ${order.orderNumber} to ${status}`);
      return order;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  async getTechnicianOrders(userId: number): Promise<OrderWithDetails[]> {
    try {
      const orders = await this.tenantDb.select().from(schema.orders)
        .where(eq(schema.orders.assignedUserId, userId))
        .orderBy(desc(schema.orders.createdAt));

      const ordersWithDetails = await Promise.all(
        orders.map(async (order) => {
          return await this.getOrderById(order.id);
        })
      );

      return ordersWithDetails.filter(order => order !== null) as OrderWithDetails[];
    } catch (error) {
      console.error('Error getting technician orders:', error);
      return [];
    }
  }

  async getOrdersByStatus(status: string): Promise<OrderWithDetails[]> {
    try {
      const orders = await this.tenantDb.select().from(schema.orders)
        .where(eq(schema.orders.status, status))
        .orderBy(desc(schema.orders.createdAt));

      const ordersWithDetails = await Promise.all(
        orders.map(async (order) => {
          return await this.getOrderById(order.id);
        })
      );

      return ordersWithDetails.filter(order => order !== null) as OrderWithDetails[];
    } catch (error) {
      console.error('Error getting orders by status:', error);
      return [];
    }
  }

  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<OrderWithDetails[]> {
    try {
      const orders = await this.tenantDb.select().from(schema.orders)
        .where(and(
          gte(schema.orders.createdAt, startDate),
          lt(schema.orders.createdAt, endDate)
        ))
        .orderBy(desc(schema.orders.createdAt));

      const ordersWithDetails = await Promise.all(
        orders.map(async (order) => {
          return await this.getOrderById(order.id);
        })
      );

      return ordersWithDetails.filter(order => order !== null) as OrderWithDetails[];
    } catch (error) {
      console.error('Error getting orders by date range:', error);
      return [];
    }
  }

  // ========================================
  // ORDER ITEMS & HISTORY
  // ========================================

  async getOrderItems(orderId: number): Promise<OrderItemWithProduct[]> {
    try {
      const items = await this.tenantDb.select()
        .from(schema.orderItems)
        .leftJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
        .where(eq(schema.orderItems.orderId, orderId));

      return items.map(({ order_items, products: product }) => ({
        ...order_items,
        product: product || undefined
      })) as OrderItemWithProduct[];
    } catch (error) {
      console.error('Error getting order items:', error);
      return [];
    }
  }

  async createOrderItem(orderItemData: InsertOrderItem): Promise<OrderItem> {
    try {
      const [orderItem] = await this.tenantDb.insert(schema.orderItems)
        .values(orderItemData)
        .returning();
      return orderItem;
    } catch (error) {
      console.error('Error creating order item:', error);
      throw error;
    }
  }

  async updateOrderItem(id: number, updates: Partial<InsertOrderItem>): Promise<OrderItem> {
    try {
      const [orderItem] = await this.tenantDb.update(schema.orderItems)
        .set(updates)
        .where(eq(schema.orderItems.id, id))
        .returning();

      if (!orderItem) {
        throw new Error(`Order item with ID ${id} not found in store ${this.storeId}`);
      }

      return orderItem;
    } catch (error) {
      console.error('Error updating order item:', error);
      throw error;
    }
  }

  async deleteOrderItem(id: number): Promise<void> {
    try {
      const result = await this.tenantDb.delete(schema.orderItems)
        .where(eq(schema.orderItems.id, id));

      if (result.rowCount === 0) {
        throw new Error(`Order item with ID ${id} not found in store ${this.storeId}`);
      }
    } catch (error) {
      console.error('Error deleting order item:', error);
      throw error;
    }
  }

  async getOrderHistory(orderId: number): Promise<OrderHistory[]> {
    try {
      return await this.tenantDb.select().from(schema.orderHistory)
        .where(eq(schema.orderHistory.orderId, orderId))
        .orderBy(desc(schema.orderHistory.timestamp));
    } catch (error) {
      console.error('Error getting order history:', error);
      return [];
    }
  }

  async addOrderHistory(historyData: InsertOrderHistory): Promise<OrderHistory> {
    try {
      const [history] = await this.tenantDb.insert(schema.orderHistory)
        .values(historyData)
        .returning();
      return history;
    } catch (error) {
      console.error('Error adding order history:', error);
      throw error;
    }
  }

  // ========================================
  // PRIVATE UTILITY METHODS
  // ========================================

  private normalizePhoneNumber(phone: string): string {
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (digitsOnly.startsWith('52') && digitsOnly.length > 10) {
      return digitsOnly;
    } else if (!digitsOnly.startsWith('52') && digitsOnly.length === 10) {
      return '52' + digitsOnly;
    }
    return digitsOnly;
  }

  private getActionFromStatus(status: string): string {
    switch (status) {
      case 'assigned': return 'assigned';
      case 'in_progress': return 'started';
      case 'completed': return 'completed';
      case 'cancelled': return 'cancelled';
      default: return 'updated';
    }
  }

  private async attemptAutoAssignment(orderId: number): Promise<void> {
    try {
      const result = await this.autoAssignOrder(orderId);
      if (result.success && result.assignedTechnician) {
        console.log(`🤖 Auto-assigned order ${orderId} to ${result.assignedTechnician.user.name} in store ${this.storeId}`);
      }
    } catch (error) {
      console.error(`Error in auto-assignment for order ${orderId}:`, error);
    }
  }

  // ========================================
  // CONVERSATIONS & MESSAGES (continuará en siguiente parte...)
  // ========================================

  async getAllConversations(): Promise<ConversationWithDetails[]> {
    try {
      const conversations = await this.tenantDb.select().from(schema.conversations)
        .orderBy(desc(schema.conversations.lastMessageAt));

      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conv) => {
          const customer = await this.getCustomerById(conv.customerId);
          const order = conv.orderId ? await this.getOrderById(conv.orderId) : undefined;
          const lastMessage = await this.getLastMessage(conv.id);
          const unreadCount = await this.getUnreadMessagesCount(conv.id);

          return {
            ...conv,
            customer,
            order,
            lastMessage,
            unreadCount
          };
        })
      );

      return conversationsWithDetails.filter(conv => conv.customer) as ConversationWithDetails[];
    } catch (error) {
      console.error('Error getting all conversations:', error);
      return [];
    }
  }

  async getConversationById(id: number): Promise<ConversationWithDetails | null> {
    try {
      const [conversation] = await this.tenantDb.select().from(schema.conversations)
        .where(eq(schema.conversations.id, id))
        .limit(1);

      if (!conversation) return null;

      const customer = await this.getCustomerById(conversation.customerId);
      if (!customer) return null;

      const order = conversation.orderId ? await this.getOrderById(conversation.orderId) : undefined;
      const lastMessage = await this.getLastMessage(id);
      const unreadCount = await this.getUnreadMessagesCount(id);

      return {
        ...conversation,
        customer,
        order,
        lastMessage,
        unreadCount
      };
    } catch (error) {
      console.error('Error getting conversation by ID:', error);
      return null;
    }
  }

  async getConversationByCustomerId(customerId: number): Promise<ConversationWithDetails | null> {
    try {
      const [conversation] = await this.tenantDb.select().from(schema.conversations)
        .where(eq(schema.conversations.customerId, customerId))
        .limit(1);

      if (!conversation) return null;

      return await this.getConversationById(conversation.id);
    } catch (error) {
      console.error('Error getting conversation by customer ID:', error);
      return null;
    }
  }

  async getConversationByCustomerPhone(phone: string): Promise<ConversationWithDetails | null> {
    try {
      const customer = await this.getCustomerByPhone(phone);
      if (!customer) return null;

      return await this.getConversationByCustomerId(customer.id);
    } catch (error) {
      console.error('Error getting conversation by customer phone:', error);
      return null;
    }
  }

  async createConversation(conversationData: InsertConversation): Promise<Conversation> {
    try {
      const [conversation] = await this.tenantDb.insert(schema.conversations)
        .values(conversationData)
        .returning();
      
      console.log(`✅ Conversation created in store ${this.storeId}: ID ${conversation.id}`);
      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async updateConversation(id: number, updates: Partial<InsertConversation>): Promise<Conversation> {
    try {
      const [conversation] = await this.tenantDb.update(schema.conversations)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(schema.conversations.id, id))
        .returning();

      if (!conversation) {
        throw new Error(`Conversation with ID ${id} not found in store ${this.storeId}`);
      }

      return conversation;
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  }

  async getActiveConversations(): Promise<ConversationWithDetails[]> {
    try {
      const conversations = await this.tenantDb.select().from(schema.conversations)
        .where(eq(schema.conversations.status, 'active'))
        .orderBy(desc(schema.conversations.lastMessageAt));

      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conv) => {
          return await this.getConversationById(conv.id);
        })
      );

      return conversationsWithDetails.filter(conv => conv !== null) as ConversationWithDetails[];
    } catch (error) {
      console.error('Error getting active conversations:', error);
      return [];
    }
  }

  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    try {
      return await this.tenantDb.select().from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(schema.messages.createdAt);
    } catch (error) {
      console.error('Error getting messages by conversation:', error);
      return [];
    }
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    try {
      const [message] = await this.tenantDb.insert(schema.messages)
        .values(messageData)
        .returning();

      // Actualizar timestamp de última actividad en la conversación
      await this.tenantDb.update(schema.conversations)
        .set({ lastMessageAt: new Date() } as any)
        .where(eq(schema.conversations.id, messageData.conversationId));

      return message;
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  async markMessagesAsRead(conversationId: number): Promise<void> {
    try {
      await this.tenantDb.update(schema.messages)
        .set({ isRead: true } as any)
        .where(and(
          eq(schema.messages.conversationId, conversationId),
          eq(schema.messages.senderType, 'customer')
        ));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  private async getLastMessage(conversationId: number): Promise<Message | undefined> {
    try {
      const [message] = await this.tenantDb.select().from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(desc(schema.messages.createdAt))
        .limit(1);
      return message;
    } catch (error) {
      console.error('Error getting last message:', error);
      return undefined;
    }
  }

  private async getUnreadMessagesCount(conversationId: number): Promise<number> {
    try {
      const [result] = await this.tenantDb.select({ count: count() })
        .from(schema.messages)
        .where(and(
          eq(schema.messages.conversationId, conversationId),
          eq(schema.messages.senderType, 'customer'),
          eq(schema.messages.isRead, false)
        ));
      return result.count;
    } catch (error) {
      console.error('Error getting unread messages count:', error);
      return 0;
    }
  }

  // ========================================
  // STUB METHODS (to be implemented...)
  // ========================================

  // Auto Responses
  async getAllAutoResponses(): Promise<AutoResponse[]> { return []; }
  async getAutoResponseById(id: number): Promise<AutoResponse | null> { return null; }
  async getAutoResponsesByTrigger(trigger: string): Promise<AutoResponse[]> { return []; }
  async getAutoResponseByTrigger(trigger: string): Promise<AutoResponse | null> { return null; }
  async createAutoResponse(responseData: InsertAutoResponse): Promise<AutoResponse> { throw new Error('Not implemented'); }
  async updateAutoResponse(id: number, updates: Partial<InsertAutoResponse>): Promise<AutoResponse> { throw new Error('Not implemented'); }
  async deleteAutoResponse(id: number): Promise<void> { throw new Error('Not implemented'); }
  async getActiveAutoResponses(): Promise<AutoResponse[]> { return []; }
  async resetAutoResponsesToDefault(): Promise<void> { throw new Error('Not implemented'); }

  // Customer Registration Flows
  async getRegistrationFlow(phoneNumber: string): Promise<CustomerRegistrationFlow | null> { return null; }
  async getRegistrationFlowByCustomerId(customerId: number): Promise<CustomerRegistrationFlow | null> { return null; }
  async getAllRegistrationFlows(): Promise<CustomerRegistrationFlow[]> { return []; }
  async createRegistrationFlow(flowData: InsertCustomerRegistrationFlow): Promise<CustomerRegistrationFlow> { throw new Error('Not implemented'); }
  async createOrUpdateRegistrationFlow(flowData: any): Promise<CustomerRegistrationFlow> { throw new Error('Not implemented'); }
  async updateRegistrationFlow(phoneNumber: string, updates: Partial<InsertCustomerRegistrationFlow>): Promise<CustomerRegistrationFlow> { throw new Error('Not implemented'); }
  async updateRegistrationFlowStep(customerId: number, newStep: string, newData?: any): Promise<CustomerRegistrationFlow> { throw new Error('Not implemented'); }
  async deleteRegistrationFlow(customerId: number): Promise<void> { throw new Error('Not implemented'); }

  // Employee Profiles & Assignment (continuaría...)
  async getAllEmployeeProfiles(): Promise<(EmployeeProfile & { user: User })[]> { return []; }
  async getEmployeeProfile(userId: number): Promise<EmployeeProfile | null> { return null; }
  async getEmployeeProfileByEmployeeId(employeeId: string): Promise<EmployeeProfile | null> { return null; }
  async createEmployeeProfile(profileData: InsertEmployeeProfile): Promise<EmployeeProfile> { throw new Error('Not implemented'); }
  async updateEmployeeProfile(id: number, updates: Partial<InsertEmployeeProfile>): Promise<EmployeeProfile> { throw new Error('Not implemented'); }
  async deleteEmployeeProfile(id: number): Promise<void> { throw new Error('Not implemented'); }
  async getEmployeesByDepartment(department: string): Promise<(EmployeeProfile & { user: User })[]> { return []; }
  async generateEmployeeId(department: string): Promise<string> { return 'EMP-001'; }
  async getAvailableTechnicians(specializations?: string[], maxDistance?: number, customerLocation?: { latitude: string; longitude: string }): Promise<(EmployeeProfile & { user: User })[]> { return []; }

  // Assignment Rules & Auto Assignment
  async getAllAssignmentRules(): Promise<AssignmentRule[]> { return []; }
  async getAssignmentRule(id: number): Promise<AssignmentRule | null> { return null; }
  async createAssignmentRule(ruleData: InsertAssignmentRule): Promise<AssignmentRule> { throw new Error('Not implemented'); }
  async updateAssignmentRule(id: number, updates: Partial<InsertAssignmentRule>): Promise<AssignmentRule> { throw new Error('Not implemented'); }
  async deleteAssignmentRule(id: number): Promise<void> { throw new Error('Not implemented'); }
  async getActiveAssignmentRules(): Promise<AssignmentRule[]> { return []; }
  async findBestTechnician(orderId: number, customerLocation?: { latitude: string; longitude: string }): Promise<TechnicianMatch | null> { return null; }
  async autoAssignOrder(orderId: number): Promise<AutoAssignResult> { return { success: false, reason: 'Not implemented' }; }

  // Notifications & Other methods...
  async getUserNotifications(userId: number): Promise<Notification[]> { return []; }
  async getUnreadNotifications(userId: number): Promise<Notification[]> { return []; }
  async createNotification(notificationData: InsertNotification): Promise<Notification> { throw new Error('Not implemented'); }
  async markNotificationAsRead(id: number): Promise<Notification> { throw new Error('Not implemented'); }
  async markAllNotificationsAsRead(userId: number): Promise<void> { throw new Error('Not implemented'); }
  async deleteNotification(id: number): Promise<void> { throw new Error('Not implemented'); }
  async getNotificationCounts(userId: number): Promise<{ total: number; unread: number }> { return { total: 0, unread: 0 }; }

  // Shopping Cart
  async getCart(sessionId: string, userId?: number): Promise<CartWithItems> { return { items: [], subtotal: 0 }; }
  async addToCart(sessionId: string, productId: number, quantity: number, userId?: number): Promise<void> { throw new Error('Not implemented'); }
  async updateCartQuantity(sessionId: string, productId: number, quantity: number, userId?: number): Promise<void> { throw new Error('Not implemented'); }
  async removeFromCart(sessionId: string, productId: number, userId?: number): Promise<void> { throw new Error('Not implemented'); }
  async clearCart(sessionId: string, userId?: number): Promise<void> { throw new Error('Not implemented'); }

  // Customer History
  async getCustomerHistory(customerId: number): Promise<CustomerHistory[]> { return []; }
  async addCustomerHistoryEntry(entryData: InsertCustomerHistory): Promise<CustomerHistory> { throw new Error('Not implemented'); }
  async updateCustomerStats(customerId: number): Promise<void> { throw new Error('Not implemented'); }
  async getCustomerWithHistory(customerId: number): Promise<Customer & { history: CustomerHistory[] } | null> { return null; }

  // WhatsApp (Tenant Specific)
  async addWhatsAppLog(logData: InsertWhatsAppLog): Promise<WhatsAppLog> { throw new Error('Not implemented'); }
  async getWhatsAppLogs(limit?: number, offset?: number, filters?: WhatsAppLogFilters): Promise<WhatsAppLog[]> { return []; }

  // Store Settings
  async getStoreSettings(): Promise<StoreSettings | null> { return null; }
  async updateStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> { throw new Error('Not implemented'); }

  // Tenant Users (Operational)
  async getAllUsers(): Promise<User[]> { return []; }
  async getUserById(id: number): Promise<User | null> { return null; }
  async getUserByUsername(username: string): Promise<User | null> { return null; }
  async createUser(userData: InsertUser): Promise<User> { throw new Error('Not implemented'); }
  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> { throw new Error('Not implemented'); }
  async deleteUser(id: number): Promise<void> { throw new Error('Not implemented'); }
  async getUsersByRole(role: string): Promise<User[]> { return []; }

  // Metrics & Analytics
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    return {
      ordersToday: 0,
      activeConversations: 0,
      activeTechnicians: 0,
      dailyRevenue: 0
    };
  }
  async getDashboardStats(): Promise<DashboardMetrics> { return this.getDashboardMetrics(); }
  async getReports(filters: ReportFilters): Promise<any> { return {}; }
  async calculateServicePrice(serviceId: number, installationComplexity: number, partsNeeded: Array<{productId: number; quantity: number}>, customerLatitude?: string, customerLongitude?: string): Promise<ServicePriceCalculation> {
    return {
      basePrice: 0,
      installationCost: 0,
      partsCost: 0,
      laborHours: 0,
      laborRate: 0,
      deliveryCost: 0,
      deliveryDistance: 0,
      totalPrice: 0
    };
  }

  // Utilities
  async determineConversationType(customerId: number): Promise<'initial' | 'tracking' | 'support'> { return 'initial'; }
}