import {
  users,
  customers,
  products,
  orders,
  orderItems,
  conversations,
  messages,
  type User,
  type Customer,
  type Product,
  type Order,
  type OrderItem,
  type Conversation,
  type Message,
  type InsertUser,
  type InsertCustomer,
  type InsertProduct,
  type InsertOrder,
  type InsertOrderItem,
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
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<OrderWithDetails>;
  getAllOrders(): Promise<OrderWithDetails[]>;
  updateOrder(id: number, updates: Partial<InsertOrder>): Promise<Order | undefined>;
  assignOrder(orderId: number, userId: number): Promise<Order | undefined>;

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private customers: Map<number, Customer> = new Map();
  private products: Map<number, Product> = new Map();
  private orders: Map<number, Order> = new Map();
  private orderItems: Map<number, OrderItem> = new Map();
  private conversations: Map<number, Conversation> = new Map();
  private messages: Map<number, Message> = new Map();
  
  private currentUserId = 1;
  private currentCustomerId = 1;
  private currentProductId = 1;
  private currentOrderId = 1;
  private currentOrderItemId = 1;
  private currentConversationId = 1;
  private currentMessageId = 1;
  private currentOrderNumber = 1000;

  constructor() {
    this.seedData();
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
      assignedUserId: undefined,
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

    // Seed order items
    const item1: OrderItem = {
      id: this.currentOrderItemId++,
      orderId: order1.id,
      productId: product1.id,
      quantity: 1,
      unitPrice: "1250.00",
      totalPrice: "1250.00",
    };
    this.orderItems.set(item1.id, item1);

    const item2: OrderItem = {
      id: this.currentOrderItemId++,
      orderId: order2.id,
      productId: product2.id,
      quantity: 1,
      unitPrice: "890.00",
      totalPrice: "890.00",
    };
    this.orderItems.set(item2.id, item2);

    const item3: OrderItem = {
      id: this.currentOrderItemId++,
      orderId: order3.id,
      productId: product3.id,
      quantity: 1,
      unitPrice: "2150.00",
      totalPrice: "2150.00",
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

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
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
    const product: Product = { ...insertProduct, id };
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

  async createOrder(insertOrder: InsertOrder, items: InsertOrderItem[]): Promise<OrderWithDetails> {
    const orderId = this.currentOrderId++;
    const orderNumber = `ORD-${this.currentOrderNumber++}`;
    
    const order: Order = {
      ...insertOrder,
      id: orderId,
      orderNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.orders.set(orderId, order);

    // Create order items
    for (const insertItem of items) {
      const itemId = this.currentOrderItemId++;
      const orderItem: OrderItem = {
        ...insertItem,
        id: itemId,
        orderId,
      };
      this.orderItems.set(itemId, orderItem);
    }

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
    return this.updateOrder(orderId, { 
      assignedUserId: userId,
      status: "assigned",
    });
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
}

export const storage = new MemStorage();
