import {
  users,
  customers,
  products,
  orders,
  orderItems,
  orderHistory,
  conversations,
  messages,
  type User,
  type Customer,
  type Product,
  type Order,
  type OrderItem,
  type OrderHistory,
  type Conversation,
  type Message,
  type InsertUser,
  type InsertCustomer,
  type InsertProduct,
  type InsertOrder,
  type InsertOrderItem,
  type InsertOrderHistory,
  type InsertConversation,
  type InsertMessage,
  type OrderWithDetails,
  type ConversationWithDetails,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserStatus(id: number, status: string): Promise<User | undefined>;

  // Customers
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  getAllCustomers(): Promise<Customer[]>;

  // Products
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  getAllProducts(): Promise<Product[]>;
  updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | undefined>;

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
    notes?: string;
  }>): Promise<OrderWithDetails>;
  getAllOrders(): Promise<OrderWithDetails[]>;
  updateOrder(id: number, updates: Partial<InsertOrder>): Promise<Order | undefined>;
  assignOrder(orderId: number, userId: number): Promise<Order | undefined>;
  updateOrderStatus(orderId: number, status: string, userId?: number, notes?: string): Promise<Order | undefined>;
  
  // Order History
  getOrderHistory(orderId: number): Promise<OrderHistory[]>;
  addOrderHistory(history: InsertOrderHistory): Promise<OrderHistory>;
  
  // Service Pricing
  calculateServicePrice(serviceId: number, installationComplexity: number, partsNeeded: Array<{productId: number; quantity: number}>): Promise<{
    basePrice: number;
    installationCost: number;
    partsCost: number;
    laborHours: number;
    laborRate: number;
    totalPrice: number;
  }>;

  // Conversations
  getConversation(id: number): Promise<ConversationWithDetails | undefined>;
  getActiveConversations(): Promise<ConversationWithDetails[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  
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
  getWhatsAppConfig(): Promise<any>;
  updateWhatsAppConfig(config: any): Promise<any>;
  
  // WhatsApp Logs
  getWhatsAppLogs(): Promise<any[]>;
  addWhatsAppLog(log: any): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private customers: Map<number, Customer> = new Map();
  private products: Map<number, Product> = new Map();
  private orders: Map<number, Order> = new Map();
  private orderItems: Map<number, OrderItem> = new Map();
  private orderHistory: Map<number, OrderHistory> = new Map();
  private conversations: Map<number, Conversation> = new Map();
  private messages: Map<number, Message> = new Map();
  private whatsappConfig: any = null;
  private whatsappLogs: any[] = [];
  
  private currentUserId = 1;
  private currentCustomerId = 1;
  private currentProductId = 1;
  private currentOrderId = 1;
  private currentOrderItemId = 1;
  private currentOrderHistoryId = 1;
  private currentConversationId = 1;
  private currentMessageId = 1;
  private currentOrderNumber = 1000;

  constructor() {
    this.seedData();
    this.seedWhatsAppLogs();
  }

  private seedData() {
    // Seed users
    const admin: User = {
      id: this.currentUserId++,
      username: "admin",
      password: "password",
      name: "Ana Martínez",
      role: "admin",
      status: "active",
      phone: "+52 55 1111-1111",
      avatar: null,
    };
    this.users.set(admin.id, admin);

    const technician1: User = {
      id: this.currentUserId++,
      username: "carlos",
      password: "password",
      name: "Carlos Ruiz",
      role: "technician",
      status: "active",
      phone: "+52 55 2222-2222",
      avatar: null,
    };
    this.users.set(technician1.id, technician1);

    const seller1: User = {
      id: this.currentUserId++,
      username: "ana",
      password: "password", 
      name: "Ana Silva",
      role: "seller",
      status: "busy",
      phone: "+52 55 3333-3333",
      avatar: null,
    };
    this.users.set(seller1.id, seller1);

    const technician2: User = {
      id: this.currentUserId++,
      username: "luis",
      password: "password",
      name: "Luis Vargas",
      role: "technician", 
      status: "break",
      phone: "+52 55 4444-4444",
      avatar: null,
    };
    this.users.set(technician2.id, technician2);

    // Seed customers
    const customer1: Customer = {
      id: this.currentCustomerId++,
      name: "Juan López",
      phone: "+52 55 1234-5678",
      whatsappId: "521551234567",
      lastContact: new Date(),
    };
    this.customers.set(customer1.id, customer1);

    const customer2: Customer = {
      id: this.currentCustomerId++,
      name: "María García",
      phone: "+52 55 8765-4321",
      whatsappId: "521558765432",
      lastContact: new Date(),
    };
    this.customers.set(customer2.id, customer2);

    const customer3: Customer = {
      id: this.currentCustomerId++,
      name: "Pedro Ramírez",
      phone: "+52 55 9876-5432",
      whatsappId: "521559876543",
      lastContact: new Date(),
    };
    this.customers.set(customer3.id, customer3);

    // Seed products
    const product1: Product = {
      id: this.currentProductId++,
      name: "Instalación de Aires Acondicionados",
      description: "Servicio completo de instalación de equipos de aire acondicionado",
      price: "1250.00",
      category: "service",
      status: "active",
    };
    this.products.set(product1.id, product1);

    const product2: Product = {
      id: this.currentProductId++,
      name: "Mantenimiento de Sistemas",
      description: "Servicio de mantenimiento preventivo y correctivo",
      price: "890.00",
      category: "service", 
      status: "active",
    };
    this.products.set(product2.id, product2);

    const product3: Product = {
      id: this.currentProductId++,
      name: "Equipo de Aire Split 12000 BTU",
      description: "Aire acondicionado tipo split de 12000 BTU con instalación",
      price: "2150.00",
      category: "product",
      status: "active",
    };
    this.products.set(product3.id, product3);

    // Seed orders
    const order1: Order = {
      id: this.currentOrderId++,
      orderNumber: `ORD-${this.currentOrderNumber++}`,
      customerId: customer1.id,
      assignedUserId: technician1.id,
      status: "in_progress",
      priority: "normal",
      totalAmount: "1250.00",
      description: "Instalación de aire acondicionado en oficina",
      notes: "Cliente requiere instalación temprana",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      updatedAt: new Date(),
    };
    this.orders.set(order1.id, order1);

    const order2: Order = {
      id: this.currentOrderId++,
      orderNumber: `ORD-${this.currentOrderNumber++}`,
      customerId: customer2.id,
      assignedUserId: null,
      status: "pending",
      priority: "normal",
      totalAmount: "890.00",
      description: "Mantenimiento de sistema HVAC",
      notes: null,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      updatedAt: new Date(),
    };
    this.orders.set(order2.id, order2);

    const order3: Order = {
      id: this.currentOrderId++,
      orderNumber: `ORD-${this.currentOrderNumber++}`,
      customerId: customer3.id,
      assignedUserId: seller1.id,
      status: "completed",
      priority: "normal",
      totalAmount: "2150.00",
      description: "Venta e instalación de equipo nuevo",
      notes: "Cliente muy satisfecho",
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      updatedAt: new Date(),
    };
    this.orders.set(order3.id, order3);

    // Seed order items with service pricing components
    const item1: OrderItem = {
      id: this.currentOrderItemId++,
      orderId: order1.id,
      productId: product1.id,
      quantity: 1,
      unitPrice: "1250.00",
      totalPrice: "1250.00",
      installationCost: "350.00",
      partsCost: "150.00",
      laborHours: "4.0",
      laborRate: "200.00",
      notes: "Instalación compleja en edificio antiguo",
    };
    this.orderItems.set(item1.id, item1);

    const item2: OrderItem = {
      id: this.currentOrderItemId++,
      orderId: order2.id,
      productId: product2.id,
      quantity: 1,
      unitPrice: "890.00",
      totalPrice: "890.00",
      installationCost: "200.00",
      partsCost: "90.00",
      laborHours: "2.5",
      laborRate: "180.00",
      notes: "Mantenimiento preventivo estándar",
    };
    this.orderItems.set(item2.id, item2);

    const item3: OrderItem = {
      id: this.currentOrderItemId++,
      orderId: order3.id,
      productId: product3.id,
      quantity: 1,
      unitPrice: "2150.00",
      totalPrice: "2150.00",
      installationCost: "500.00",
      partsCost: "350.00",
      laborHours: "6.0",
      laborRate: "220.00",
      notes: "Equipo premium con instalación especializada",
    };
    this.orderItems.set(item3.id, item3);

    // Seed conversations
    const conv1: Conversation = {
      id: this.currentConversationId++,
      customerId: customer1.id,
      orderId: order1.id,
      status: "active",
      lastMessageAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    };
    this.conversations.set(conv1.id, conv1);

    const conv2: Conversation = {
      id: this.currentConversationId++,
      customerId: customer2.id,
      orderId: order2.id,
      status: "active",
      lastMessageAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    };
    this.conversations.set(conv2.id, conv2);

    // Seed messages
    const msg1: Message = {
      id: this.currentMessageId++,
      conversationId: conv1.id,
      senderId: null,
      senderType: "customer",
      messageType: "text",
      content: "¿A qué hora pueden venir para la instalación?",
      whatsappMessageId: "msg_12345",
      sentAt: new Date(Date.now() - 15 * 60 * 1000),
      isRead: false,
    };
    this.messages.set(msg1.id, msg1);

    const msg2: Message = {
      id: this.currentMessageId++,
      conversationId: conv2.id,
      senderId: null,
      senderType: "customer",
      messageType: "text",
      content: "Necesito una cotización para el mantenimiento",
      whatsappMessageId: "msg_12346",
      sentAt: new Date(Date.now() - 30 * 60 * 1000),
      isRead: false,
    };
    this.messages.set(msg2.id, msg2);
  }

  private seedWhatsAppLogs() {
    // Add some sample logs to demonstrate functionality
    const sampleLogs = [
      {
        id: Date.now() - 300000,
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: 'incoming',
        message: 'Mensaje recibido de cliente',
        data: {
          from: '+52 55 1234-5678',
          message: 'Hola, necesito información sobre sus servicios',
          webhook_id: 'wh_123456'
        }
      },
      {
        id: Date.now() - 240000,
        timestamp: new Date(Date.now() - 240000).toISOString(),
        type: 'outgoing',
        message: 'Mensaje enviado a cliente',
        data: {
          to: '+52 55 1234-5678',
          message: '¡Hola! Con gusto te ayudamos. ¿Qué tipo de servicio necesitas?',
          message_id: 'msg_789012'
        }
      },
      {
        id: Date.now() - 180000,
        timestamp: new Date(Date.now() - 180000).toISOString(),
        type: 'info',
        message: 'Webhook configurado correctamente',
        data: {
          webhook_url: 'https://whatsapp2-production-e205.up.railway.app/webhook',
          status: 'active'
        }
      },
      {
        id: Date.now() - 120000,
        timestamp: new Date(Date.now() - 120000).toISOString(),
        type: 'incoming',
        message: 'Nuevo mensaje de WhatsApp',
        data: {
          from: '+52 55 9876-5432',
          message: 'Quiero solicitar una cotización para aire acondicionado',
          webhook_id: 'wh_345678'
        }
      }
    ];

    this.whatsappLogs = sampleLogs;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      status: insertUser.status || "active",
      phone: insertUser.phone || null,
      avatar: insertUser.avatar || null,
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUserStatus(id: number, status: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (user) {
      const updatedUser = { ...user, status };
      this.users.set(id, updatedUser);
      return updatedUser;
    }
    return undefined;
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find(customer => customer.phone === phone);
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = this.currentCustomerId++;
    const customer: Customer = { 
      ...insertCustomer, 
      id,
      whatsappId: insertCustomer.whatsappId || null,
      lastContact: new Date(),
    };
    this.customers.set(id, customer);
    return customer;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const product: Product = { 
      ...insertProduct, 
      id,
      status: insertProduct.status || "active",
      description: insertProduct.description || null,
    };
    this.products.set(id, product);
    return product;
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (product) {
      const updatedProduct = { ...product, ...updates };
      this.products.set(id, updatedProduct);
      return updatedProduct;
    }
    return undefined;
  }

  async getOrder(id: number): Promise<OrderWithDetails | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;

    const customer = this.customers.get(order.customerId);
    if (!customer) return undefined;

    const assignedUser = order.assignedUserId ? this.users.get(order.assignedUserId) : undefined;
    
    const items = Array.from(this.orderItems.values())
      .filter(item => item.orderId === id)
      .map(item => {
        const product = this.products.get(item.productId);
        return { ...item, product: product! };
      });

    return {
      ...order,
      customer,
      assignedUser,
      items,
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
    notes?: string;
  }>): Promise<OrderWithDetails> {
    const orderId = this.currentOrderId++;
    const orderNumber = `ORD-${this.currentOrderNumber++}`;
    
    const order: Order = {
      ...insertOrder,
      id: orderId,
      orderNumber,
      status: insertOrder.status || "pending",
      priority: insertOrder.priority || "normal",
      assignedUserId: insertOrder.assignedUserId || null,
      description: insertOrder.description || null,
      notes: insertOrder.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.orders.set(orderId, order);

    // Create order items with enhanced service pricing
    for (const insertItem of items) {
      const itemId = this.currentOrderItemId++;
      const orderItem: OrderItem = {
        id: itemId,
        orderId,
        productId: insertItem.productId,
        quantity: insertItem.quantity,
        unitPrice: insertItem.unitPrice,
        totalPrice: insertItem.totalPrice,
        installationCost: insertItem.installationCost || null,
        partsCost: insertItem.partsCost || null,
        laborHours: insertItem.laborHours || null,
        laborRate: insertItem.laborRate || null,
        notes: insertItem.notes || null,
      };
      this.orderItems.set(itemId, orderItem);
    }

    // Add initial order history entry
    await this.addOrderHistory({
      orderId,
      userId: null,
      statusFrom: null,
      statusTo: order.status,
      action: "created",
      notes: "Pedido creado en el sistema",
    });

    return (await this.getOrder(orderId))!;
  }

  async getAllOrders(): Promise<OrderWithDetails[]> {
    const orders = await Promise.all(
      Array.from(this.orders.keys()).map(id => this.getOrder(id))
    );
    return orders.filter(order => order !== undefined) as OrderWithDetails[];
  }

  async updateOrder(id: number, updates: Partial<InsertOrder>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (order) {
      const updatedOrder = { 
        ...order, 
        ...updates,
        updatedAt: new Date(),
      };
      this.orders.set(id, updatedOrder);
      return updatedOrder;
    }
    return undefined;
  }

  async assignOrder(orderId: number, userId: number): Promise<Order | undefined> {
    const order = await this.updateOrder(orderId, { 
      assignedUserId: userId,
      status: "assigned",
    });
    
    if (order) {
      await this.addOrderHistory({
        orderId,
        userId,
        statusFrom: "pending",
        statusTo: "assigned",
        action: "assigned",
        notes: "Pedido asignado a técnico",
      });
    }
    
    return order;
  }

  async updateOrderStatus(orderId: number, status: string, userId?: number, notes?: string): Promise<Order | undefined> {
    const currentOrder = this.orders.get(orderId);
    if (!currentOrder) return undefined;

    const updatedOrder = await this.updateOrder(orderId, { status });
    
    if (updatedOrder) {
      await this.addOrderHistory({
        orderId,
        userId: userId || null,
        statusFrom: currentOrder.status,
        statusTo: status,
        action: this.getActionFromStatus(status),
        notes: notes || `Estado cambiado a ${status}`,
      });
    }
    
    return updatedOrder;
  }

  private getActionFromStatus(status: string): string {
    const actionMap: Record<string, string> = {
      'pending': 'created',
      'assigned': 'assigned',
      'in_progress': 'started',
      'completed': 'completed',
      'cancelled': 'cancelled',
    };
    return actionMap[status] || 'updated';
  }

  async getOrderHistory(orderId: number): Promise<OrderHistory[]> {
    return Array.from(this.orderHistory.values())
      .filter(history => history.orderId === orderId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async addOrderHistory(insertHistory: InsertOrderHistory): Promise<OrderHistory> {
    const id = this.currentOrderHistoryId++;
    const history: OrderHistory = {
      id,
      orderId: insertHistory.orderId,
      userId: insertHistory.userId,
      statusFrom: insertHistory.statusFrom,
      statusTo: insertHistory.statusTo,
      action: insertHistory.action,
      notes: insertHistory.notes || null,
      timestamp: new Date(),
    };
    this.orderHistory.set(id, history);
    return history;
  }

  async calculateServicePrice(
    serviceId: number, 
    installationComplexity: number, 
    partsNeeded: Array<{productId: number; quantity: number}>
  ): Promise<{
    basePrice: number;
    installationCost: number;
    partsCost: number;
    laborHours: number;
    laborRate: number;
    totalPrice: number;
  }> {
    const service = this.products.get(serviceId);
    if (!service || service.category !== "service") {
      throw new Error("Servicio no encontrado");
    }

    const basePrice = parseFloat(service.price);
    
    // Calculate installation cost based on complexity (1-5 scale)
    const complexityMultiplier = Math.max(1, installationComplexity / 3);
    const installationCost = basePrice * 0.3 * complexityMultiplier;
    
    // Calculate parts cost
    let partsCost = 0;
    for (const part of partsNeeded) {
      const product = this.products.get(part.productId);
      if (product) {
        partsCost += parseFloat(product.price) * part.quantity;
      }
    }
    
    // Calculate labor based on complexity and service type
    const baseLaborHours = 2 + (installationComplexity * 0.5);
    const laborHours = Math.round(baseLaborHours * 100) / 100;
    const laborRate = 200; // Base rate per hour
    
    const totalPrice = basePrice + installationCost + partsCost + (laborHours * laborRate);
    
    return {
      basePrice,
      installationCost: Math.round(installationCost * 100) / 100,
      partsCost,
      laborHours,
      laborRate,
      totalPrice: Math.round(totalPrice * 100) / 100,
    };
  }

  async getConversation(id: number): Promise<ConversationWithDetails | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;

    const customer = this.customers.get(conversation.customerId);
    if (!customer) return undefined;

    const order = conversation.orderId ? this.orders.get(conversation.orderId) : undefined;
    
    const messages = Array.from(this.messages.values())
      .filter(msg => msg.conversationId === id)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    
    const lastMessage = messages[0];
    const unreadCount = messages.filter(msg => !msg.isRead && msg.senderType === "customer").length;

    return {
      ...conversation,
      customer,
      order,
      lastMessage,
      unreadCount,
    };
  }

  async getActiveConversations(): Promise<ConversationWithDetails[]> {
    const conversations = await Promise.all(
      Array.from(this.conversations.values())
        .filter(conv => conv.status === "active")
        .map(conv => this.getConversation(conv.id))
    );
    return conversations.filter(conv => conv !== undefined) as ConversationWithDetails[];
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = this.currentConversationId++;
    const conversation: Conversation = {
      ...insertConversation,
      id,
      status: insertConversation.status || "active",
      orderId: insertConversation.orderId || null,
      lastMessageAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.conversationId === conversationId)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = {
      ...insertMessage,
      id,
      senderId: insertMessage.senderId || null,
      messageType: insertMessage.messageType || "text",
      whatsappMessageId: insertMessage.whatsappMessageId || null,
      isRead: insertMessage.isRead || false,
      sentAt: new Date(),
    };
    this.messages.set(id, message);

    // Update conversation's lastMessageAt
    const conversation = this.conversations.get(insertMessage.conversationId);
    if (conversation) {
      this.conversations.set(conversation.id, {
        ...conversation,
        lastMessageAt: new Date(),
      });
    }

    return message;
  }

  async markMessagesAsRead(conversationId: number): Promise<void> {
    Array.from(this.messages.values())
      .filter(msg => msg.conversationId === conversationId && !msg.isRead)
      .forEach(msg => {
        this.messages.set(msg.id, { ...msg, isRead: true });
      });
  }

  async getDashboardMetrics(): Promise<{
    ordersToday: number;
    activeConversations: number;
    activeTechnicians: number;
    dailyRevenue: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ordersToday = Array.from(this.orders.values())
      .filter(order => new Date(order.createdAt) >= today).length;

    const activeConversations = Array.from(this.conversations.values())
      .filter(conv => conv.status === "active").length;

    const activeTechnicians = Array.from(this.users.values())
      .filter(user => (user.role === "technician" || user.role === "seller") && user.status === "active").length;

    const dailyRevenue = Array.from(this.orders.values())
      .filter(order => new Date(order.createdAt) >= today && order.status === "completed")
      .reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);

    return {
      ordersToday,
      activeConversations,
      activeTechnicians,
      dailyRevenue,
    };
  }

  async getWhatsAppConfig(): Promise<any> {
    return this.whatsappConfig || {
      metaAppId: "",
      metaAppSecret: "",
      whatsappBusinessAccountId: "",
      whatsappPhoneNumberId: "",
      whatsappToken: "",
      whatsappVerifyToken: "",
      webhookUrl: "",
    };
  }

  async updateWhatsAppConfig(config: any): Promise<any> {
    this.whatsappConfig = {
      ...config,
      updatedAt: new Date(),
    };
    return this.whatsappConfig;
  }

  async getWhatsAppLogs(): Promise<any[]> {
    return [...this.whatsappLogs].reverse(); // Most recent first
  }

  async addWhatsAppLog(log: any): Promise<void> {
    const logEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...log
    };
    this.whatsappLogs.push(logEntry);
    
    // Keep only last 100 logs
    if (this.whatsappLogs.length > 100) {
      this.whatsappLogs = this.whatsappLogs.slice(-100);
    }
  }
}

export const storage = new MemStorage();
