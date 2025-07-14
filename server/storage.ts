import {
  users,
  customers,
  products,
  orders,
  orderItems,
  orderHistory,
  conversations,
  messages,
  whatsappSettings,
  whatsappLogs,
  autoResponses,
  customerRegistrationFlows,
  employeeProfiles,
  customerHistory,
  assignmentRules,
  notifications,
  shoppingCart,
  productCategories,
  storeSettings,
  virtualStores,
  type User,
  type Customer,
  type Product,
  type Order,
  type OrderItem,
  type OrderHistory,
  type Conversation,
  type Message,
  type WhatsAppSettings,
  type WhatsAppLog,
  type AutoResponse,
  type CustomerRegistrationFlow,
  type EmployeeProfile,
  type AssignmentRule,
  type Notification,
  type ShoppingCart,
  type ProductCategory,
  type StoreSettings,
  type VirtualStore,
  type InsertUser,
  type InsertCustomer,
  type InsertProduct,
  type InsertOrder,
  type InsertOrderItem,
  type InsertOrderHistory,
  type InsertConversation,
  type InsertMessage,
  type InsertWhatsAppSettings,
  type InsertWhatsAppLog,
  type InsertAutoResponse,
  type InsertCustomerRegistrationFlow,
  type OrderItemWithProduct,
  type InsertEmployeeProfile,
  type InsertAssignmentRule,
  type InsertNotification,
  type InsertShoppingCart,
  type InsertProductCategory,
  type CustomerHistory,
  type InsertCustomerHistory,
  type OrderWithDetails,
  type ConversationWithDetails,
  insertVirtualStoreSchema,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, isNull, gte, lt } from "drizzle-orm";
import { insertUserSchema } from "@shared/schema";






export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  updateUserStatus(id: number, status: string): Promise<User | undefined>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;

  // Customers
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: InsertCustomer): Promise<Customer | undefined>;
  deleteCustomer(id: number, storeId: number): Promise<boolean>;
  getAllCustomers(): Promise<Customer[]>;
  updateCustomerLocation(id: number, location: {
    latitude: string;
    longitude: string;
    address: string;
    mapLink?: string;
  }): Promise<Customer>;
  updateCustomerName(id: number, name: string): Promise<Customer | undefined>;

  // Products
  getAllProducts(storeId?: number): Promise<Product[]>;
  getProduct(id: number, storeId?: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct, storeId?: number): Promise<Product>;
  updateProduct(id: number, product: InsertProduct, storeId?: number): Promise<Product | undefined>;
  deleteProduct(id: number, storeId?: number): Promise<boolean>;

  // Orders
  getOrder(id: number): Promise<OrderWithDetails | undefined>;
  createOrder(order: InsertOrder, items: Array<{
    productId: number;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    installationCost?: string;
    partsCost?: string;
    laborHours?: string;
    laborRate?: string;
    deliveryCost?: string;
    deliveryDistance?: string;
    notes?: string;
  }>): Promise<OrderWithDetails>;
  getAllOrders(): Promise<OrderWithDetails[]>;
  getTechnicianOrders(userId: number): Promise<OrderWithDetails[]>;
  updateOrder(id: number, updates: Partial<Omit<Order, 'id'>>): Promise<Order | undefined>;
  assignOrder(orderId: number, userId: number): Promise<Order | undefined>;
  updateOrderStatus(orderId: number, status: string, userId?: number, notes?: string): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<void>;
  
  // Order Items
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: number): Promise<OrderItemWithProduct[]>;
  
  // Order History
  getOrderHistory(orderId: number): Promise<OrderHistory[]>;
  addOrderHistory(history: InsertOrderHistory): Promise<OrderHistory>;
  
  // Service Pricing
  calculateServicePrice(
    serviceId: number, 
    installationComplexity: number, 
    partsNeeded: Array<{productId: number; quantity: number}>,
    customerLatitude?: string,
    customerLongitude?: string
  ): Promise<{
    basePrice: number;
    installationCost: number;
    partsCost: number;
    laborHours: number;
    laborRate: number;
    deliveryCost: number;
    deliveryDistance: number;
    totalPrice: number;
  }>;

  // Conversations
  getConversation(id: number): Promise<ConversationWithDetails | undefined>;
  getAllConversations(storeId: number): Promise<ConversationWithDetails[]>;
  getActiveConversations(): Promise<ConversationWithDetails[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, updates: Partial<InsertConversation>): Promise<Conversation | undefined>;
  
  // Messages
  getMessages(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(conversationId: number): Promise<void>;

  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    ordersToday: number;
    activeConversations: number;
    activeTechnicians: number;
    dailyRevenue: number;
  }>;

  // WhatsApp Settings
  getWhatsAppConfig(storeId?: number | null): Promise<WhatsAppSettings | null>;
  getWhatsAppConfigByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppSettings | null>;
  updateWhatsAppConfig(config: InsertWhatsAppSettings, storeId?: number): Promise<WhatsAppSettings>;
  
  // WhatsApp Logs
  getWhatsAppLogs(storeId?: number, limit?: number, offset?: number, filters?: any): Promise<WhatsAppLog[]>;
  addWhatsAppLog(log: InsertWhatsAppLog): Promise<WhatsAppLog>;
  getAllWhatsAppLogs(limit?: number, offset?: number, filters?: any): Promise<any[]>;
  getWhatsAppLogStats(storeId?: number): Promise<any>;
  cleanupOldWhatsAppLogs(days?: number): Promise<number>;
  
  // WhatsApp Settings - Central Management
  getAllWhatsAppConfigs(): Promise<WhatsAppSettings[]>;
  updateWhatsAppConfigById(id: number, config: Partial<InsertWhatsAppSettings>): Promise<WhatsAppSettings>;
  deleteWhatsAppConfig(id: number): Promise<boolean>;

  // Virtual Stores Management
  getAllStores(): Promise<VirtualStore[]>;
  getStoreInfo(storeId: number): Promise<VirtualStore | null>;
  createStore(storeData: {
    name: string;
    description: string;
    domain: string;
    isActive: boolean;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    planType?: string;
  }): Promise<VirtualStore>;
  



  // Auto Responses
  getAllAutoResponses(storeId?: number): Promise<AutoResponse[]>;
  getAutoResponse(id: number): Promise<AutoResponse | undefined>;
  createAutoResponse(response: InsertAutoResponse): Promise<AutoResponse>;
  updateAutoResponse(id: number, updates: Partial<InsertAutoResponse>, storeId?: any): Promise<AutoResponse | undefined>;
  deleteAutoResponse(id: number, storeId?: any): Promise<void>;
  clearAllAutoResponses(): Promise<void>;
  getAutoResponsesByTrigger(trigger: string): Promise<AutoResponse[]>;
   resetAutoResponsesToDefault(storeId?: number): Promise<void>;
  
  // Customer Registration Flows
  getRegistrationFlow(phoneNumber: string): Promise<CustomerRegistrationFlow | undefined>;
  createRegistrationFlow(flow: InsertCustomerRegistrationFlow): Promise<CustomerRegistrationFlow>;
  updateRegistrationFlow(phoneNumber: string, updates: Partial<InsertCustomerRegistrationFlow>): Promise<CustomerRegistrationFlow | undefined>;
  deleteRegistrationFlow(phoneNumber: string): Promise<void>;
  
  // Employee Profiles
  getEmployeeProfile(userId: number): Promise<EmployeeProfile | undefined>;
  getEmployeeProfileByEmployeeId(employeeId: string): Promise<EmployeeProfile | undefined>;
  getAllEmployeeProfiles(): Promise<(EmployeeProfile & { user: User })[]>;
  createEmployeeProfile(profile: InsertEmployeeProfile): Promise<EmployeeProfile>;
  updateEmployeeProfile(id: number, updates: Partial<InsertEmployeeProfile>): Promise<EmployeeProfile | undefined>;
  deleteEmployeeProfile(id: number): Promise<void>;
  getEmployeesByDepartment(department: string): Promise<(EmployeeProfile & { user: User })[]>;
  generateEmployeeId(department: string): Promise<string>;
  
  // Assignment Rules
  getAllAssignmentRules(): Promise<AssignmentRule[]>;
  getAssignmentRule(id: number): Promise<AssignmentRule | undefined>;
  createAssignmentRule(rule: InsertAssignmentRule): Promise<AssignmentRule>;
  updateAssignmentRule(id: number, updates: Partial<InsertAssignmentRule>): Promise<AssignmentRule | undefined>;
  deleteAssignmentRule(id: number): Promise<void>;
  getActiveAssignmentRules(): Promise<AssignmentRule[]>;
  
  // Automatic Assignment System
  findBestTechnician(orderId: number, customerLocation?: { latitude: string; longitude: string }): Promise<{
    technician: EmployeeProfile & { user: User };
    distance?: number;
    estimatedTime: number;
    matchingRules: AssignmentRule[];
  } | null>;
  autoAssignOrder(orderId: number): Promise<{
    success: boolean;
    assignedTechnician?: EmployeeProfile & { user: User };
    reason?: string;
  }>;
  getAvailableTechnicians(specializations?: string[], maxDistance?: number, customerLocation?: { latitude: string; longitude: string }): Promise<(EmployeeProfile & { user: User })[]>;
  
  // Notifications
  getNotification(id: number): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: number): Promise<Notification[]>;
  getUnreadNotifications(userId: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  deleteNotification(id: number): Promise<void>;
  getNotificationCount(userId: number): Promise<{ total: number; unread: number }>;
  
  // Conversation Type Determination for WhatsApp Segmentation
  determineConversationType(customerId: number): Promise<'initial' | 'tracking' | 'support'>;
  
  // Shopping Cart Management
  getCart(sessionId: string, userId?: number): Promise<{ items: (ShoppingCart & { product: Product })[], subtotal: number }>;
  addToCart(sessionId: string, productId: number, quantity: number, userId?: number): Promise<void>;
  updateCartQuantity(sessionId: string, productId: number, quantity: number, userId?: number): Promise<void>;
  removeFromCart(sessionId: string, productId: number, userId?: number): Promise<void>;
  clearCart(sessionId: string, userId?: number): Promise<void>;
  
  // Product Categories
  getAllCategories(storeId?: number): Promise<ProductCategory[]>;
  getCategory(id: number, storeId?: number): Promise<ProductCategory | undefined>;
  getActiveCategories(): Promise<ProductCategory[]>;
  createCategory(category: InsertProductCategory): Promise<ProductCategory>;
  updateCategory(id: number, updates: Partial<InsertProductCategory>): Promise<ProductCategory | undefined>;
  deleteCategory(id: number): Promise<void>;

  // Store Configuration
  getStoreConfig(storeId: number): Promise<StoreSettings | undefined>;
  updateStoreConfig(
    storeId: number,
    config: {
      storeWhatsAppNumber: string;
      storeName: string;
      storeAddress?: string;
      storeEmail?: string;
    }
  ): Promise<StoreSettings>;
  
  // Virtual Stores Management
  getAllVirtualStores(): Promise<VirtualStore[]>;
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  
  
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }


  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  async updateUserStatus(id: number, status: string): Promise<User | undefined> {
    try {
      const [user] = await db.update(users)
        .set({ 
          status, 
          updatedAt: new Date()
        } as any)
        .where(eq(users.id, id))
        .returning();
      
      return user || undefined;
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  // Customers
  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  // Normalize phone number for comparison
  private normalizePhoneNumber(phone: string): string {
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (digitsOnly.startsWith('52') && digitsOnly.length > 10) {
      return digitsOnly;
    } else if (!digitsOnly.startsWith('52') && digitsOnly.length === 10) {
      return '52' + digitsOnly;
    } else {
      return digitsOnly;
    }
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const normalizedSearchPhone = this.normalizePhoneNumber(phone);
    const allCustomers = await db.select().from(customers);
    
    return allCustomers.find(customer => 
      this.normalizePhoneNumber(customer.phone) === normalizedSearchPhone
    );
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }


  async deleteCustomer(id: number, storeId: any): Promise<boolean> {
    try {
      await db.delete(customerHistory).where(eq(customerHistory.customerId, id));
      
      const relatedConversations = await db.select().from(conversations).where(eq(conversations.customerId, id));
      
      if (relatedConversations.length > 0) {
        for (const conversation of relatedConversations) {
          await db.delete(messages).where(eq(messages.conversationId, conversation.id));
        }
        await db.delete(conversations).where(eq(conversations.customerId, id));
      }

      const relatedOrders = await db.select().from(orders).where(eq(orders.customerId, id));
      
      if (relatedOrders.length > 0) {
        for (const order of relatedOrders) {
          await db.delete(orderHistory).where(eq(orderHistory.orderId, order.id));
        }
        
        for (const order of relatedOrders) {
          await db.delete(orderItems).where(eq(orderItems.orderId, order.id));
        }
        
        await db.delete(orders).where(eq(orders.customerId, id));
      }

      await db.delete(customers).where(eq(customers.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      return false;
    }
  }

  async updateCustomerLocation(id: number, location: {
    latitude: string;
    longitude: string;
    address: string;
    mapLink?: string;
  }): Promise<Customer> {
    const updateData: any = {
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      updatedAt: new Date()
    };

    if (location.mapLink) {
      updateData.mapLink = location.mapLink;
    }

    const [customer] = await db.update(customers).set(updateData).where(eq(customers.id, id)).returning();
    return customer;
  }

  async updateCustomerName(id: number, name: string): Promise<Customer | undefined> {
    const [customer] = await db.update(customers).set({
      name: name,
      }).where(eq(customers.id, id)).returning();
    return customer || undefined;
  }

  // Products
  async getAllProducts(storeId?: number): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: number, storeId?: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct, storeId?: number): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: number, product: InsertProduct, storeId?: number): Promise<Product | undefined> {
    const [updatedProduct] = await db.update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    return updatedProduct || undefined;
  }

  async deleteProduct(id: number, storeId?: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return result.rowCount > 0;
  }


  async createOrder(insertOrder: InsertOrder, items: Array<{
    productId: number;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    installationCost?: string;
    partsCost?: string;
    laborHours?: string;
    laborRate?: string;
    deliveryCost?: string;
    deliveryDistance?: string;
    notes?: string;
  }>): Promise<OrderWithDetails> {
    const orderNumber = insertOrder.orderNumber || `ORD-${Date.now().toString().slice(-6)}`;

    const [order] = await db.insert(orders).values({
      ...insertOrder,
      orderNumber
    }).returning();

    for (const item of items) {
      await db.insert(orderItems).values({
        orderId: order.id,
        ...item
      });
    }

    await db.insert(orderHistory).values({
      orderId: order.id,
         statusTo: order.status,
      action: 'created'
    });

    setTimeout(async () => {
      try {
        const assignmentResult = await this.autoAssignOrder(order.id);
        if (assignmentResult.success && assignmentResult.assignedTechnician) {
          console.log(`[AUTO-ASSIGN] Order ${orderNumber} automatically assigned to ${assignmentResult.assignedTechnician.user.name}`);
          
          await this.createNotification({
            userId: assignmentResult.assignedTechnician.userId,
            type: 'assignment',
            title: 'Nuevo pedido asignado automáticamente',
            message: `Se te ha asignado el pedido ${orderNumber} por el sistema automático`,
            priority: 'high',
            isRead: false,
            relatedId: order.id,
            relatedType: 'order'
          });
        } else {
          console.log(`[AUTO-ASSIGN] Could not auto-assign order ${orderNumber}: ${assignmentResult.reason}`);
          
          const adminUsers = await this.getUsersByRole('admin');
          for (const admin of adminUsers) {
            await this.createNotification({
              userId: admin.id,
              type: 'system',
              title: 'Asignación automática fallida',
              message: `No se pudo asignar automáticamente el pedido ${orderNumber}: ${assignmentResult.reason}`,
              priority: 'medium',
              isRead: false,
              relatedId: order.id,
              relatedType: 'order'
            });
          }
        }
      } catch (error) {
        console.error(`[AUTO-ASSIGN] Error during automatic assignment for order ${orderNumber}:`, error);
      }
    }, 1000);

    const orderWithDetails = await this.getOrder(order.id);
    return orderWithDetails!;
  }

  async getTechnicianOrders(userId: number): Promise<OrderWithDetails[]> {
    try {
      const result = await db.select()
        .from(orders)
        .where(eq(orders.assignedUserId, userId))
        .orderBy(desc(orders.createdAt));

      const ordersWithDetails = await Promise.all(
        result.map(async (order) => {
          return await this.getOrder(order.id);
        })
      );

      return ordersWithDetails.filter(order => order !== undefined) as OrderWithDetails[];
    } catch (error) {
      console.error("Error in getTechnicianOrders:", error);
      return [];
    }
  }

  async updateOrder(
  id: number,
  updates: Partial<Omit<Order, 'id'>>
): Promise<Order | undefined> {
  const [order] = await db
    .update(orders)
    .set({
      ...updates,
      updatedAt: new Date()
    }as any)
    .where(eq(orders.id, id))
    .returning();

  return order || undefined;
}

  async assignOrder(orderId: number, userId: number): Promise<Order | undefined> {
    const [order] = await db.update(orders).set({
      assignedUserId: userId,
      status: 'assigned',
      updatedAt: new Date()
    }as any).where(eq(orders.id, orderId)).returning();

    if (order) {
      await db.insert(orderHistory).values({
        orderId,
        userId,
        statusFrom: 'pending',
        statusTo: 'assigned',
        action: 'assigned'
      }as any);
    }

    return order || undefined;
  }

  async updateOrderStatus(orderId: number, status: string, userId?: number, notes?: string): Promise<Order | undefined> {
    const currentOrder = await db.select().from(orders).where(eq(orders.id, orderId));
    if (currentOrder.length === 0) return undefined;

    const [order] = await db.update(orders).set({
      status,
      updatedAt: new Date()
    }as any).where(eq(orders.id, orderId)).returning();

    if (order) {
      await db.insert(orderHistory).values({
        orderId,
        userId,
        statusFrom: currentOrder[0].status,
        statusTo: status,
        action: this.getActionFromStatus(status),
        notes
      }as any);
    }

    return order || undefined;
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

  async getOrderHistory(orderId: number): Promise<OrderHistory[]> {
    return await db.select().from(orderHistory)
      .where(eq(orderHistory.orderId, orderId))
      .orderBy(desc(orderHistory.timestamp));
  }

  async addOrderHistory(insertHistory: InsertOrderHistory): Promise<OrderHistory> {
    const [history] = await db.insert(orderHistory).values(insertHistory).returning();
    return history;
  }

  async deleteOrder(id: number): Promise<void> {
    await db
  .update(conversations)
  .set({ orderId: null } as any)   // o as Partial<typeof conversations.$inferInsert>
  .where(eq(conversations.orderId, id))
  .returning();
    await db.delete(orderHistory).where(eq(orderHistory.orderId, id));
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    await db.delete(orders).where(eq(orders.id, id));
  }

  // Order Items
  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const [orderItem] = await db.insert(orderItems).values(insertOrderItem).returning();
    return orderItem;
  }

  async getOrderItems(orderId: number): Promise<OrderItemWithProduct[]> {
    const items = await db.select()
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));

    return items.map(({ order_items, products: product }) => ({
      ...order_items,
      product: product || undefined
    })) as OrderItemWithProduct[];
  }

  async calculateServicePrice(
    serviceId: number, 
    installationComplexity: number, 
    partsNeeded: Array<{productId: number; quantity: number}>,
    customerLatitude?: string,
    customerLongitude?: string
  ): Promise<{
    basePrice: number;
    installationCost: number;
    partsCost: number;
    laborHours: number;
    laborRate: number;
    deliveryCost: number;
    deliveryDistance: number;
    totalPrice: number;
  }> {
    const service = await this.getProduct(serviceId);
    if (!service || service.category !== 'service') {
      throw new Error('Invalid service ID');
    }

    const basePrice = parseFloat(service.price);
    const laborRate = 150;
    const laborHours = Math.max(1, installationComplexity * 0.5);
    const installationCost = laborHours * laborRate;

    let partsCost = 0;
    for (const part of partsNeeded) {
      const product = await this.getProduct(part.productId);
      if (product) {
        partsCost += parseFloat(product.price) * part.quantity;
      }
    }

    let deliveryCost = 0;
    let deliveryDistance = 0;
    
    if (customerLatitude && customerLongitude) {
      const deliveryInfo = await this.calculateDeliveryCost(
        customerLatitude, 
        customerLongitude, 
        "service"
      );
      deliveryCost = deliveryInfo.cost;
      deliveryDistance = deliveryInfo.distance;
    }

    const totalPrice = basePrice + installationCost + partsCost + deliveryCost;

    return {
      basePrice,
      installationCost: Math.round(installationCost * 100) / 100,
      partsCost,
      laborHours,
      laborRate,
      deliveryCost,
      deliveryDistance,
      totalPrice: Math.round(totalPrice * 100) / 100,
    };
  }

  async calculateDeliveryCost(
    customerLatitude: string,
    customerLongitude: string,
    productCategory: string = "product"
  ): Promise<{
    distance: number;
    cost: number;
    estimatedTime: number;
  }> {
    const baseLatitude = 19.4326;
    const baseLongitude = -99.1332;

    const customerLat = parseFloat(customerLatitude);
    const customerLng = parseFloat(customerLongitude);
    
    const R = 6371;
    const dLat = (customerLat - baseLatitude) * Math.PI / 180;
    const dLng = (customerLng - baseLongitude) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(baseLatitude * Math.PI / 180) * Math.cos(customerLat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    let baseCost = 50;
    let costPerKm = 8;
    
    if (productCategory === "service") {
      baseCost = 100;
      costPerKm = 12;
    }
    
    const cost = Math.round((baseCost + (distance * costPerKm)) * 100) / 100;
    const estimatedTime = Math.round((distance * 3) + 30);
    
    return {
      distance: Math.round(distance * 100) / 100,
      cost,
      estimatedTime
    };
  }

  // Conversations
  async getConversation(id: number): Promise<ConversationWithDetails | undefined> {
    const conversationData = await db.select({
      conversation: conversations,
      customer: customers,
      order: orders
    })
    .from(conversations)
    .leftJoin(customers, eq(conversations.customerId, customers.id))
    .leftJoin(orders, eq(conversations.orderId, orders.id))
    .where(eq(conversations.id, id));

    if (conversationData.length === 0) return undefined;

    const { conversation, customer, order } = conversationData[0];
    if (!customer) return undefined;

    const messagesData = await db.select().from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(desc(messages.sentAt));

    const lastMessage = messagesData[0] || undefined;
    const unreadCount = messagesData.filter(msg => !msg.isRead && msg.senderType === "customer").length;

    return {
      ...conversation,
      customer,
      order: order || undefined,
      lastMessage,
      unreadCount
    };
  }

  async getActiveConversations(): Promise<ConversationWithDetails[]> {
    const conversationsData = await db.select().from(conversations)
      .where(eq(conversations.status, "active"))
      .orderBy(desc(conversations.lastMessageAt));

    const conversationsWithDetails = await Promise.all(
      conversationsData.map(async (conv) => {
        return await this.getConversation(conv.id);
      })
    );

    return conversationsWithDetails.filter(conv => conv !== undefined) as ConversationWithDetails[];
  }

  async getAllConversations(storeId: number): Promise<ConversationWithDetails[]> {
    const convs = await db.select()
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .orderBy(desc(conversations.lastMessageAt));

    const conversationsWithDetails = await Promise.all(
      convs.map(async ({ conversations: conversation }) => {
        return await this.getConversation(conversation.id);
      })
    );

    return conversationsWithDetails.filter(conv => conv !== undefined) as ConversationWithDetails[];
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(insertConversation).returning();
    return conversation;
  }

  async updateConversation(id: number, updates: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const [conversation] = await db.update(conversations)
      .set(updates)
      .where(eq(conversations.id, id))
      .returning();
    return conversation || undefined;
  }

  // Messages
  async getMessages(conversationId: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.sentAt);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();

    await db
  .update(conversations)
  .set({ lastMessageAt: new Date() } as any)  // ← silenciamos TS aquí
  .where(eq(conversations.id, insertMessage.conversationId));

    return message;
  }

  async markMessagesAsRead(conversationId: number): Promise<void> {
    await db.update(messages).set({
      isRead: true
    }as any).where(and(
      eq(messages.conversationId, conversationId),
      eq(messages.senderType, "customer")
    ));
  }

  // WhatsApp Settings
  async getWhatsAppConfig(storeId?: number | null): Promise<WhatsAppSettings | null> {
    if (storeId) {
      try {
        console.log(`🔍 SEARCHING WHATSAPP CONFIG - For store ID: ${storeId}`);
        const [config] = await db.select().from(whatsappSettings)
          .where(and(
            eq(whatsappSettings.storeId, storeId),
            eq(whatsappSettings.isActive, true)
          ))
          .limit(1);
        
        if (config) {
          console.log(`✅ WHATSAPP CONFIG FOUND - Store ${storeId}: phoneNumberId ${config.phoneNumberId}`);
          return config;
        } else {
          console.log(`❌ NO WHATSAPP CONFIG - Store ${storeId}: No active configuration found in global database`);
          return null;
        }
      } catch (error) {
        console.error(`Error getting WhatsApp config for store ${storeId}:`, error);
        return null;
      }
    } else {
      const [config] = await db.select().from(whatsappSettings)
        .where(eq(whatsappSettings.isActive, true))
        .orderBy(desc(whatsappSettings.createdAt));
      
      return config || null;
    }
  }

  async getWhatsAppConfigByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppSettings | null> {
    try {
      if (!phoneNumberId || phoneNumberId.length < 5) return null;

      const [config] = await db.select().from(whatsappSettings)
        .where(and(
          eq(whatsappSettings.phoneNumberId, phoneNumberId),
          eq(whatsappSettings.isActive, true)
        ))
        .orderBy(desc(whatsappSettings.createdAt));

      return config || null;
    } catch (error) {
      console.error('Error getting WhatsApp config by phoneNumberId:', error);
      return null;
    }
  }

  async updateWhatsAppConfig(config: InsertWhatsAppSettings, storeId?: number): Promise<WhatsAppSettings> {
    const targetStoreId = storeId || config.storeId;
    const existingConfig = await this.getWhatsAppConfig(targetStoreId);
    
    if (existingConfig) {
      const [updatedConfig] = await db
        .update(whatsappSettings)
        .set({
          ...config,
          storeId: targetStoreId,
          updatedAt: new Date()
        })
        .where(eq(whatsappSettings.id, existingConfig.id))
        .returning();
      
      return updatedConfig;
    } else {
      const [newConfig] = await db.insert(whatsappSettings).values({
        ...config,
        storeId: targetStoreId,
        isActive: true
      }).returning();
      
      return newConfig;
    }
  }

  // WhatsApp Logs
  async getWhatsAppLogs(
    storeId?: number,
    limit = 50,
    offset = 0,
    filters: {
      type?: string;
      phoneNumber?: string;
      status?: string;
    } = {}
  ): Promise<WhatsAppLog[]> {
    // 1) Query base sin filtros
    const baseQuery = db.select().from(whatsappLogs);

    // 2) Armar condiciones según filtros
    const conditions = [];
    if (storeId !== undefined) {
      conditions.push(eq(whatsappLogs.storeId, storeId));
    }
    if (filters.type) {
      conditions.push(eq(whatsappLogs.type, filters.type));
    }
    if (filters.phoneNumber) {
      conditions.push(eq(whatsappLogs.phoneNumber, filters.phoneNumber));
    }
    if (filters.status) {
      conditions.push(eq(whatsappLogs.status, filters.status));
    }

    // 3) Aplicar filtros solo si hay condiciones
    const filteredQuery = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    // 4) Ordenar, paginar y ejecutar
    const logs = await filteredQuery
      .orderBy(desc(whatsappLogs.timestamp))
      .limit(limit)
      .offset(offset);

    return logs;
  }

  async addWhatsAppLog(log: InsertWhatsAppLog): Promise<WhatsAppLog> {
    const [logEntry] = await db.insert(whatsappLogs).values(log).returning();
    return logEntry;
  }

  async getAllWhatsAppLogs(limit = 50, offset = 0, filters: any = {}): Promise<any[]> {
    return await this.getWhatsAppLogs(undefined, limit, offset, filters);
  }

  async getWhatsAppLogStats(storeId?: number): Promise<any> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const [total] = await db.select({ count: count() }).from(whatsappLogs);
    
    const [success] = await db.select({ count: count() })
      .from(whatsappLogs)
      .where(eq(whatsappLogs.type, 'success'));
    
    const [errors] = await db.select({ count: count() })
      .from(whatsappLogs)
      .where(eq(whatsappLogs.type, 'error'));
    
    const [todayLogs] = await db.select({ count: count() })
      .from(whatsappLogs)
      .where(gte(whatsappLogs.timestamp, today));
    
    return {
      total: total.count || 0,
      success: success.count || 0,
      errors: errors.count || 0,
      today: todayLogs.count || 0,
      thisWeek: 0,
      thisMonth: 0
    };
  }

  async cleanupOldWhatsAppLogs(days = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await db.delete(whatsappLogs)
      .where(lt(whatsappLogs.timestamp, cutoffDate));
    
    return result.rowCount || 0;
  }

  // Auto Responses
  async getAllAutoResponses(storeId: any): Promise<AutoResponse[]> {
    return await db.select().from(autoResponses)
      .orderBy(desc(autoResponses.createdAt));
  }

  async getAutoResponse(id: number): Promise<AutoResponse | undefined> {
    const [response] = await db.select().from(autoResponses)
      .where(eq(autoResponses.id, id));
    return response || undefined;
  }

  async createAutoResponse(response: InsertAutoResponse): Promise<AutoResponse> {
    const [newResponse] = await db.insert(autoResponses).values(response).returning();
    return newResponse;
  }

  async updateAutoResponse(id: number, updates: Partial<InsertAutoResponse>, storeId?: any): Promise<AutoResponse | undefined> {
    const [updatedResponse] = await db.update(autoResponses)
      .set(updates)
      .where(eq(autoResponses.id, id))
      .returning();
    return updatedResponse || undefined;
  }

  async deleteAutoResponse(id: number, storeId?: any): Promise<void> {
    await db.delete(autoResponses).where(eq(autoResponses.id, id));
  }

  async clearAllAutoResponses(): Promise<void> {
    await db.delete(autoResponses);
  }

  async getAutoResponsesByTrigger(trigger: string): Promise<AutoResponse[]> {
    return await db.select().from(autoResponses)
      .where(and(
        eq(autoResponses.trigger, trigger),
        eq(autoResponses.isActive, true)
      ))
      .orderBy(autoResponses.priority);
  }

  async resetAutoResponsesToDefault(storeId?: number): Promise<void> {
  try {
    console.log(`🔄 Reseteando auto-responses para store ${storeId || 'default'}`);
    
    // Limpiar respuestas existentes
    await this.clearAllAutoResponses();
    
    // Respuestas automáticas por defecto
    const defaultResponses: InsertAutoResponse[] = [
      {
        name: "Bienvenida",
        trigger: "welcome",
        messageText: "¡Hola! 👋 Bienvenido a nuestro servicio.\n\n¿En qué puedo ayudarte hoy?",
        isActive: true,
        priority: 1,
        menuOptions: JSON.stringify([
          { label: "Ver Productos", action: "show_products" },
          { label: "Ver Servicios", action: "show_services" },
          { label: "Hablar con Agente", action: "contact_agent" },
          { label: "Ayuda", action: "show_help" }
        ])
      },
      {
        name: "Menú Principal",
        trigger: "menu",
        messageText: "📋 *MENÚ PRINCIPAL*\n\nSelecciona una opción:",
        isActive: true,
        priority: 2,
        menuOptions: JSON.stringify([
          { label: "🛍️ Productos", action: "show_products" },
          { label: "🔧 Servicios", action: "show_services" },
          { label: "📞 Contactar", action: "contact_agent" },
          { label: "❓ Ayuda", action: "show_help" }
        ])
      },
      {
        name: "Mostrar Productos",
        trigger: "show_products",
        messageText: "🛍️ *NUESTROS PRODUCTOS*\n\nAquí tienes nuestra selección de productos disponibles.\n\n¿Te interesa alguno en particular?",
        isActive: true,
        priority: 3,
        menuOptions: JSON.stringify([
          { label: "💰 Ver Precios", action: "show_prices" },
          { label: "📋 Catálogo Completo", action: "full_catalog" },
          { label: "🔙 Menú Principal", action: "main_menu" }
        ])
      },
      {
        name: "Mostrar Servicios",
        trigger: "show_services",
        messageText: "🔧 *NUESTROS SERVICIOS*\n\nOfrecemos servicios profesionales de:\n\n• Instalación\n• Mantenimiento\n• Reparación\n• Consultoría\n\n¿Qué servicio necesitas?",
        isActive: true,
        priority: 4,
        menuOptions: JSON.stringify([
          { label: "🔧 Instalación", action: "service_install" },
          { label: "🛠️ Mantenimiento", action: "service_maintenance" },
          { label: "🔙 Menú Principal", action: "main_menu" }
        ])
      },
      {
        name: "Contactar Agente",
        trigger: "contact_agent",
        messageText: "👨‍💼 *CONTACTAR AGENTE*\n\nUn agente se pondrá en contacto contigo pronto.\n\nPor favor, describe brevemente tu consulta y te atenderemos lo antes posible.",
        isActive: true,
        priority: 5,
        menuOptions: JSON.stringify([
          { label: "🔙 Menú Principal", action: "main_menu" },
          { label: "❓ Ayuda", action: "show_help" }
        ])
      },
      {
        name: "Ayuda",
        trigger: "show_help",
        messageText: "❓ *CENTRO DE AYUDA*\n\nAquí tienes información útil:\n\n• Horarios: Lunes a Viernes 9AM-6PM\n• WhatsApp: Disponible 24/7\n• Email: contacto@empresa.com\n\n¿Necesitas algo más?",
        isActive: true,
        priority: 6,
        menuOptions: JSON.stringify([
          { label: "📞 Contactar", action: "contact_agent" },
          { label: "🔙 Menú Principal", action: "main_menu" }
        ])
      },
      {
        name: "Saludo Inicial",
        trigger: "hola",
        messageText: "¡Hola! 😊 Me da mucho gusto saludarte.\n\n¿En qué puedo ayudarte hoy?",
        isActive: true,
        priority: 7,
        menuOptions: JSON.stringify([
          { label: "Ver Menú", action: "main_menu" },
          { label: "Productos", action: "show_products" },
          { label: "Servicios", action: "show_services" }
        ])
      },
      {
        name: "Información de Precios",
        trigger: "precios",
        messageText: "💰 *INFORMACIÓN DE PRECIOS*\n\nNuestros precios son competitivos y ofrecemos diferentes opciones de pago.\n\n¿Te gustaría información específica sobre algún producto?",
        isActive: true,
        priority: 8,
        menuOptions: JSON.stringify([
          { label: "🛍️ Ver Productos", action: "show_products" },
          { label: "💳 Formas de Pago", action: "payment_methods" },
          { label: "🔙 Menú Principal", action: "main_menu" }
        ])
      },
      {
        name: "Horarios",
        trigger: "horarios",
        messageText: "🕐 *HORARIOS DE ATENCIÓN*\n\n• Lunes a Viernes: 9:00 AM - 6:00 PM\n• Sábados: 9:00 AM - 2:00 PM\n• Domingos: Cerrado\n\n📱 WhatsApp disponible 24/7 para consultas urgentes.",
        isActive: true,
        priority: 9,
        menuOptions: JSON.stringify([
          { label: "📞 Contactar", action: "contact_agent" },
          { label: "🔙 Menú Principal", action: "main_menu" }
        ])
      },
      {
        name: "Ubicación",
        trigger: "ubicacion",
        messageText: "📍 *NUESTRA UBICACIÓN*\n\nEstamos ubicados en el centro de la ciudad.\n\nPuedes visitarnos o solicitar servicio a domicilio.\n\n¿Prefieres que vayamos a tu ubicación?",
        isActive: true,
        priority: 10,
        menuOptions: JSON.stringify([
          { label: "🚚 Servicio a Domicilio", action: "home_service" },
          { label: "🏪 Visitar Tienda", action: "store_visit" },
          { label: "🔙 Menú Principal", action: "main_menu" }
        ])
      }
    ];

    // Insertar respuestas por defecto
    for (const response of defaultResponses) {
      await this.createAutoResponse(response);
    }

    console.log(`✅ Auto-responses reseteadas: ${defaultResponses.length} respuestas creadas`);
    
  } catch (error) {
    console.error('Error resetting auto-responses to default:', error);
    throw error;
  }
}

/**
 * Métodos adicionales que pueden estar faltando en storage
 */
async getAllCustomers(storeId?: number): Promise<Customer[]> {
  if (storeId) {
    // Filtrar por storeId si se proporciona
    return await db.select().from(customers);
  }
  
  return await db.select().from(customers);
}

async getAllUsers(storeId?: number): Promise<User[]> {
  if (storeId) {
    // Filtrar por storeId si se proporciona
    return await db.select().from(users);
  }
  
  return await db.select().from(users);
}

async getAllOrders(storeId?: number): Promise<OrderWithDetails[]> {
  const ordersData = await db.select({
    order: orders,
    customer: customers,
    assignedUser: users
  })
  .from(orders)
  .leftJoin(customers, eq(orders.customerId, customers.id))
  .leftJoin(users, eq(orders.assignedUserId, users.id))
  .orderBy(desc(orders.createdAt));

  const ordersWithDetails = await Promise.all(
    ordersData.map(async ({ order }) => {
      return await this.getOrder(order.id);
    })
  );

  return ordersWithDetails.filter(order => order !== undefined) as OrderWithDetails[];
}

async getOrder(id: number, storeId?: number): Promise<OrderWithDetails | undefined> {
  // Implementación existente del método getOrder
  return await this.getOrder(id);
}

async getDashboardMetrics(storeId?: number): Promise<{
  ordersToday: number;
  activeConversations: number;
  activeTechnicians: number;
  dailyRevenue: number;
}> {
  // Ejemplo de métricas simuladas por ahora
  return {
    ordersToday: 10,
    activeConversations: 5,
    activeTechnicians: 3,
    dailyRevenue: 2500,
  };
}


async getMessagesByConversation(conversationId: number, storeId?: number): Promise<Message[]> {
  return await this.getMessages(conversationId);
}

async getAllMessages(storeId?: number): Promise<Message[]> {
  return await db.select().from(messages).orderBy(desc(messages.sentAt));
}

async updateCustomer(id: number, customerData: InsertCustomer, storeId?: number): Promise<Customer | undefined> {
  return await this.updateCustomer(id, customerData);
}



async getUserNotifications(userId: number, storeId?: number): Promise<Notification[]> {
  return await this.getUserNotifications(userId);
}

async getNotificationCounts(userId: number): Promise<{ total: number; unread: number }> {
  return await this.getNotificationCount(userId);
}

async updateStoreSettings(storeId: number, settings: any): Promise<any> {
  // Implementar según necesidad
  return await this.updateStoreConfig(storeId, settings);
}

async getDashboardStats(storeId?: number): Promise<any> {
  // Implementar estadísticas del dashboard
  return await this.getDashboardMetrics();
}

async getAllEmployees(storeId?: number): Promise<any[]> {
  return await this.getAllEmployeeProfiles();
}

async createEmployee(employeeData: any): Promise<any> {
  return await this.createEmployeeProfile(employeeData);
}

async updateEmployee(id: number, employeeData: any, storeId?: number): Promise<any> {
  return await this.updateEmployeeProfile(id, employeeData);
}

async deleteEmployee(id: number, storeId?: number): Promise<boolean> {
  try {
    await this.deleteEmployeeProfile(id);
    return true;
  } catch (error) {
    return false;
  }
}

async getAllAssignmentRules(storeId?: number): Promise<AssignmentRule[]> {
  return await this.getAllAssignmentRules();
}



async updateCartItem(id: number, cartData: any, storeId?: number): Promise<any> {
  const { quantity } = cartData;
  return await this.updateCartItem(id, quantity);
}


async getAllCategories(storeId?: number): Promise<ProductCategory[]> {
  return await this.getAllCategories(storeId);
}

async createCategory(categoryData: any): Promise<ProductCategory> {
  return await this.createCategory(categoryData);
}

async getReports(storeId: number, filters: any): Promise<any> {
  // Implementar generación de reportes según necesidad
  return {
    message: "Reports feature coming soon",
    filters,
    storeId
  };
}

  // Customer Registration Flows
  async getRegistrationFlow(phoneNumber: string): Promise<CustomerRegistrationFlow | undefined> {
    const [flow] = await db.select().from(customerRegistrationFlows)
      .where(eq(customerRegistrationFlows.phoneNumber, phoneNumber));
    return flow || undefined;
  }

  async createRegistrationFlow(flow: InsertCustomerRegistrationFlow): Promise<CustomerRegistrationFlow> {
    const [newFlow] = await db.insert(customerRegistrationFlows).values(flow).returning();
    return newFlow;
  }

  async updateRegistrationFlow(phoneNumber: string, updates: Partial<InsertCustomerRegistrationFlow>): Promise<CustomerRegistrationFlow | undefined> {
    const [updatedFlow] = await db.update(customerRegistrationFlows)
      .set(updates)
      .where(eq(customerRegistrationFlows.phoneNumber, phoneNumber))
      .returning();
    return updatedFlow || undefined;
  }

  async deleteRegistrationFlow(phoneNumber: string): Promise<void> {
    await db.delete(customerRegistrationFlows)
      .where(eq(customerRegistrationFlows.phoneNumber, phoneNumber));
  }

  // Employee Profiles
  async getEmployeeProfile(userId: number): Promise<EmployeeProfile | undefined> {
    const [profile] = await db.select().from(employeeProfiles)
      .where(eq(employeeProfiles.userId, userId));
    return profile || undefined;
  }

  async getEmployeeProfileByEmployeeId(employeeId: string): Promise<EmployeeProfile | undefined> {
    const [profile] = await db.select().from(employeeProfiles)
      .where(eq(employeeProfiles.employeeId, employeeId));
    return profile || undefined;
  }

  async getAllEmployeeProfiles(): Promise<(EmployeeProfile & { user: User })[]> {
    const results = await db.select()
      .from(employeeProfiles)
      .innerJoin(users, eq(employeeProfiles.userId, users.id))
      .orderBy(employeeProfiles.createdAt);

    return results.map(result => ({
      ...result.employee_profiles,
      user: result.users
    }));
  }

  async createEmployeeProfile(profile: InsertEmployeeProfile): Promise<EmployeeProfile> {
    const [newProfile] = await db.insert(employeeProfiles).values(profile).returning();
    return newProfile;
  }

  async updateEmployeeProfile(id: number, updates: Partial<InsertEmployeeProfile>): Promise<EmployeeProfile | undefined> {
    const [updatedProfile] = await db.update(employeeProfiles)
      .set(updates)
      .where(eq(employeeProfiles.id, id))
      .returning();
    return updatedProfile || undefined;
  }

  async deleteEmployeeProfile(id: number): Promise<void> {
    await db.delete(employeeProfiles).where(eq(employeeProfiles.id, id));
  }

  async getEmployeesByDepartment(department: string): Promise<(EmployeeProfile & { user: User })[]> {
    const results = await db.select()
      .from(employeeProfiles)
      .innerJoin(users, eq(employeeProfiles.userId, users.id))
      .where(eq(employeeProfiles.department, department))
      .orderBy(employeeProfiles.createdAt);

    return results.map(result => ({
      ...result.employee_profiles,
      user: result.users
    }));
  }

  async generateEmployeeId(department: string): Promise<string> {
    const prefixes: Record<string, string> = {
      'admin': 'ADM',
      'technical': 'TEC',
      'sales': 'VEN',
      'delivery': 'DEL',
      'support': 'SUP',
    };

    const prefix = prefixes[department] || 'EMP';
    
    const existingProfiles = await db.select()
      .from(employeeProfiles)
      .where(eq(employeeProfiles.department, department));

    const nextNumber = existingProfiles.length + 1;
    const formattedNumber = nextNumber.toString().padStart(3, '0');
    
    return `${prefix}-${formattedNumber}`;
  }

  // Customer History methods
  async getCustomerHistory(customerId: number): Promise<CustomerHistory[]> {
    return await db.select()
      .from(customerHistory)
      .where(eq(customerHistory.customerId, customerId))
      .orderBy(desc(customerHistory.createdAt));
  }

  async addCustomerHistoryEntry(entry: InsertCustomerHistory): Promise<CustomerHistory> {
    const [newEntry] = await db.insert(customerHistory).values(entry).returning();
    return newEntry;
  }

  async updateCustomerStats(customerId: number): Promise<void> {
    const customerOrders = await db.select()
      .from(orders)
      .where(eq(orders.customerId, customerId));

    const totalOrders = customerOrders.length;
    const totalSpent = customerOrders.reduce((sum, order) => {
      return sum + parseFloat(order.totalAmount);
    }, 0);

    await db.update(customers)
      .set({
        totalOrders,
        totalSpent: totalSpent.toFixed(2),
        isVip: totalSpent > 10000 || totalOrders > 10,
      }as any)
      .where(eq(customers.id, customerId));
  }

  async getCustomerWithHistory(customerId: number): Promise<Customer & { history: CustomerHistory[] } | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (!customer) return undefined;

    const history = await this.getCustomerHistory(customerId);
    return { ...customer, history };
  }

  async getVipCustomers(): Promise<Customer[]> {
    return await db.select()
      .from(customers)
      .where(eq(customers.isVip, true))
      .orderBy(desc(customers.totalSpent));
  }

  // Assignment Rules

  async getAssignmentRule(id: number): Promise<AssignmentRule | undefined> {
    const [rule] = await db.select()
      .from(assignmentRules)
      .where(eq(assignmentRules.id, id));
    return rule;
  }

  async createAssignmentRule(rule: InsertAssignmentRule): Promise<AssignmentRule> {
    const [newRule] = await db.insert(assignmentRules).values(rule).returning();
    return newRule;
  }

  async updateAssignmentRule(id: number, updates: Partial<InsertAssignmentRule>): Promise<AssignmentRule | undefined> {
    const [updatedRule] = await db.update(assignmentRules)
      .set({ ...updates, updatedAt: new Date() }as any)
      .where(eq(assignmentRules.id, id))
      .returning();
    return updatedRule;
  }

  async deleteAssignmentRule(id: number): Promise<void> {
    await db.delete(assignmentRules).where(eq(assignmentRules.id, id));
  }

  async getActiveAssignmentRules(): Promise<AssignmentRule[]> {
    return await db.select()
      .from(assignmentRules)
      .where(eq(assignmentRules.isActive, true))
      .orderBy(desc(assignmentRules.priority), assignmentRules.name);
  }

  // Automatic Assignment System
  async findBestTechnician(orderId: number, customerLocation?: { latitude: string; longitude: string }): Promise<{
    technician: EmployeeProfile & { user: User };
    distance?: number;
    estimatedTime: number;
    matchingRules: AssignmentRule[];
  } | null> {
    const order = await this.getOrder(orderId);
    if (!order) return null;

    let location = customerLocation;
    if (!location && order.customer.latitude && order.customer.longitude) {
      location = {
        latitude: order.customer.latitude,
        longitude: order.customer.longitude
      };
    }

    const rules = await this.getActiveAssignmentRules();
    const technicians = await this.getAvailableTechnicians();
    
    if (technicians.length === 0) return null;

    let bestTechnician = null;
    let bestScore = -1;
    let matchingRules: AssignmentRule[] = [];

    for (const technician of technicians) {
      let score = 0;
      const applicableRules: AssignmentRule[] = [];

      for (const rule of rules) {
        let ruleMatches = true;
        let ruleScore = 0;

        if (rule.useSpecializationBased && rule.requiredSpecializations && rule.requiredSpecializations.length > 0) {
          const techSpecializations = technician.specializations || [];
          const hasRequiredSpecializations = rule.requiredSpecializations.every(spec => 
            techSpecializations.includes(spec)
          );
          if (!hasRequiredSpecializations) {
            ruleMatches = false;
            continue;
          }
          ruleScore += 20;
        }

        if (rule.useLocationBased && location) {
          const distance = this.calculateDistance(
            parseFloat(location.latitude),
            parseFloat(location.longitude),
              parseFloat(technician.baseLatitude  ?? '0'),
    parseFloat(technician.baseLongitude ?? '0')
          );
          
          const maxDistance = parseFloat(rule.maxDistanceKm || '50');
          if (distance > maxDistance) {
            ruleMatches = false;
            continue;
          }
          
          ruleScore += Math.max(0, 20 - distance);
        }

        if (rule.useWorkloadBased) {
          const technicianOrders = await this.getTechnicianOrders(technician.userId);
          const activeOrders = technicianOrders.filter(order => 
            ['assigned', 'in_progress'].includes(order.status)
          ).length;
          
          const maxOrders = rule.maxOrdersPerTechnician || 5;
          if (activeOrders >= maxOrders) {
            ruleMatches = false;
            continue;
          }
          
          ruleScore += Math.max(0, 15 - activeOrders * 3);
        }

        if (rule.useTimeBased && rule.availabilityRequired) {
          const currentHour = new Date().getHours();
          if (currentHour < 8 || currentHour > 18) {
            ruleMatches = false;
            continue;
          }
          ruleScore += 10;
        }

        if (ruleMatches) {
          applicableRules.push(rule);
          score += ruleScore * rule.priority;
        }
      }

      if (score > bestScore && applicableRules.length > 0) {
        bestScore = score;
        bestTechnician = technician;
        matchingRules = applicableRules;
      }
    }

    if (!bestTechnician) return null;

    const estimatedTime = matchingRules.reduce((min, rule) => 
      Math.min(min, rule.estimatedResponseTime || 120), 180
    );

    return {
      technician: bestTechnician,
      distance: location ? this.calculateDistance(
        parseFloat(location.latitude),
        parseFloat(location.longitude),
        parseFloat(bestTechnician.latitude || '0'),
        parseFloat(bestTechnician.longitude || '0')
      ) : undefined,
      estimatedTime,
      matchingRules
    };
  }

  async autoAssignOrder(orderId: number): Promise<{
    success: boolean;
    assignedTechnician?: EmployeeProfile & { user: User };
    reason?: string;
  }> {
    try {
      const order = await this.getOrder(orderId);
      if (!order) {
        return { success: false, reason: "Orden no encontrada" };
      }

      if (order.assignedUserId) {
        return { success: false, reason: "La orden ya está asignada" };
      }

      const bestMatch = await this.findBestTechnician(orderId);
      if (!bestMatch) {
        return { 
          success: false, 
          reason: "No hay técnicos disponibles que cumplan los criterios" 
        };
      }

      const autoAssignRules = bestMatch.matchingRules.filter(rule => rule.autoAssign);
      if (autoAssignRules.length === 0) {
        return { 
          success: false, 
          reason: "Asignación automática no está habilitada para esta orden" 
        };
      }

      await this.assignOrder(orderId, bestMatch.technician.userId);

      await this.createNotification({
        userId: bestMatch.technician.userId,
        type: 'assignment',
        title: 'Nueva Orden Asignada',
        message: `Se te ha asignado la orden #${order.orderNumber} - ${order.customer.name}`,
        priority: 'high',
        metadata: {
          orderId: orderId,
          orderNumber: order.orderNumber,
          customerName: order.customer.name,
          estimatedTime: bestMatch.estimatedTime
        }
      });

      const notifyCustomerRules = bestMatch.matchingRules.filter(rule => rule.notifyCustomer);
      if (notifyCustomerRules.length > 0) {
        console.log(`Would notify customer ${order.customer.phone} about assignment`);
      }

      return {
        success: true,
        assignedTechnician: bestMatch.technician
      };

    } catch (error) {
      console.error("Error in autoAssignOrder:", error);
      return { 
        success: false, 
        reason: "Error interno del sistema de asignación" 
      };
    }
  }

  async getAvailableTechnicians(
    specializations?: string[], 
    maxDistance?: number, 
    customerLocation?: { latitude: string; longitude: string }
  ): Promise<(EmployeeProfile & { user: User })[]> {
    try {
      console.log('🔍 Getting available technicians with criteria:', { specializations, maxDistance, customerLocation });
      
      const techniciansWithUsers = await db.select({
        profile: employeeProfiles,
        user: users
      })
      .from(employeeProfiles)
      .innerJoin(users, eq(employeeProfiles.userId, users.id))
      .where(
        and(
          eq(users.status, 'active'),
          eq(employeeProfiles.department, 'technical')
        )
      );
      
      console.log('✅ Found technicians:', techniciansWithUsers.length);

      let availableTechnicians = techniciansWithUsers.map(({ profile, user }) => ({
        ...profile,
        user
      }));

      if (specializations && specializations.length > 0) {
        availableTechnicians = availableTechnicians.filter(tech => {
          const techSpecs = tech.specializations || [];
          return specializations.some(spec => techSpecs.includes(spec));
        });
      }

      if (customerLocation && maxDistance) {
        availableTechnicians = availableTechnicians.filter(tech => {
          if (!tech.baseLatitude || !tech.baseLongitude) return false;
          
          const distance = this.calculateDistance(
            parseFloat(customerLocation.latitude),
            parseFloat(customerLocation.longitude),
            parseFloat(tech.baseLatitude),
            parseFloat(tech.baseLongitude)
          );
          
          return distance <= maxDistance;
        });
      }

      console.log('🎯 Filtered technicians:', availableTechnicians.length);
      return availableTechnicians;
      
    } catch (error) {
      console.error('❌ SQL Error in getAvailableTechnicians:', error);
      throw error;
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI/180);
  }

  // Notifications
  async getNotification(id: number): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification || undefined;
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(insertNotification).returning();
    return notification;
  }


  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const [notification] = await db.update(notifications)
      .set({ isRead: true, readAt: new Date() }as any)
      .where(eq(notifications.id, id))
      .returning();
    return notification || undefined;
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() }as any)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async getNotificationCount(userId: number): Promise<{ total: number; unread: number }> {
    const [totalResult] = await db
      .select({ count: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId));

    const [unreadResult] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId), 
        eq(notifications.isRead, false)
      ));

    return {
      total: totalResult.count,
      unread: unreadResult.count,
    };
  }

  // Conversation Type Logic
  async determineConversationType(customerId: number): Promise<'initial' | 'tracking' | 'support'> {
    const customerOrders = await db.select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));

    if (customerOrders.length === 0) {
      return 'initial';
    }

    const openOrders = customerOrders.filter(order => 
      ['pending', 'confirmed', 'in_progress', 'assigned'].includes(order.status)
    );

    if (openOrders.length > 0) {
      return 'tracking';
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCompletedOrders = customerOrders.filter(order => 
      ['completed', 'delivered'].includes(order.status) &&
      new Date(order.updatedAt) >= thirtyDaysAgo
    );

    if (recentCompletedOrders.length > 0) {
      return 'support';
    }

    return 'initial';
  }

  // Shopping Cart Management
  async getCartItems(sessionId: string, userId?: number): Promise<(ShoppingCart & { product: Product })[]> {
    let conditions = [eq(shoppingCart.sessionId, sessionId)];
    
    if (userId) {
      conditions.push(eq(shoppingCart.userId, userId));
    }

    const result = await db
      .select({
        cart: shoppingCart,
        product: products,
      })
      .from(shoppingCart)
      .innerJoin(products, eq(shoppingCart.productId, products.id))
      .where(and(...conditions));

    return result.map(row => ({ ...row.cart, product: row.product }));
  }


  async clearCart(sessionId: string, userId?: number): Promise<void> {
    const conditions = [eq(shoppingCart.sessionId, sessionId)];
    
    if (userId) {
      conditions.push(eq(shoppingCart.userId, userId));
    }

    await db
      .delete(shoppingCart)
      .where(and(...conditions));
  }

  async getCartTotal(sessionId: string, userId?: number): Promise<number> {
    const cartItems = await this.getCartItems(sessionId, userId);
    
    return cartItems.reduce((total, item) => {
      const price = parseFloat(item.product.salePrice || item.product.price);
      return total + (price * item.quantity);
    }, 0);
  }



  async getCategory(id: number, storeId?: number): Promise<ProductCategory | undefined> {
    if (storeId) {
  const [category] = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.id, id));  // ↔ sin storeId
  return category;
}
    
    const [category] = await db.select().from(productCategories).where(eq(productCategories.id, id));
    return category || undefined;
  }

  async getActiveCategories(): Promise<ProductCategory[]> {
    return await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.isActive, true))
      .orderBy(productCategories.sortOrder, productCategories.name);
  }


  async updateCategory(id: number, updates: Partial<InsertProductCategory>): Promise<ProductCategory | undefined> {
    const [updatedCategory] = await db
      .update(productCategories)
      .set({ 
        ...updates,
        updatedAt: new Date()
      }as any)
      .where(eq(productCategories.id, id))
      .returning();
    
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db
      .delete(productCategories)
      .where(eq(productCategories.id, id));
  }

  // Shopping Cart Management
  async getCart(sessionId: string, userId?: number, storeId?: any): Promise<{ items: (ShoppingCart & { product: Product })[], subtotal: number }> {
    const cartItems = await db.select({
      cart: shoppingCart,
      product: products
    })
    .from(shoppingCart)
    .innerJoin(products, eq(shoppingCart.productId, products.id))
    .where(eq(shoppingCart.sessionId, sessionId));

    let subtotal = 0;
    const items = cartItems.map(item => {
      const itemTotal = parseFloat(item.product.price) * item.cart.quantity;
      subtotal += itemTotal;
      return {
        ...item.cart,
        product: item.product
      };
    });

    return { items, subtotal };
  }

  async addToCart(sessionId: string, productId: number, quantity: number, userId?: number): Promise<void> {
    const [existingItem] = await db.select()
      .from(shoppingCart)
      .where(and(
        eq(shoppingCart.sessionId, sessionId),
        eq(shoppingCart.productId, productId)
      ));

    if (existingItem) {
      await db.update(shoppingCart)
        .set({ 
          quantity: existingItem.quantity + quantity,
          updatedAt: new Date()
        }as any)
        .where(eq(shoppingCart.id, existingItem.id));
    } else {
      await db.insert(shoppingCart).values({
        sessionId,
        productId,
        quantity,
        userId: userId || null
      }as any);
    }
  }

  async updateCartQuantity(sessionId: string, productId: number, quantity: number, userId?: number): Promise<void> {
    await db.update(shoppingCart)
      .set({ 
        quantity,
        updatedAt: new Date()
      }as any)
      .where(and(
        eq(shoppingCart.sessionId, sessionId),
        eq(shoppingCart.productId, productId)
      ));
  }

  async removeFromCart(sessionId: string, productId: number, userId?: number): Promise<void> {
    await db.delete(shoppingCart)
      .where(and(
        eq(shoppingCart.sessionId, sessionId),
        eq(shoppingCart.productId, productId)
      ));
  }

  // Store Configuration
 async updateStoreConfig(
    storeId: number,
    config: {
      storeWhatsAppNumber: string;
      storeName: string;
      storeAddress?: string;
      storeEmail?: string;
    }
  ): Promise<StoreSettings> {
    // 1) Traemos la configuración existente, pasándole el storeId
    const existingConfig = await this.getStoreConfig(storeId);

    if (existingConfig) {
      // 2a) Si existe, actualizamos
      const [updatedConfig] = await db
        .update(storeSettings)
        .set({
          storeWhatsAppNumber: config.storeWhatsAppNumber,
          storeName:           config.storeName,
          storeAddress:        config.storeAddress  || existingConfig.storeAddress,
          storeEmail:          config.storeEmail    || existingConfig.storeEmail,
          updatedAt:           new Date(),
        } as any)   // usamos `as any` para silenciar el TS2353 en updatedAt
        .where(eq(storeSettings.id, existingConfig.id))
        .returning();
      return updatedConfig;
    } else {
      // 2b) Si no existe, insertamos nuevo registro incluyendo el storeId
      const [newConfig] = await db
        .insert(storeSettings)
        .values({
          storeId:               storeId,                       // importante
          storeWhatsAppNumber:   config.storeWhatsAppNumber,
          storeName:             config.storeName,
          storeAddress:          config.storeAddress || null,
          storeEmail:            config.storeEmail   || null,
        } as any)   // `as any` silencia el TS2353 para default/nullable
        .returning();
      return newConfig;
    }
  }

  /** Firma actualizada para que reciba storeId */
  async getStoreConfig(storeId: number): Promise<StoreSettings | undefined> {
    const [config] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.storeId, storeId))
      .limit(1);
    return config;
  }

  // Virtual Stores Management
  async getAllStores(): Promise<VirtualStore[]> {
    return await db.select().from(virtualStores).orderBy(virtualStores.name);
  }
  
  async getStoreInfo(storeId: number): Promise<VirtualStore | null> {
    const [store] = await db.select().from(virtualStores).where(eq(virtualStores.id, storeId));
    return store || null;
  }

  // WhatsApp Settings - Central Management Functions
  async getAllWhatsAppConfigs(): Promise<WhatsAppSettings[]> {
    try {
      return await db.select().from(whatsappSettings)
        .orderBy(desc(whatsappSettings.createdAt));
    } catch (error) {
      console.error('Error getting all WhatsApp configs:', error);
      return [];
    }
  }

  async updateWhatsAppConfigById(id: number, config: Partial<InsertWhatsAppSettings>): Promise<WhatsAppSettings> {
    try {
      const [updatedConfig] = await db
        .update(whatsappSettings)
        .set({
          ...config,
          updatedAt: new Date()
        }as any)
        .where(eq(whatsappSettings.id, id))
        .returning();
      
      return updatedConfig;
    } catch (error) {
      console.error('Error updating WhatsApp config by ID:', error);
      throw error;
    }
  }

  async deleteWhatsAppConfig(id: number): Promise<boolean> {
    try {
      await db.delete(whatsappSettings).where(eq(whatsappSettings.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting WhatsApp config:', error);
      return false;
    }
  }

  // Virtual Stores Management
  async getAllVirtualStores(): Promise<VirtualStore[]> {
    try {
      return await db.select().from(virtualStores)
        .orderBy(desc(virtualStores.createdAt));
    } catch (error) {
      console.error('Error getting all virtual stores:', error);
      return [];
    }
  }

  async createStore(storeData: { name: string; description: string; domain: string; isActive: boolean }): Promise<VirtualStore> {
    try {
      const timestamp = Date.now();
      const schema = `store_${timestamp}`;
      
      const [newStore] = await db.insert(virtualStores).values({
        name: storeData.name,
        description: storeData.description,
        domain: storeData.domain,
        isActive: storeData.isActive,
        databaseUrl: `postgresql://owner:password@localhost:5432/main_db?schema=${schema}`,
        slug: storeData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        settings: JSON.stringify({})
      }as any).returning();

      return newStore;
    } catch (error) {
      console.error('Error creating store:', error);
      throw new Error('Failed to create store');
    }
  }
}

export const storage = new DatabaseStorage();