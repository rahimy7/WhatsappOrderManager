import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ================================
// SISTEMA MULTI-TENANT - TIENDAS VIRTUALES
// ================================

// Tabla principal de tiendas virtuales (en base de datos maestra)
export const virtualStores = pgTable("virtual_stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL amigable para la tienda
  description: text("description"),
  logo: text("logo"), // URL del logo de la tienda
  domain: text("domain"), // Dominio personalizado opcional
  whatsappNumber: text("whatsapp_number"),
  address: text("address"),
  timezone: text("timezone").default("America/Mexico_City"),
  currency: text("currency").default("MXN"),
  isActive: boolean("is_active").default(true),
  subscription: text("subscription").default("free"), // 'free', 'basic', 'premium', 'enterprise'
  subscriptionExpiry: timestamp("subscription_expiry"),
  subscriptionPlanId: integer("subscription_plan_id").references(() => subscriptionPlans.id),
  databaseUrl: text("database_url").notNull(), // URL de la base de datos específica de la tienda
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  ownerId: integer("owner_id"), // ID del usuario propietario principal
  settings: text("settings"), // JSON con configuraciones específicas de la tienda
});

// Usuarios del sistema multi-tenant (en base de datos maestra)
export const systemUsers = pgTable("system_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  role: text("role").notNull().default("store_admin"), // 'super_admin', 'store_admin', 'store_user'
  storeId: integer("store_id").references(() => virtualStores.id), // NULL para super_admin
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Planes de suscripción del sistema
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  type: text("type").notNull().default("fixed"), // 'fixed', 'usage_based', 'hybrid'
  isActive: boolean("is_active").default(true),
  
  // Precios
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).default("0.00"),
  
  // Límites de recursos
  maxProducts: integer("max_products").default(-1), // -1 = ilimitado
  maxDbStorage: decimal("max_db_storage", { precision: 10, scale: 2 }).default("-1"), // GB, -1 = ilimitado
  maxWhatsappMessages: integer("max_whatsapp_messages").default(-1), // por mes, -1 = ilimitado
  maxUsers: integer("max_users").default(-1), // usuarios de la tienda
  maxOrders: integer("max_orders").default(-1), // órdenes por mes
  maxCustomers: integer("max_customers").default(-1), // -1 = ilimitado
  
  // Precios por uso (para planes usage_based o hybrid)
  pricePerProduct: decimal("price_per_product", { precision: 10, scale: 4 }).default("0.00"),
  pricePerMessage: decimal("price_per_message", { precision: 10, scale: 4 }).default("0.00"),
  pricePerGbStorage: decimal("price_per_gb_storage", { precision: 10, scale: 2 }).default("0.00"),
  pricePerOrder: decimal("price_per_order", { precision: 10, scale: 4 }).default("0.00"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Suscripciones activas de las tiendas
export const storeSubscriptions = pgTable("store_subscriptions", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => virtualStores.id).notNull(),
  planId: integer("plan_id").references(() => subscriptionPlans.id).notNull(),
  
  status: text("status").notNull().default("active"), // 'active', 'suspended', 'cancelled', 'expired'
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  autoRenew: boolean("auto_renew").default(true),
  
  // Uso actual del período
  currentProducts: integer("current_products").default(0),
  currentDbStorage: decimal("current_db_storage_gb", { precision: 8, scale: 2 }).default("0.00"),
  currentWhatsappMessages: integer("current_whatsapp_messages").default(0),
  currentUsers: integer("current_users").default(0),
  currentOrders: integer("current_orders").default(0),
  currentCustomers: integer("current_customers").default(0),
  
  // Facturación
  lastBillingDate: timestamp("last_billing_date"),
  nextBillingDate: timestamp("next_billing_date"),
  billingCycle: text("billing_cycle").default("monthly"), // 'monthly', 'yearly'
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Historial de uso y facturación
export const usageHistory = pgTable("usage_history", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => virtualStores.id).notNull(),
  subscriptionId: integer("subscription_id").references(() => storeSubscriptions.id).notNull(),
  
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Uso registrado en el período
  productsUsed: integer("products_used").default(0),
  dbStorageUsed: decimal("db_storage_used_gb", { precision: 8, scale: 2 }).default("0.00"),
  whatsappMessagesUsed: integer("whatsapp_messages_used").default(0),
  usersActive: integer("users_active").default(0),
  ordersProcessed: integer("orders_processed").default(0),
  customersActive: integer("customers_active").default(0),
  
  // Costos calculados
  fixedCost: decimal("fixed_cost", { precision: 10, scale: 2 }).default("0.00"),
  usageCost: decimal("usage_cost", { precision: 10, scale: 2 }).default("0.00"),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).default("0.00"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Tabla de auditoría para el sistema multi-tenant
export const systemAuditLog = pgTable("system_audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => systemUsers.id),
  storeId: integer("store_id").references(() => virtualStores.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  details: text("details"), // JSON con detalles de la acción
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ================================
// ESQUEMAS PARA BASES DE DATOS POR TIENDA
// ================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'admin', 'technician', 'seller', 'delivery', 'support', 'customer_service'
  status: text("status").notNull().default("active"), // 'active', 'busy', 'break', 'offline'
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  avatar: text("avatar"),
  hireDate: timestamp("hire_date").defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
  department: text("department"), // 'technical', 'sales', 'delivery', 'support', 'admin'
  permissions: text("permissions").array(), // Array of specific permissions
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  whatsappId: text("whatsapp_id"),
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  mapLink: text("map_link"), // URL clickeable para abrir en Google Maps/GPS
  lastContact: timestamp("last_contact"),
  registrationDate: timestamp("registration_date").defaultNow(),
  totalOrders: integer("total_orders").default(0),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0.00"),
  isVip: boolean("is_vip").default(false),
  notes: text("notes"),
});

export const customerHistory = pgTable("customer_history", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  action: text("action").notNull(), // 'order_created', 'order_completed', 'contact_updated', 'note_added'
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // 'order', 'message', 'system', 'assignment', 'urgent'
  priority: text("priority").notNull().default("normal"), // 'low', 'normal', 'high', 'urgent'
  isRead: boolean("is_read").notNull().default(false),
  relatedId: integer("related_id"), // ID of related entity (order, message, etc.)
  relatedType: text("related_type"), // 'order', 'message', 'customer', 'user'
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(), // 'product', 'service'
  status: text("status").notNull().default("active"), // 'active', 'inactive'
  // Catalog functionality
  imageUrl: text("image_url"),
  images: text("images").array(), // Array of image URLs for gallery
  sku: text("sku").unique(), // Product SKU/code
  brand: text("brand"),
  model: text("model"),
  specifications: text("specifications"), // JSON string for technical specs
  features: text("features").array(), // Array of feature descriptions
  warranty: text("warranty"),
  availability: text("availability").notNull().default("in_stock"), // 'in_stock', 'out_of_stock', 'limited', 'pre_order'
  stockQuantity: integer("stock_quantity").default(0),
  minQuantity: integer("min_quantity").default(1),
  maxQuantity: integer("max_quantity"),
  weight: decimal("weight", { precision: 8, scale: 2 }), // kg
  dimensions: text("dimensions"), // JSON string: {"length": 100, "width": 50, "height": 30}
  tags: text("tags").array(), // Array of search tags
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }), // Optional discounted price
  isPromoted: boolean("is_promoted").default(false),
  promotionText: text("promotion_text"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  assignedUserId: integer("assigned_user_id").references(() => users.id),
  status: text("status").notNull().default("pending"), // 'pending', 'assigned', 'in_progress', 'completed', 'cancelled'
  priority: text("priority").notNull().default("normal"), // 'low', 'normal', 'high', 'urgent'
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  // Service-specific pricing components (only for services)
  installationCost: decimal("installation_cost", { precision: 10, scale: 2 }),
  partsCost: decimal("parts_cost", { precision: 10, scale: 2 }),
  laborHours: decimal("labor_hours", { precision: 4, scale: 2 }),
  laborRate: decimal("labor_rate", { precision: 10, scale: 2 }),
  // Delivery/shipping cost (for products and services)
  deliveryCost: decimal("delivery_cost", { precision: 10, scale: 2 }).default("0"),
  deliveryDistance: decimal("delivery_distance", { precision: 8, scale: 2 }), // km
  notes: text("notes"),
});

// Order workflow tracking
export const orderHistory = pgTable("order_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  statusFrom: text("status_from"),
  statusTo: text("status_to").notNull(),
  action: text("action").notNull(), // 'created', 'assigned', 'started', 'completed', 'cancelled', 'notes_added'
  notes: text("notes"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  orderId: integer("order_id").references(() => orders.id),
  conversationType: text("conversation_type").notNull().default("initial"), // 'initial', 'tracking', 'support'
  status: text("status").notNull().default("active"), // 'active', 'closed'
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  senderId: integer("sender_id").references(() => users.id),
  senderType: text("sender_type").notNull(), // 'customer', 'user'
  messageType: text("message_type").notNull().default("text"), // 'text', 'image', 'document'
  content: text("content").notNull(),
  whatsappMessageId: text("whatsapp_message_id"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  isRead: boolean("is_read").default(false),
});

export const whatsappSettings = pgTable("whatsapp_settings", {
  id: serial("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  phoneNumberId: text("phone_number_id").notNull(),
  webhookVerifyToken: text("webhook_verify_token").notNull(),
  businessAccountId: text("business_account_id"),
  appId: text("app_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whatsappLogs = pgTable("whatsapp_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'incoming', 'outgoing', 'webhook', 'error'
  phoneNumber: text("phone_number"),
  messageContent: text("message_content"),
  messageId: text("message_id"),
  status: text("status"), // 'sent', 'delivered', 'read', 'failed'
  errorMessage: text("error_message"),
  rawData: text("raw_data"), // JSON string
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const autoResponses = pgTable("auto_responses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  trigger: text("trigger").notNull(), // welcome, menu, product_inquiry, service_inquiry, contact_request, order_status, support, tracking
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(1),
  messageText: text("message_text").notNull(),
  requiresRegistration: boolean("requires_registration").default(false),
  menuOptions: text("menu_options"), // JSON array of menu options
  nextAction: text("next_action"), // next_menu, collect_data, create_order, assign_technician, show_products, show_services
  menuType: text("menu_type").default("buttons"), // buttons, list, quick_reply, text_only
  showBackButton: boolean("show_back_button").default(false),
  allowFreeText: boolean("allow_free_text").default(true),
  responseTimeout: integer("response_timeout").default(300), // seconds
  maxRetries: integer("max_retries").default(3),
  fallbackMessage: text("fallback_message"),
  conditionalDisplay: text("conditional_display"), // JSON conditions for when to show this response
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customerRegistrationFlows = pgTable("customer_registration_flows", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  currentStep: text("current_step").notNull(), // name, email, address, location, confirmation
  collectedData: text("collected_data"), // JSON object with collected information
  requestedService: text("requested_service"),
  isCompleted: boolean("is_completed").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Employee management for different roles
export const employeeProfiles = pgTable("employee_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  employeeId: text("employee_id").notNull().unique(), // Format: EMP-001, TECH-001, DEL-001, etc.
  department: text("department").notNull(), // 'technical', 'sales', 'delivery', 'support', 'admin'
  position: text("position").notNull(), // 'Senior Technician', 'Delivery Driver', etc.
  specializations: text("specializations").array(), // e.g., ['air_conditioning', 'electrical', 'plumbing']
  workSchedule: text("work_schedule"), // JSON string with schedule
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  vehicleInfo: text("vehicle_info"), // JSON for delivery personnel
  certifications: text("certifications").array(), // Professional certifications
  salary: decimal("salary", { precision: 10, scale: 2 }),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }), // For sales roles
  territory: text("territory"), // Geographic assignment for delivery/sales
  // Location fields for automatic assignment
  baseLatitude: decimal("base_latitude", { precision: 10, scale: 8 }), // Employee's base location
  baseLongitude: decimal("base_longitude", { precision: 11, scale: 8 }),
  baseAddress: text("base_address"), // Readable address of base location
  serviceRadius: decimal("service_radius", { precision: 5, scale: 2 }).default("10.0"), // Service radius in km
  maxDailyOrders: integer("max_daily_orders").default(5), // Maximum orders per day
  currentOrders: integer("current_orders").default(0), // Current active orders
  availabilityHours: text("availability_hours"), // JSON: {"monday": "08:00-18:00", ...}
  skillLevel: integer("skill_level").default(1), // 1-5 skill rating
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Automatic assignment rules
export const assignmentRules = pgTable("assignment_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(1), // Higher number = higher priority
  // Location criteria
  useLocationBased: boolean("use_location_based").default(true),
  maxDistanceKm: decimal("max_distance_km", { precision: 5, scale: 2 }).default("15.0"),
  // Specialization criteria
  useSpecializationBased: boolean("use_specialization_based").default(true),
  requiredSpecializations: text("required_specializations").array(), // Required specializations for this rule
  // Workload criteria
  useWorkloadBased: boolean("use_workload_based").default(true),
  maxOrdersPerTechnician: integer("max_orders_per_technician").default(5),
  // Time criteria
  useTimeBased: boolean("use_time_based").default(true),
  availabilityRequired: boolean("availability_required").default(true),
  // Product/Service criteria
  applicableProducts: text("applicable_products").array(), // Product IDs this rule applies to
  applicableServices: text("applicable_services").array(), // Service categories
  // Assignment behavior
  assignmentMethod: text("assignment_method").default("closest_available"), // closest_available, least_busy, highest_skill, round_robin
  autoAssign: boolean("auto_assign").default(true), // Automatically assign or just suggest
  notifyCustomer: boolean("notify_customer").default(true),
  estimatedResponseTime: integer("estimated_response_time").default(60), // minutes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Shopping cart for catalog system
export const shoppingCart = pgTable("shopping_cart", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(), // For guest users
  userId: integer("user_id").references(() => users.id), // For logged-in users
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  notes: text("notes"), // Special instructions
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Product categories for better organization
export const productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  parentId: integer("parent_id"), // For subcategories - self-reference
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  lastContact: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  orderNumber: z.string().optional(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertOrderHistorySchema = createInsertSchema(orderHistory).omit({
  id: true,
  timestamp: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  lastMessageAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  sentAt: true,
});

export const insertWebMessageSchema = createInsertSchema(messages).omit({
  id: true,
  sentAt: true,
  conversationId: true,
});

export const insertWhatsAppSettingsSchema = createInsertSchema(whatsappSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsAppLogSchema = createInsertSchema(whatsappLogs).omit({
  id: true,
  timestamp: true,
});

export const insertAutoResponseSchema = createInsertSchema(autoResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerRegistrationFlowSchema = createInsertSchema(customerRegistrationFlows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmployeeProfileSchema = createInsertSchema(employeeProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssignmentRuleSchema = createInsertSchema(assignmentRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShoppingCartSchema = createInsertSchema(shoppingCart).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductCategorySchema = createInsertSchema(productCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Subscription plan schemas
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  monthlyPrice: z.union([z.string(), z.number()]).transform(val => String(val)),
  maxDbStorage: z.union([z.string(), z.number()]).transform(val => String(val)),
  pricePerProduct: z.union([z.string(), z.number()]).transform(val => String(val)),
  pricePerMessage: z.union([z.string(), z.number()]).transform(val => String(val)),
  pricePerGbStorage: z.union([z.string(), z.number()]).transform(val => String(val)),
  pricePerOrder: z.union([z.string(), z.number()]).transform(val => String(val)),
});

export const insertStoreSubscriptionSchema = createInsertSchema(storeSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUsageHistorySchema = createInsertSchema(usageHistory).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type OrderHistory = typeof orderHistory.$inferSelect;
export type InsertOrderHistory = z.infer<typeof insertOrderHistorySchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type WhatsAppSettings = typeof whatsappSettings.$inferSelect;
export type InsertWhatsAppSettings = z.infer<typeof insertWhatsAppSettingsSchema>;

export type WhatsAppLog = typeof whatsappLogs.$inferSelect;
export type InsertWhatsAppLog = z.infer<typeof insertWhatsAppLogSchema>;

export type AutoResponse = typeof autoResponses.$inferSelect;
export type InsertAutoResponse = z.infer<typeof insertAutoResponseSchema>;

export type CustomerRegistrationFlow = typeof customerRegistrationFlows.$inferSelect;
export type InsertCustomerRegistrationFlow = z.infer<typeof insertCustomerRegistrationFlowSchema>;

export type EmployeeProfile = typeof employeeProfiles.$inferSelect;
export type InsertEmployeeProfile = z.infer<typeof insertEmployeeProfileSchema>;

export type AssignmentRule = typeof assignmentRules.$inferSelect;
export type InsertAssignmentRule = z.infer<typeof insertAssignmentRuleSchema>;

export type ShoppingCart = typeof shoppingCart.$inferSelect;
export type InsertShoppingCart = z.infer<typeof insertShoppingCartSchema>;

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;

// Subscription types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;

export type StoreSubscription = typeof storeSubscriptions.$inferSelect;
export type InsertStoreSubscription = z.infer<typeof insertStoreSubscriptionSchema>;

export type UsageHistory = typeof usageHistory.$inferSelect;
export type InsertUsageHistory = z.infer<typeof insertUsageHistorySchema>;

export type CartItem = typeof shoppingCart.$inferSelect;
export type InsertCartItem = z.infer<typeof insertShoppingCartSchema>;

export const insertCustomerHistorySchema = createInsertSchema(customerHistory);
export type CustomerHistory = typeof customerHistory.$inferSelect;
export type InsertCustomerHistory = z.infer<typeof insertCustomerHistorySchema>;

// Extended types for API responses
export type OrderItemWithProduct = OrderItem & {
  product: Product;
};

export type OrderWithDetails = Order & {
  customer: Customer;
  assignedUser?: User;
  items: (OrderItem & { product: Product })[];
};

export type ConversationWithDetails = Conversation & {
  customer: Customer;
  order?: Order;
  lastMessage?: Message;
  unreadCount: number;
};

export type MessageWithSender = Message & {
  sender?: User;
};

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Store configuration table
export const storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => virtualStores.id),
  storeWhatsAppNumber: text("store_whatsapp_number").notNull(),
  storeName: text("store_name").notNull(),
  storeAddress: text("store_address"),
  storeEmail: text("store_email"),
  businessHours: text("business_hours").default("09:00-18:00"),
  deliveryRadius: text("delivery_radius").default("50"),
  baseSiteUrl: text("base_site_url"),
  enableNotifications: boolean("enable_notifications").default(true),
  autoAssignOrders: boolean("auto_assign_orders").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStoreSettingsSchema = createInsertSchema(storeSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StoreSettings = typeof storeSettings.$inferSelect;
export type InsertStoreSettings = z.infer<typeof insertStoreSettingsSchema>;

// ================================
// TIPOS Y SCHEMAS MULTI-TENANT
// ================================

// Virtual Stores
export const insertVirtualStoreSchema = createInsertSchema(virtualStores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  databaseUrl: true, // Se genera automáticamente en el backend
});

export type VirtualStore = typeof virtualStores.$inferSelect;
export type InsertVirtualStore = z.infer<typeof insertVirtualStoreSchema>;

// System Users 
export const insertSystemUserSchema = createInsertSchema(systemUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
});

export type SystemUser = typeof systemUsers.$inferSelect;
export type InsertSystemUser = z.infer<typeof insertSystemUserSchema>;

// System Audit Log
export const insertSystemAuditLogSchema = createInsertSchema(systemAuditLog).omit({
  id: true,
  createdAt: true,
});

export type SystemAuditLog = typeof systemAuditLog.$inferSelect;
export type InsertSystemAuditLog = z.infer<typeof insertSystemAuditLogSchema>;

// Extended types for multi-tenant API responses
export type VirtualStoreWithOwner = VirtualStore & {
  owner?: SystemUser;
  userCount?: number;
  orderCount?: number;
  lastActivity?: Date;
};

export type SystemUserWithStore = SystemUser & {
  store?: VirtualStore;
};
