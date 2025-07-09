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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, isNull } from "drizzle-orm";

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
  deleteCustomer(id: number): Promise<boolean>;
  getAllCustomers(): Promise<Customer[]>;
  updateCustomerLocation(id: number, location: {
    latitude: string;
    longitude: string;
    address: string;
    mapLink?: string;
  }): Promise<Customer>;
  updateCustomerName(id: number, name: string): Promise<Customer | undefined>;

  // Products
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  getAllProducts(): Promise<Product[]>;
  updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

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
  updateOrder(id: number, updates: Partial<InsertOrder>): Promise<Order | undefined>;
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
  getWhatsAppLogs(): Promise<WhatsAppLog[]>;
  addWhatsAppLog(log: InsertWhatsAppLog): Promise<WhatsAppLog>;
  
  // WhatsApp Settings - Central Management
  getAllWhatsAppConfigs(): Promise<WhatsAppSettings[]>;
  updateWhatsAppConfigById(id: number, config: Partial<InsertWhatsAppSettings>): Promise<WhatsAppSettings>;
  deleteWhatsAppConfig(id: number): Promise<boolean>;

  // Virtual Stores Management
  getAllVirtualStores(): Promise<VirtualStore[]>;
  createStore(storeData: { name: string; description: string; domain: string; isActive: boolean }): Promise<VirtualStore>;
  
  // Auto Responses
  getAllAutoResponses(): Promise<AutoResponse[]>;
  getAutoResponse(id: number): Promise<AutoResponse | undefined>;
  createAutoResponse(response: InsertAutoResponse): Promise<AutoResponse>;
  updateAutoResponse(id: number, updates: Partial<InsertAutoResponse>): Promise<AutoResponse | undefined>;
  deleteAutoResponse(id: number): Promise<void>;
  clearAllAutoResponses(): Promise<void>;
  getAutoResponsesByTrigger(trigger: string): Promise<AutoResponse[]>;
  
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
  getAllCategories(): Promise<ProductCategory[]>;
  getActiveCategories(): Promise<ProductCategory[]>;
  getCategory(id: number): Promise<ProductCategory | undefined>;
  createCategory(category: InsertProductCategory): Promise<ProductCategory>;
  updateCategory(id: number, updates: Partial<InsertProductCategory>): Promise<ProductCategory | undefined>;
  deleteCategory(id: number): Promise<void>;

  // Store Configuration
  getStoreConfig(): Promise<StoreSettings | undefined>;
  updateStoreConfig(config: { storeWhatsAppNumber: string; storeName: string; storeAddress?: string; storeEmail?: string }): Promise<StoreSettings>;
  
  // Virtual Stores Management
  getAllStores(): Promise<VirtualStore[]>;
  getStoreInfo(storeId: number): Promise<VirtualStore | null>;
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  async updateUserStatus(id: number, status: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ status }).where(eq(users.id, id)).returning();
    return user || undefined;
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

  

  // Normalize phone number for comparison (remove spaces, dashes, and country codes)
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // If it starts with 52 (Mexico) and has more than 10 digits, keep as is
    // If it doesn't start with 52 but has 10 digits, add 52 prefix
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

  async updateCustomer(id: number, customerData: InsertCustomer): Promise<Customer | undefined> {
    const [customer] = await db.update(customers).set({
      ...customerData,
      lastContact: new Date()
    }).where(eq(customers.id, id)).returning();
    return customer || undefined;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    try {
      // Delete customer history first
      await db.delete(customerHistory).where(eq(customerHistory.customerId, id));
      
      // Delete related messages first
      const relatedConversations = await db.select().from(conversations).where(eq(conversations.customerId, id));
      
      if (relatedConversations.length > 0) {
        for (const conversation of relatedConversations) {
          await db.delete(messages).where(eq(messages.conversationId, conversation.id));
        }
        // Delete conversations
        await db.delete(conversations).where(eq(conversations.customerId, id));
      }

      // Check if customer has related orders
      const relatedOrders = await db.select().from(orders).where(eq(orders.customerId, id));
      
      if (relatedOrders.length > 0) {
        // Delete order history first
        for (const order of relatedOrders) {
          await db.delete(orderHistory).where(eq(orderHistory.orderId, order.id));
        }
        
        // Delete related order items
        for (const order of relatedOrders) {
          await db.delete(orderItems).where(eq(orderItems.orderId, order.id));
        }
        
        // Then delete orders
        await db.delete(orders).where(eq(orders.customerId, id));
      }

      // Now delete the customer
      await db.delete(customers).where(eq(customers.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      return false;
    }
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
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
      lastContact: new Date()
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
      lastContact: new Date()
    }).where(eq(customers.id, id)).returning();
    return customer || undefined;
  }

  // Products
  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return product || undefined;
  }

  async deleteProduct(id: number): Promise<boolean> {
    try {
      const result = await db.delete(products).where(eq(products.id, id));
      return result.rowCount! > 0;
    } catch (error) {
      console.error('Error deleting product:', error);
      return false;
    }
  }

  // Orders - Implementation with joins for OrderWithDetails
  async getOrder(id: number): Promise<OrderWithDetails | undefined> {
    const orderData = await db.select({
      order: orders,
      customer: customers,
      assignedUser: users
    })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(users, eq(orders.assignedUserId, users.id))
    .where(eq(orders.id, id));

    if (orderData.length === 0) return undefined;

    const { order, customer, assignedUser } = orderData[0];
    if (!customer) return undefined;

    // Get order items with products
    const itemsData = await db.select({
      item: orderItems,
      product: products
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, id));

    const items = itemsData.map(({ item, product }) => ({
      ...item,
      product: product!
    }));

    return {
      ...order,
      customer,
      assignedUser: assignedUser || undefined,
      items
    };
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
    // Use provided orderNumber or generate unique one using timestamp to avoid conflicts
    const orderNumber = insertOrder.orderNumber || `ORD-${Date.now().toString().slice(-6)}`;

    const [order] = await db.insert(orders).values({
      ...insertOrder,
      orderNumber
    }).returning();

    // Insert order items
    for (const item of items) {
      await db.insert(orderItems).values({
        orderId: order.id,
        ...item
      });
    }

    // Add to order history
    await db.insert(orderHistory).values({
      orderId: order.id,
      statusFrom: null,
      statusTo: order.status,
      action: 'created'
    });

    // Trigger automatic assignment if enabled
    setTimeout(async () => {
      try {
        const assignmentResult = await this.autoAssignOrder(order.id);
        if (assignmentResult.success && assignmentResult.assignedTechnician) {
          console.log(`[AUTO-ASSIGN] Order ${orderNumber} automatically assigned to ${assignmentResult.assignedTechnician.user.name}`);
          
          // Create notification for assigned technician
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
          
          // Create notification for admin about failed assignment
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
    }, 1000); // 1 second delay to ensure order is fully created

    const orderWithDetails = await this.getOrder(order.id);
    return orderWithDetails!;
  }

  async getAllOrders(): Promise<OrderWithDetails[]> {
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

  async getTechnicianOrders(userId: number): Promise<OrderWithDetails[]> {
    try {
      const result = await db.select()
        .from(orders)
        .where(eq(orders.assignedUserId, userId))
        .orderBy(desc(orders.createdAt));

      // Get the details for each order
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

  async updateOrder(id: number, updates: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db.update(orders).set({
      ...updates,
      updatedAt: new Date()
    }).where(eq(orders.id, id)).returning();
    return order || undefined;
  }

  async assignOrder(orderId: number, userId: number): Promise<Order | undefined> {
    const [order] = await db.update(orders).set({
      assignedUserId: userId,
      status: 'assigned',
      updatedAt: new Date()
    }).where(eq(orders.id, orderId)).returning();

    if (order) {
      await db.insert(orderHistory).values({
        orderId,
        userId,
        statusFrom: 'pending',
        statusTo: 'assigned',
        action: 'assigned'
      });
    }

    return order || undefined;
  }

  async updateOrderStatus(orderId: number, status: string, userId?: number, notes?: string): Promise<Order | undefined> {
    const currentOrder = await db.select().from(orders).where(eq(orders.id, orderId));
    if (currentOrder.length === 0) return undefined;

    const [order] = await db.update(orders).set({
      status,
      updatedAt: new Date()
    }).where(eq(orders.id, orderId)).returning();

    if (order) {
      await db.insert(orderHistory).values({
        orderId,
        userId,
        statusFrom: currentOrder[0].status,
        statusTo: status,
        action: this.getActionFromStatus(status),
        notes
      });
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
    // Delete in order of foreign key dependencies:
    // 1. Update conversations to remove order reference (set to null instead of deleting conversations)
    await db.update(conversations).set({ orderId: null }).where(eq(conversations.orderId, id));
    
    // 2. Delete order history
    await db.delete(orderHistory).where(eq(orderHistory.orderId, id));
    
    // 3. Delete order items
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    
    // 4. Finally delete the order itself
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
    const laborRate = 150; // $150 per hour
    const laborHours = Math.max(1, installationComplexity * 0.5);
    const installationCost = laborHours * laborRate;

    let partsCost = 0;
    for (const part of partsNeeded) {
      const product = await this.getProduct(part.productId);
      if (product) {
        partsCost += parseFloat(product.price) * part.quantity;
      }
    }

    // Calculate delivery cost if customer location is provided
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
    // Base location (company headquarters)
    const baseLatitude = 19.4326; // CDMX Centro
    const baseLongitude = -99.1332;

    // Calculate distance using Haversine formula
    const customerLat = parseFloat(customerLatitude);
    const customerLng = parseFloat(customerLongitude);
    
    const R = 6371; // Earth's radius in kilometers
    const dLat = (customerLat - baseLatitude) * Math.PI / 180;
    const dLng = (customerLng - baseLongitude) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(baseLatitude * Math.PI / 180) * Math.cos(customerLat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    // Calculate delivery cost based on distance and product type
    let baseCost = 50; // Base delivery cost
    let costPerKm = 8; // Cost per kilometer
    
    // Services have higher delivery cost due to equipment transport
    if (productCategory === "service") {
      baseCost = 100;
      costPerKm = 12;
    }
    
    const cost = Math.round((baseCost + (distance * costPerKm)) * 100) / 100;
    const estimatedTime = Math.round((distance * 3) + 30); // 30 min base + 3 min per km
    
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

    // Get last message and unread count
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

    // Update conversation's lastMessageAt
    await db.update(conversations).set({
      lastMessageAt: new Date()
    }).where(eq(conversations.id, insertMessage.conversationId));

    return message;
  }

  async markMessagesAsRead(conversationId: number): Promise<void> {
    await db.update(messages).set({
      isRead: true
    }).where(and(
      eq(messages.conversationId, conversationId),
      eq(messages.senderType, "customer")
    ));
  }

  // Dashboard metrics
  async getDashboardMetrics(): Promise<{
    ordersToday: number;
    activeConversations: number;
    activeTechnicians: number;
    dailyRevenue: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [ordersToday] = await db.select({ count: count() }).from(orders)
      .where(eq(orders.createdAt, today));

    const [activeConversations] = await db.select({ count: count() }).from(conversations)
      .where(eq(conversations.status, "active"));

    const [activeTechnicians] = await db.select({ count: count() }).from(users)
      .where(and(
        eq(users.status, "active"),
        eq(users.role, "technician")
      ));

    const completedOrders = await db.select().from(orders)
      .where(and(
        eq(orders.status, "completed"),
        eq(orders.createdAt, today)
      ));

    const dailyRevenue = completedOrders.reduce((sum, order) => 
      sum + parseFloat(order.totalAmount), 0);

    return {
      ordersToday: ordersToday.count,
      activeConversations: activeConversations.count,
      activeTechnicians: activeTechnicians.count,
      dailyRevenue,
    };
  }

  // WhatsApp Settings with PostgreSQL - Now store-specific
  async getWhatsAppConfig(storeId?: number | null): Promise<WhatsAppSettings | null> {
    if (storeId) {
      // Get configuration from global table for specific store
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
      // Fallback: get any active configuration for super admin from global table
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
    // Obtener la configuración activa existente - se debe pasar storeId
    const targetStoreId = storeId || config.storeId;
    const existingConfig = await this.getWhatsAppConfig(targetStoreId);
    
    if (existingConfig) {
      // Actualizar la configuración existente
      const [updatedConfig] = await db
        .update(whatsappSettings)
        .set({
          ...config,
          updatedAt: new Date()
        })
        .where(eq(whatsappSettings.id, existingConfig.id))
        .returning();
      
      return updatedConfig;
    } else {
      // Si no hay configuración existente, crear una nueva
      const [newConfig] = await db.insert(whatsappSettings).values({
        ...config,
        isActive: true
      }).returning();
      
      return newConfig;
    }
  }

  // WhatsApp Logs with PostgreSQL
  async getWhatsAppLogs(): Promise<WhatsAppLog[]> {
    return await db.select().from(whatsappLogs)
      .orderBy(desc(whatsappLogs.timestamp))
      .limit(100);
  }

  async addWhatsAppLog(log: InsertWhatsAppLog): Promise<WhatsAppLog> {
    const [logEntry] = await db.insert(whatsappLogs).values(log).returning();
    return logEntry;
  }

  // Auto Responses with PostgreSQL
  async getAllAutoResponses(): Promise<AutoResponse[]> {
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

  async updateAutoResponse(id: number, updates: Partial<InsertAutoResponse>, storeId: any): Promise<AutoResponse | undefined> {
    const [updatedResponse] = await db.update(autoResponses)
      .set(updates)
      .where(eq(autoResponses.id, id))
      .returning();
    return updatedResponse || undefined;
  }

  async deleteAutoResponse(id: number, storeId: any): Promise<void> {
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

  // Customer Registration Flows with PostgreSQL
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
    // Get the department prefix
    const prefixes: Record<string, string> = {
      'admin': 'ADM',
      'technical': 'TEC',
      'sales': 'VEN',
      'delivery': 'DEL',
      'support': 'SUP',
    };

    const prefix = prefixes[department] || 'EMP';
    
    // Get the next number for this department
    const existingProfiles = await db.select()
      .from(employeeProfiles)
      .where(eq(employeeProfiles.department, department));

    const nextNumber = existingProfiles.length + 1;
    
    // Format with leading zeros
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
    // Calculate total orders and total spent for the customer
    const customerOrders = await db.select()
      .from(orders)
      .where(eq(orders.customerId, customerId));

    const totalOrders = customerOrders.length;
    const totalSpent = customerOrders.reduce((sum, order) => {
      return sum + parseFloat(order.totalAmount);
    }, 0);

    // Update customer statistics
    await db.update(customers)
      .set({
        totalOrders,
        totalSpent: totalSpent.toFixed(2),
        isVip: totalSpent > 10000 || totalOrders > 10, // VIP if spent > 10k or 10+ orders
      })
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

  // Assignment Rules Methods
  async getAllAssignmentRules(): Promise<AssignmentRule[]> {
    return await db.select()
      .from(assignmentRules)
      .orderBy(desc(assignmentRules.priority), assignmentRules.name);
  }

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
      .set({ ...updates, updatedAt: new Date() })
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
    // Get order details
    const order = await this.getOrder(orderId);
    if (!order) return null;

    // Get customer location if not provided
    let location = customerLocation;
    if (!location && order.customer.latitude && order.customer.longitude) {
      location = {
        latitude: order.customer.latitude,
        longitude: order.customer.longitude
      };
    }

    // Get active assignment rules
    const rules = await this.getActiveAssignmentRules();
    
    // Get available technicians
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

        // Check specialization requirements
        if (rule.useSpecializationBased && rule.requiredSpecializations && rule.requiredSpecializations.length > 0) {
          const techSpecializations = technician.specializations || [];
          const hasRequiredSpecializations = rule.requiredSpecializations.every(spec => 
            techSpecializations.includes(spec)
          );
          if (!hasRequiredSpecializations) {
            ruleMatches = false;
            continue;
          }
          ruleScore += 20; // High score for specialization match
        }

        // Check location/distance requirements
        if (rule.useLocationBased && location) {
          const distance = this.calculateDistance(
            parseFloat(location.latitude),
            parseFloat(location.longitude),
            parseFloat(technician.latitude || '0'),
            parseFloat(technician.longitude || '0')
          );
          
          const maxDistance = parseFloat(rule.maxDistanceKm || '50');
          if (distance > maxDistance) {
            ruleMatches = false;
            continue;
          }
          
          // Closer technicians get higher scores
          ruleScore += Math.max(0, 20 - distance);
        }

        // Check workload requirements
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
          
          // Less busy technicians get higher scores
          ruleScore += Math.max(0, 15 - activeOrders * 3);
        }

        // Check availability requirements
        if (rule.useTimeBased && rule.availabilityRequired) {
          // For now, assume all technicians are available during business hours
          // In a real system, this would check actual schedules
          const currentHour = new Date().getHours();
          if (currentHour < 8 || currentHour > 18) {
            ruleMatches = false;
            continue;
          }
          ruleScore += 10;
        }

        if (ruleMatches) {
          applicableRules.push(rule);
          score += ruleScore * rule.priority; // Weight by rule priority
        }
      }

      if (score > bestScore && applicableRules.length > 0) {
        bestScore = score;
        bestTechnician = technician;
        matchingRules = applicableRules;
      }
    }

    if (!bestTechnician) return null;

    // Calculate estimated response time based on matching rules
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

      // Check if auto-assignment is enabled for the matching rules
      const autoAssignRules = bestMatch.matchingRules.filter(rule => rule.autoAssign);
      if (autoAssignRules.length === 0) {
        return { 
          success: false, 
          reason: "Asignación automática no está habilitada para esta orden" 
        };
      }

      // Assign the order
      await this.assignOrder(orderId, bestMatch.technician.userId);

      // Create notification for the technician
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

      // Optionally notify customer if rules allow it
      const notifyCustomerRules = bestMatch.matchingRules.filter(rule => rule.notifyCustomer);
      if (notifyCustomerRules.length > 0) {
        // This would typically send a WhatsApp message to the customer
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
      
      // Get all technicians who are active
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

      // Filter by specializations if provided
      if (specializations && specializations.length > 0) {
        availableTechnicians = availableTechnicians.filter(tech => {
          const techSpecs = tech.specializations || [];
          return specializations.some(spec => techSpecs.includes(spec));
        });
      }

      // Filter by distance if location and maxDistance provided
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

  // Haversine formula for calculating distance between two GPS coordinates
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
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

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
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

  async getUserNotifications(userId: number): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const [notification] = await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return notification || undefined;
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
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
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return {
      total: totalResult.count,
      unread: unreadResult.count,
    };
  }

  // Conversation Type Logic for WhatsApp Segmentation
  async determineConversationType(customerId: number): Promise<'initial' | 'tracking' | 'support'> {
    // Get customer's orders
    const customerOrders = await db.select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));

    // No orders = initial conversation
    if (customerOrders.length === 0) {
      return 'initial';
    }

    // Check for open orders (pending, confirmed, in_progress, assigned)
    const openOrders = customerOrders.filter(order => 
      ['pending', 'confirmed', 'in_progress', 'assigned'].includes(order.status)
    );

    if (openOrders.length > 0) {
      return 'tracking';
    }

    // Check for recently completed/delivered orders (within last 30 days) that need feedback
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCompletedOrders = customerOrders.filter(order => 
      ['completed', 'delivered'].includes(order.status) &&
      new Date(order.updatedAt) >= thirtyDaysAgo
    );

    if (recentCompletedOrders.length > 0) {
      return 'support';
    }

    // Default to initial for new requests
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


  async updateCartItem(id: number, quantity: number): Promise<ShoppingCart | undefined> {
    const [updatedItem] = await db
      .update(shoppingCart)
      .set({ 
        quantity,
        updatedAt: new Date()
      })
      .where(eq(shoppingCart.id, id))
      .returning();
    
    return updatedItem;
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

  // Product Categories
  async getAllCategories(): Promise<ProductCategory[]> {
    return await db
      .select()
      .from(productCategories)
      .orderBy(productCategories.sortOrder, productCategories.name);
  }

  async getActiveCategories(): Promise<ProductCategory[]> {
    return await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.isActive, true))
      .orderBy(productCategories.sortOrder, productCategories.name);
  }

  async getCategory(id: number): Promise<ProductCategory | undefined> {
    const [category] = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.id, id));
    
    return category;
  }

  async createCategory(category: InsertProductCategory): Promise<ProductCategory> {
    const [newCategory] = await db
      .insert(productCategories)
      .values(category)
      .returning();
    
    return newCategory;
  }

  async updateCategory(id: number, updates: Partial<InsertProductCategory>): Promise<ProductCategory | undefined> {
    const [updatedCategory] = await db
      .update(productCategories)
      .set({ 
        ...updates,
        updatedAt: new Date()
      })
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
  async getCart(sessionId: string, userId?: number): Promise<{ items: (ShoppingCart & { product: Product })[], subtotal: number }> {
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
    // Check if item already exists in cart
    const [existingItem] = await db.select()
      .from(shoppingCart)
      .where(and(
        eq(shoppingCart.sessionId, sessionId),
        eq(shoppingCart.productId, productId)
      ));

    if (existingItem) {
      // Update quantity
      await db.update(shoppingCart)
        .set({ 
          quantity: existingItem.quantity + quantity,
          updatedAt: new Date()
        })
        .where(eq(shoppingCart.id, existingItem.id));
    } else {
      // Insert new item
      await db.insert(shoppingCart).values({
        sessionId,
        productId,
        quantity,
        userId: userId || null
      });
    }
  }

  async updateCartQuantity(sessionId: string, productId: number, quantity: number, userId?: number): Promise<void> {
    await db.update(shoppingCart)
      .set({ 
        quantity,
        updatedAt: new Date()
      })
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
  async getStoreConfig(storeId?: number): Promise<StoreSettings | undefined> {
    // Para la implementación actual, obtener la primera configuración disponible
    const [config] = await db.select().from(storeSettings).limit(1);
    return config;
  }

  async updateStoreConfig(config: { 
    storeWhatsAppNumber: string; 
    storeName: string; 
    storeAddress?: string; 
    storeEmail?: string; 
  }, storeId?: number): Promise<StoreSettings> {
    const existingConfig = await this.getStoreConfig();
    
    if (existingConfig) {
      // Update existing configuration
      const [updatedConfig] = await db
        .update(storeSettings)
        .set({
          ...config,
          updatedAt: new Date()
        })
        .where(eq(storeSettings.id, existingConfig.id))
        .returning();
      return updatedConfig;
    } else {
      // Create new configuration
      const [newConfig] = await db
        .insert(storeSettings)
        .values({
          storeWhatsAppNumber: config.storeWhatsAppNumber,
          storeName: config.storeName,
          storeAddress: config.storeAddress || null,
          storeEmail: config.storeEmail || null,
        })
        .returning();
      return newConfig;
    }
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
        })
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
      }).returning();

      return newStore;
    } catch (error) {
      console.error('Error creating store:', error);
      throw new Error('Failed to create store');
    }
  }
}

export const storage = new DatabaseStorage();
