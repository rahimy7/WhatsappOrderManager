// types/index.ts
import { JwtPayload } from 'jsonwebtoken';

// Interfaz personalizada para JWT
export interface CustomJwtPayload extends JwtPayload {
  storeId: number;
  userId?: number;
  // Agrega otras propiedades según necesites
}

// types/database.ts - Esquemas corregidos para Drizzle
import { 
  pgTable, 
  serial, 
  text, 
  integer, 
  timestamp, 
  boolean,
  decimal,
  jsonb 
} from 'drizzle-orm/pg-core';

// Tabla de órdenes
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull(),
  orderNumber: text('order_number').notNull().unique(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('pending'),
  assignedUserId: integer('assigned_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabla de logs de órdenes
export const orderLogs = pgTable('order_logs', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  action: text('action').notNull(),
  statusFrom: text('status_from'),
  statusTo: text('status_to'),
  userId: integer('user_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabla de clientes
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  storeId: integer('store_id').notNull(),
  totalOrders: integer('total_orders').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabla de conversaciones
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull(),
  lastMessageAt: timestamp('last_message_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabla de mensajes
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  senderType: text('sender_type').notNull(), // 'customer' | 'agent'
  content: text('content').notNull(),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabla de categorías de productos
export const productCategories = pgTable('product_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  storeId: integer('store_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabla de carrito de compras
export const shoppingCart = pgTable('shopping_cart', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  productId: integer('product_id').notNull(),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabla de notificaciones
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabla de tiendas
export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  storeWhatsAppNumber: text('store_whatsapp_number'),
  storeName: text('store_name'),
  storeAddress: text('store_address'),
  databaseUrl: text('database_url').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabla de configuración de WhatsApp
export const whatsappConfig = pgTable('whatsapp_config', {
  id: serial('id').primaryKey(),
  storeId: integer('store_id').notNull().unique(),
  accessToken: text('access_token').notNull(),
  phoneNumberId: text('phone_number_id').notNull(),
  webhookVerifyToken: text('webhook_verify_token').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

