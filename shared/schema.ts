import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  lastContact: timestamp("last_contact"),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(), // 'product', 'service'
  status: text("status").notNull().default("active"), // 'active', 'inactive'
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
  trigger: text("trigger").notNull(), // welcome, menu, product_inquiry, service_inquiry, contact_request
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(1),
  messageText: text("message_text").notNull(),
  requiresRegistration: boolean("requires_registration").default(false),
  menuOptions: text("menu_options"), // JSON array of menu options
  nextAction: text("next_action"), // next_menu, collect_data, create_order, assign_technician
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
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  orderNumber: true,
  createdAt: true,
  updatedAt: true,
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

// Extended types for API responses
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
