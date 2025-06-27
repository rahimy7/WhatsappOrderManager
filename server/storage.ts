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
  type InsertEmployeeProfile,
  type InsertAssignmentRule,
  type CustomerHistory,
  type InsertCustomerHistory,
  type OrderWithDetails,
  type ConversationWithDetails,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count } from "drizzle-orm";

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
  updateCustomer(id: number, customer: InsertCustomer): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
  getAllCustomers(): Promise<Customer[]>;
  updateCustomerLocation(id: number, location: {
    latitude: string;
    longitude: string;
    address: string;
  }): Promise<Customer>;
  updateCustomerName(id: number, name: string): Promise<Customer | undefined>;

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
    deliveryCost?: string;
    deliveryDistance?: string;
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
  getWhatsAppConfig(): Promise<WhatsAppSettings | null>;
  updateWhatsAppConfig(config: InsertWhatsAppSettings): Promise<WhatsAppSettings>;
  
  // WhatsApp Logs
  getWhatsAppLogs(): Promise<WhatsAppLog[]>;
  addWhatsAppLog(log: InsertWhatsAppLog): Promise<WhatsAppLog>;
  
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
      address: "Av. Reforma 123, Col. Centro, CDMX",
      latitude: "19.4326",
      longitude: "-99.1332",
      lastContact: new Date(),
    };
    this.customers.set(customer1.id, customer1);

    const customer2: Customer = {
      id: this.currentCustomerId++,
      name: "María García",
      phone: "+52 55 8765-4321",
      whatsappId: "521558765432",
      address: "Calle 5 de Mayo 456, Col. Roma Norte, CDMX",
      latitude: "19.4195",
      longitude: "-99.1570",
      lastContact: new Date(),
    };
    this.customers.set(customer2.id, customer2);

    const customer3: Customer = {
      id: this.currentCustomerId++,
      name: "Pedro Ramírez",
      phone: "+52 55 9876-5432",
      whatsappId: "521559876543",
      address: "Av. Insurgentes Sur 789, Col. Del Valle, CDMX",
      latitude: "19.3889",
      longitude: "-99.1677",
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

  // Normalize phone number for comparison (remove spaces, dashes, and country codes)
  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/[\s\-\+]/g, '');
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const normalizedSearchPhone = this.normalizePhoneNumber(phone);
    return Array.from(this.customers.values()).find(customer => 
      this.normalizePhoneNumber(customer.phone) === normalizedSearchPhone
    );
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

  async updateCustomer(id: number, customerData: InsertCustomer): Promise<Customer | undefined> {
    const existingCustomer = this.customers.get(id);
    if (!existingCustomer) return undefined;

    const updatedCustomer: Customer = {
      ...existingCustomer,
      ...customerData,
      id,
      whatsappId: customerData.whatsappId || existingCustomer.whatsappId,
      lastContact: existingCustomer.lastContact,
    };
    
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    const exists = this.customers.has(id);
    if (!exists) return false;

    this.customers.delete(id);
    return true;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async updateCustomerLocation(id: number, location: {
    latitude: string;
    longitude: string;
    address: string;
  }): Promise<Customer> {
    const customer = this.customers.get(id);
    if (!customer) {
      throw new Error(`Customer with id ${id} not found`);
    }

    const updatedCustomer = {
      ...customer,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      lastContact: new Date()
    };

    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async updateCustomerName(id: number, name: string): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (!customer) {
      return undefined;
    }
    
    const updatedCustomer: Customer = {
      ...customer,
      name: name,
      lastContact: new Date()
    };
    
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
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
    deliveryCost?: string;
    deliveryDistance?: string;
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
        deliveryCost: insertItem.deliveryCost || null,
        deliveryDistance: insertItem.deliveryDistance || null,
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
      userId: insertHistory.userId ?? null,
      statusFrom: insertHistory.statusFrom ?? null,
      statusTo: insertHistory.statusTo,
      action: insertHistory.action,
      notes: insertHistory.notes || null,
      timestamp: new Date(),
    };
    this.orderHistory.set(id, history);
    return history;
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
    
    const totalPrice = basePrice + installationCost + partsCost + (laborHours * laborRate) + deliveryCost;
    
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

  async updateUserStatus(id: number, status: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ status }).where(eq(users.id, id)).returning();
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
  }): Promise<Customer> {
    const [customer] = await db.update(customers).set({
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      lastContact: new Date()
    }).where(eq(customers.id, id)).returning();
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
    // Generate unique order number using timestamp to avoid conflicts
    const timestamp = Date.now();
    const orderNumber = `ORD-${timestamp.toString().slice(-6)}`;

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

  // WhatsApp Settings with PostgreSQL
  async getWhatsAppConfig(): Promise<WhatsAppSettings | null> {
    const [config] = await db.select().from(whatsappSettings)
      .where(eq(whatsappSettings.isActive, true))
      .orderBy(desc(whatsappSettings.createdAt));
    
    return config || null;
  }

  async updateWhatsAppConfig(config: InsertWhatsAppSettings): Promise<WhatsAppSettings> {
    // Deactivate existing configs
    await db.update(whatsappSettings).set({ isActive: false });
    
    // Insert new config
    const [newConfig] = await db.insert(whatsappSettings).values({
      ...config,
      isActive: true
    }).returning();
    
    return newConfig;
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

  async updateAutoResponse(id: number, updates: Partial<InsertAutoResponse>): Promise<AutoResponse | undefined> {
    const [updatedResponse] = await db.update(autoResponses)
      .set(updates)
      .where(eq(autoResponses.id, id))
      .returning();
    return updatedResponse || undefined;
  }

  async deleteAutoResponse(id: number): Promise<void> {
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
      .orderBy(autoResponses.order);
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
          ruleScore += 10; // Specialization match bonus
        }

        // Check location-based assignment
        if (rule.useLocationBased && location && technician.baseLatitude && technician.baseLongitude) {
          const distance = this.calculateDistance(
            parseFloat(location.latitude),
            parseFloat(location.longitude),
            parseFloat(technician.baseLatitude),
            parseFloat(technician.baseLongitude)
          );
          
          const maxDistance = parseFloat(rule.maxDistanceKm || "15");
          if (distance > maxDistance) {
            ruleMatches = false;
            continue;
          }
          
          // Distance score (closer is better)
          ruleScore += Math.max(0, 10 - (distance / maxDistance) * 10);
        }

        // Check workload
        if (rule.useWorkloadBased) {
          const currentOrders = technician.currentOrders || 0;
          const maxOrders = rule.maxOrdersPerTechnician || 5;
          if (currentOrders >= maxOrders) {
            ruleMatches = false;
            continue;
          }
          
          // Workload score (less busy is better)
          ruleScore += Math.max(0, 5 - currentOrders);
        }

        // Check skill level
        const skillLevel = technician.skillLevel || 1;
        ruleScore += skillLevel;

        if (ruleMatches) {
          applicableRules.push(rule);
          score += ruleScore * (rule.priority || 1);
        }
      }

      if (score > bestScore && applicableRules.length > 0) {
        bestScore = score;
        bestTechnician = technician;
        matchingRules = applicableRules;
      }
    }

    if (!bestTechnician) return null;

    // Calculate distance and estimated time
    let distance;
    let estimatedTime = 60; // Default 60 minutes

    if (location && bestTechnician.baseLatitude && bestTechnician.baseLongitude) {
      distance = this.calculateDistance(
        parseFloat(location.latitude),
        parseFloat(location.longitude),
        parseFloat(bestTechnician.baseLatitude),
        parseFloat(bestTechnician.baseLongitude)
      );
      
      // Estimate time: 30min base + 5min per km
      estimatedTime = 30 + (distance * 5);
    }

    return {
      technician: bestTechnician,
      distance,
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
      const bestMatch = await this.findBestTechnician(orderId);
      
      if (!bestMatch) {
        return {
          success: false,
          reason: "No hay técnicos disponibles que cumplan con los criterios de asignación"
        };
      }

      // Assign the order to the technician
      const assignedOrder = await this.assignOrder(orderId, bestMatch.technician.userId);
      
      if (!assignedOrder) {
        return {
          success: false,
          reason: "Error al asignar la orden al técnico"
        };
      }

      // Update technician's current orders count
      await this.updateEmployeeProfile(bestMatch.technician.id, {
        currentOrders: (bestMatch.technician.currentOrders || 0) + 1
      });

      // Add order history entry
      await this.addOrderHistory({
        orderId,
        status: "assigned",
        notes: `Asignado automáticamente a ${bestMatch.technician.user.name} (${bestMatch.technician.employeeId})`,
        userId: bestMatch.technician.userId
      });

      return {
        success: true,
        assignedTechnician: bestMatch.technician
      };

    } catch (error) {
      console.error("Error in autoAssignOrder:", error);
      return {
        success: false,
        reason: "Error interno del sistema de asignación automática"
      };
    }
  }

  async getAvailableTechnicians(
    specializations?: string[], 
    maxDistance?: number, 
    customerLocation?: { latitude: string; longitude: string }
  ): Promise<(EmployeeProfile & { user: User })[]> {
    // Get all technical employees
    const technicians = await db.select()
      .from(employeeProfiles)
      .innerJoin(users, eq(employeeProfiles.userId, users.id))
      .where(and(
        eq(employeeProfiles.department, "technical"),
        eq(users.status, "active"),
        eq(users.isActive, true)
      ));

    let availableTechnicians = technicians.map(result => ({
      ...result.employee_profiles,
      user: result.users
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

    // Filter by current workload
    availableTechnicians = availableTechnicians.filter(tech => {
      const currentOrders = tech.currentOrders || 0;
      const maxOrders = tech.maxDailyOrders || 5;
      return currentOrders < maxOrders;
    });

    return availableTechnicians;
  }

  // Haversine formula to calculate distance between two points
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const storage = new DatabaseStorage();
