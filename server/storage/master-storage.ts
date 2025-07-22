// server/storage/master-storage.ts
// Implementación completa del storage para operaciones del sistema global

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, desc, and, or, count, sql, ilike, gte, lt } from "drizzle-orm";
import * as schema from "@shared/schema";
import bcrypt from 'bcrypt';

import {
  MasterStorage,
  GlobalUser,
  StoreUser,
  InsertGlobalUser,
  InsertStoreUser,
  StoreUserListItem,
  UserStats,
  CreateStoreData,
  WhatsAppLogFilters,
} from "../interfaces/storage";

import {
  VirtualStore,
  WhatsAppSettings,
  WhatsAppLog,
  InsertWhatsAppSettings,
  InsertWhatsAppLog,
} from "@shared/schema";
import ws from "ws";

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}

export class MasterStorageService implements MasterStorage {
 private db: any;
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }

   async getAllConversations(limit = 50, offset = 0): Promise<any[]> {
    try {
      const conversations = await this.db
        .select()
        .from(schema.conversations)
        .orderBy(desc(schema.conversations.lastMessageAt))
        .limit(limit)
        .offset(offset);

      console.log(`✅ Retrieved ${conversations.length} conversations`);
      return conversations;
    } catch (error) {
      console.error('Error getting all conversations:', error);
      return [];
    }
  }

  async getConversationsByStore(storeId: number, limit = 50, offset = 0): Promise<any[]> {
    try {
      const conversations = await this.db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.storeId, storeId))
        .orderBy(desc(schema.conversations.lastMessageAt))
        .limit(limit)
        .offset(offset);

      return conversations;
    } catch (error) {
      console.error(`Error getting conversations for store ${storeId}:`, error);
      return [];
    }
  }

  // ========================================
  // FUNCIONES FALTANTES - CUSTOMERS
  // ========================================

  async getAllCustomers(limit = 100, offset = 0): Promise<any[]> {
    try {
      const customers = await this.db
        .select()
        .from(schema.customers)
        .orderBy(desc(schema.customers.createdAt))
        .limit(limit)
        .offset(offset);

      console.log(`✅ Retrieved ${customers.length} customers`);
      return customers;
    } catch (error) {
      console.error('Error getting all customers:', error);
      return [];
    }
  }

  async getCustomersByStore(storeId: number, limit = 100, offset = 0): Promise<any[]> {
    try {
      const customers = await this.db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.storeId, storeId))
        .orderBy(desc(schema.customers.createdAt))
        .limit(limit)
        .offset(offset);

      return customers;
    } catch (error) {
      console.error(`Error getting customers for store ${storeId}:`, error);
      return [];
    }
  }

  // ========================================
  // FUNCIONES FALTANTES - DASHBOARD METRICS
  // ========================================

  async getDashboardMetrics(storeId?: number): Promise<any> {
    try {
      const baseQuery = storeId 
        ? { where: eq(schema.orders.storeId, storeId) }
        : {};

      // Métricas básicas
      const [totalOrders] = await this.db
        .select({ count: count() })
        .from(schema.orders)
        .where(storeId ? eq(schema.orders.storeId, storeId) : undefined);

      const [totalCustomers] = await this.db
        .select({ count: count() })
        .from(schema.customers)
        .where(storeId ? eq(schema.customers.storeId, storeId) : undefined);

      const [totalProducts] = await this.db
        .select({ count: count() })
        .from(schema.products)
        .where(storeId ? eq(schema.products.storeId, storeId) : undefined);

      // Ventas del mes actual
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const monthlyOrders = await this.db
        .select()
        .from(schema.orders)
        .where(
          and(
            gte(schema.orders.createdAt, firstDayOfMonth),
            storeId ? eq(schema.orders.storeId, storeId) : undefined
          )
        );

      const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

      // Pedidos pendientes
      const [pendingOrders] = await this.db
        .select({ count: count() })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.status, 'pending'),
            storeId ? eq(schema.orders.storeId, storeId) : undefined
          )
        );

      const metrics = {
        totalOrders: totalOrders.count || 0,
        totalCustomers: totalCustomers.count || 0,
        totalProducts: totalProducts.count || 0,
        monthlyRevenue: monthlyRevenue,
        pendingOrders: pendingOrders.count || 0,
        period: 'current_month'
      };

      console.log('✅ Dashboard metrics calculated:', metrics);
      return metrics;

    } catch (error) {
      console.error('Error calculating dashboard metrics:', error);
      return {
        totalOrders: 0,
        totalCustomers: 0,
        totalProducts: 0,
        monthlyRevenue: 0,
        pendingOrders: 0,
        period: 'current_month',
        error: 'Failed to calculate metrics'
      };
    }
  }

  // ========================================
  // FUNCIONES EXISTENTES MEJORADAS
  // ========================================

  async getUserById(id: number): Promise<any | null> {
    try {
      const [user] = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .limit(1);

      return user || null;
    } catch (error) {
      console.error(`Error getting user by ID ${id}:`, error);
      return null;
    }
  }

  async getVirtualStore(id: number): Promise<any | null> {
    try {
      const [store] = await this.db
        .select()
        .from(schema.virtualStores)
        .where(eq(schema.virtualStores.id, id))
        .limit(1);

      return store || null;
    } catch (error) {
      console.error(`Error getting virtual store by ID ${id}:`, error);
      return null;
    }
  }

  async getAllVirtualStores(): Promise<any[]> {
    try {
      const stores = await this.db
        .select()
        .from(schema.virtualStores)
        .orderBy(desc(schema.virtualStores.createdAt));

      return stores;
    } catch (error) {
      console.error('Error getting all virtual stores:', error);
      return [];
    }
  }

  // ========================================
  // WHATSAPP CONFIG MANAGEMENT
  // ========================================

  async getWhatsAppConfig(storeId: number): Promise<any | null> {
    try {
      const [config] = await this.db
        .select()
        .from(schema.whatsappSettings)
        .where(eq(schema.whatsappSettings.storeId, storeId))
        .limit(1);

      return config || null;
    } catch (error) {
      console.error(`Error getting WhatsApp config for store ${storeId}:`, error);
      return null;
    }
  }

  async getWhatsAppConfigByPhoneNumberId(phoneNumberId: string): Promise<any | null> {
    try {
      const [config] = await this.db
        .select()
        .from(schema.whatsappSettings)
        .where(eq(schema.whatsappSettings.phoneNumberId, phoneNumberId))
        .limit(1);

      return config || null;
    } catch (error) {
      console.error(`Error getting WhatsApp config by phoneNumberId ${phoneNumberId}:`, error);
      return null;
    }
  }

  // ========================================
  // WHATSAPP LOGS
  // ========================================

  async addWhatsAppLog(logData: any): Promise<any> {
    try {
      const [log] = await this.db
        .insert(schema.whatsappLogs)
        .values({
          ...logData,
          timestamp: logData.timestamp || new Date()
        })
        .returning();

      return log;
    } catch (error) {
      console.error('Error adding WhatsApp log:', error);
      throw error;
    }
  }

  // ========================================
  // CONNECTION TESTING
  // ========================================

  async testConnection(): Promise<boolean> {
    try {
      await this.db.execute('SELECT 1 as test');
      console.log('✅ Master storage connection test passed');
      return true;
    } catch (error) {
      console.error('❌ Master storage connection test failed:', error);
      return false;
    }
  }

  // ========================================
  // CLEANUP
  // ========================================

  async close(): Promise<void> {
    try {
      await this.pool.end();
      console.log('✅ Master storage connection closed');
    } catch (error) {
      console.error('Error closing master storage connection:', error);
    }
  }

  // ========================================
  // VIRTUAL STORES MANAGEMENT
  // ========================================

  async createStore(storeData: CreateStoreData): Promise<VirtualStore> {
    try {
      const timestamp = Date.now();
      const schemaName = `store_${timestamp}`;
      
      const [newStore] = await this.db.insert(schema.virtualStores).values({
        name: storeData.name,
        description: storeData.description,
        domain: storeData.domain,
        isActive: storeData.isActive,
        contactEmail: storeData.contactEmail,
        contactPhone: storeData.contactPhone,
        address: storeData.address,
        planType: storeData.planType || 'basic',
        whatsappNumber: storeData.whatsappNumber,
        logo: storeData.logo,
        timezone: storeData.timezone || 'America/Mexico_City',
        currency: storeData.currency || 'MXN',
        databaseUrl: `${process.env.DATABASE_URL}&schema=${schemaName}`,
        slug: storeData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        settings: JSON.stringify({
          allowOnlineOrders: true,
          requireCustomerRegistration: false,
          autoAssignOrders: true,
          notifyCustomers: true
        })
      } as any).returning();

      console.log(`✅ Store created: ${newStore.name} (ID: ${newStore.id})`);
      return newStore;
    } catch (error) {
      console.error('Error creating store:', error);
      throw new Error('Failed to create store');
    }
  }

  async updateStore(storeId: number, updates: Partial<VirtualStore>): Promise<VirtualStore> {
    try {
      const [updatedStore] = await this.db.update(schema.virtualStores)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(schema.virtualStores.id, storeId))
        .returning();

      if (!updatedStore) {
        throw new Error(`Store with ID ${storeId} not found`);
      }

      console.log(`✅ Store updated: ${updatedStore.name} (ID: ${storeId})`);
      return updatedStore;
    } catch (error) {
      console.error('Error updating store:', error);
      throw error;
    }
  }

  async deleteStore(storeId: number): Promise<boolean> {
    try {
      // Soft delete: mark as inactive instead of actual deletion
      const [updatedStore] = await this.db.update(schema.virtualStores)
        .set({ isActive: false, updatedAt: new Date() } as any)
        .where(eq(schema.virtualStores.id, storeId))
        .returning();

      if (!updatedStore) {
        return false;
      }

      console.log(`✅ Store soft deleted: ${updatedStore.name} (ID: ${storeId})`);
      return true;
    } catch (error) {
      console.error('Error deleting store:', error);
      return false;
    }
  }

  async isStoreActive(storeId: number): Promise<boolean> {
    try {
      const store = await this.getVirtualStore(storeId);
      return !!(store && store.isActive);
    } catch (error) {
      console.error('Error checking if store is active:', error);
      return false;
    }
  }

  // ========================================
  // GLOBAL USERS (Super Admins)
  // ========================================

  async createGlobalUser(userData: InsertGlobalUser): Promise<GlobalUser> {
    try {
      // Validar unicidad
      await this.validateGlobalUserUniqueness(userData.username, userData.email);
      
      // Hash password si se proporciona
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      const [user] = await this.db.insert(schema.users).values(userData).returning();
      console.log(`✅ Global user created: ${user.username} (${user.role})`);
      return user;
    } catch (error) {
      console.error('❌ Error creating global user:', error);
      throw error;
    }
  }

  async getGlobalUser(username: string): Promise<GlobalUser | null> {
    try {
      const [user] = await this.db.select().from(schema.users)
        .where(eq(schema.users.username, username))
        .limit(1);
      return user || null;
    } catch (error) {
      console.error('Error getting global user:', error);
      return null;
    }
  }

  async getGlobalUserById(id: number): Promise<GlobalUser | null> {
    try {
      const [user] = await this.db.select().from(schema.users)
        .where(eq(schema.users.id, id))
        .limit(1);
      return user || null;
    } catch (error) {
      console.error('Error getting global user by ID:', error);
      return null;
    }
  }

  async listGlobalUsers(): Promise<GlobalUser[]> {
    try {
      return await this.db.select().from(schema.users)
        .orderBy(desc(schema.users.createdAt));
    } catch (error) {
      console.error('Error listing global users:', error);
      return [];
    }
  }

  async updateGlobalUser(id: number, updates: Partial<InsertGlobalUser>): Promise<GlobalUser> {
    try {
      // Hash password si se está actualizando
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
      }

      const [updatedUser] = await this.db.update(schema.users)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(schema.users.id, id))
        .returning();

      if (!updatedUser) {
        throw new Error(`Global user with ID ${id} not found`);
      }

      console.log(`✅ Global user updated: ${updatedUser.username} (ID: ${id})`);
      return updatedUser;
    } catch (error) {
      console.error('Error updating global user:', error);
      throw error;
    }
  }

  async deleteGlobalUser(id: number): Promise<boolean> {
    try {
      const [deletedUser] = await this.db.delete(schema.users)
        .where(eq(schema.users.id, id))
        .returning();

      if (!deletedUser) {
        return false;
      }

      console.log(`✅ Global user deleted: ${deletedUser.username} (ID: ${id})`);
      return true;
    } catch (error) {
      console.error('Error deleting global user:', error);
      return false;
    }
  }

  // ========================================
  // STORE USERS (Owners, Admins)
  // ========================================

  async createStoreUser(userData: InsertStoreUser): Promise<StoreUser> {
    try {
      // Validar que la tienda existe
      const store = await this.getVirtualStore(userData.storeId);
      if (!store) {
        throw new Error(`Store with ID ${userData.storeId} not found`);
      }

      // Validar unicidad del username en systemUsers
      await this.validateStoreUserUniqueness(userData.username, userData.email);

      // Hash password si se proporciona
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      const [user] = await this.db.insert(schema.systemUsers).values(userData).returning();
      console.log(`✅ Store user created: ${user.username} for store ${userData.storeId}`);
      return user;
    } catch (error) {
      console.error('❌ Error creating store user:', error);
      throw error;
    }
  }

  async getStoreUser(username: string): Promise<StoreUser | null> {
    try {
      const [user] = await this.db.select().from(schema.systemUsers)
        .where(eq(schema.systemUsers.username, username))
        .limit(1);
      return user || null;
    } catch (error) {
      console.error('Error getting store user:', error);
      return null;
    }
  }

  async getStoreUserById(id: number): Promise<StoreUser | null> {
    try {
      const [user] = await this.db.select().from(schema.systemUsers)
        .where(eq(schema.systemUsers.id, id))
        .limit(1);
      return user || null;
    } catch (error) {
      console.error('Error getting store user by ID:', error);
      return null;
    }
  }

  async listStoreUsers(): Promise<StoreUserListItem[]> {
    try {
      const users = await this.db
        .select({
          id: schema.systemUsers.id,
          username: schema.systemUsers.username,
          name: schema.systemUsers.name,
          email: schema.systemUsers.email,
          role: schema.systemUsers.role,
          isActive: schema.systemUsers.isActive,
          storeId: schema.systemUsers.storeId,
          createdAt: schema.systemUsers.createdAt,
          storeName: schema.virtualStores.name,
        })
        .from(schema.systemUsers)
        .leftJoin(schema.virtualStores, eq(schema.systemUsers.storeId, schema.virtualStores.id))
        .orderBy(desc(schema.systemUsers.createdAt));

      return users as StoreUserListItem[];
    } catch (error) {
      console.error('Error listing store users:', error);
      return [];
    }
  }

  async getStoreUsersByStoreId(storeId: number): Promise<StoreUser[]> {
    try {
      return await this.db.select().from(schema.systemUsers)
        .where(eq(schema.systemUsers.storeId, storeId))
        .orderBy(desc(schema.systemUsers.createdAt));
    } catch (error) {
      console.error('Error getting store users by store ID:', error);
      return [];
    }
  }

  async updateStoreUser(id: number, updates: Partial<InsertStoreUser>): Promise<StoreUser> {
    try {
      // Hash password si se está actualizando
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
      }

      const [updatedUser] = await this.db.update(schema.systemUsers)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(schema.systemUsers.id, id))
        .returning();

      if (!updatedUser) {
        throw new Error(`Store user with ID ${id} not found`);
      }

      console.log(`✅ Store user updated: ${updatedUser.username} (ID: ${id})`);
      return updatedUser;
    } catch (error) {
      console.error('Error updating store user:', error);
      throw error;
    }
  }

  async deleteStoreUser(id: number): Promise<boolean> {
    try {
      const [deletedUser] = await this.db.delete(schema.systemUsers)
        .where(eq(schema.systemUsers.id, id))
        .returning();

      if (!deletedUser) {
        return false;
      }

      console.log(`✅ Store user deleted: ${deletedUser.username} (ID: ${id})`);
      return true;
    } catch (error) {
      console.error('Error deleting store user:', error);
      return false;
    }
  }

  async getGlobalUserByUsername(username: string): Promise<GlobalUser | null> {
  const [user] = await this.db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username));

  return user || null;
}

  // ========================================
  // USER UTILITIES
  // ========================================

  async findUserAnyLevel(username: string): Promise<{
    user: any;
    level: 'global' | 'store' | null;
    storeId?: number;
  }> {
    try {
      // Primero buscar en usuarios globales
      const globalUser = await this.getGlobalUser(username);
      if (globalUser) {
        return {
          user: globalUser,
          level: 'global'
        };
      }

      // Luego buscar en usuarios de tienda
      const storeUser = await this.getStoreUser(username);
      if (storeUser) {
        return {
          user: storeUser,
          level: 'store',
          storeId: storeUser.storeId
        };
      }

      return {
        user: null,
        level: null
      };
    } catch (error) {
      console.error('Error finding user:', error);
      return {
        user: null,
        level: null
      };
    }
  }

  async getUserStats(): Promise<UserStats> {
    try {
      // Contar usuarios globales
      const [globalUsersCount] = await this.db
        .select({ count: count() })
        .from(schema.users);

      // Contar usuarios de tienda
      const [storeUsersCount] = await this.db
        .select({ count: count() })
        .from(schema.systemUsers);

      // Contar usuarios de tienda activos
      const [activeStoreUsersCount] = await this.db
        .select({ count: count() })
        .from(schema.systemUsers)
        .where(eq(schema.systemUsers.isActive, true));

      // Contar usuarios por rol
      const usersByRole = await this.db
        .select({
          role: schema.users.role,
          count: count()
        })
        .from(schema.users)
        .groupBy(schema.users.role);

      const storeUsersByRole = await this.db
        .select({
          role: schema.systemUsers.role,
          count: count()
        })
        .from(schema.systemUsers)
        .groupBy(schema.systemUsers.role);

      // Combinar roles
      const roleStats: Record<string, number> = {};
      usersByRole.forEach(({ role, count }) => {
        roleStats[role] = count;
      });
      storeUsersByRole.forEach(({ role, count }) => {
        roleStats[role] = (roleStats[role] || 0) + count;
      });

      return {
        globalUsers: globalUsersCount.count,
        storeUsers: storeUsersCount.count,
        activeStoreUsers: activeStoreUsersCount.count,
        usersByRole: roleStats
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        globalUsers: 0,
        storeUsers: 0,
        activeStoreUsers: 0,
        usersByRole: {}
      };
    }
  }

  async authenticateUser(username: string, password: string, storeId?: number): Promise<any> {
    try {
      // Buscar usuario en ambos niveles
      const userResult = await this.findUserAnyLevel(username);
      
      if (!userResult.user) {
        return null;
      }

      // Verificar contraseña
      const isValidPassword = await bcrypt.compare(password, userResult.user.password);
      if (!isValidPassword) {
        return null;
      }

      // Para usuarios de tienda, verificar acceso a la tienda específica
      if (userResult.level === 'store' && storeId) {
        if (userResult.user.storeId !== storeId) {
          return null; // No tiene acceso a esta tienda
        }
      }

      // Retornar usuario sin la contraseña
      const { password: _, ...userWithoutPassword } = userResult.user;
      
      return {
        ...userWithoutPassword,
        level: userResult.level,
        storeId: userResult.storeId || userResult.user.storeId
      };
    } catch (error) {
      console.error('Error authenticating user:', error);
      return null;
    }
  }

  // ========================================
  // WHATSAPP CENTRAL MANAGEMENT
  // ========================================

  async getAllWhatsAppConfigs(): Promise<WhatsAppSettings[]> {
    try {
      return await this.db.select().from(schema.whatsappSettings)
        .orderBy(desc(schema.whatsappSettings.createdAt));
    } catch (error) {
      console.error('Error getting all WhatsApp configs:', error);
      return [];
    }
  }


  async createWhatsAppConfig(config: InsertWhatsAppSettings): Promise<WhatsAppSettings> {
    try {
      // Verificar que la tienda existe
      const store = await this.getVirtualStore(config.storeId);
      if (!store) {
        throw new Error(`Store with ID ${config.storeId} not found`);
      }

      // Desactivar configuraciones previas de la misma tienda
      await this.db.update(schema.whatsappSettings)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.whatsappSettings.storeId, config.storeId));

      const [newConfig] = await this.db.insert(schema.whatsappSettings)
        .values(config)
        .returning();

      console.log(`✅ WhatsApp config created for store ${config.storeId}`);
      return newConfig;
    } catch (error) {
      console.error('❌ Error creating WhatsApp config:', error);
      throw error;
    }
  }

  async updateWhatsAppConfig(storeId: number, config: Partial<InsertWhatsAppSettings>): Promise<WhatsAppSettings> {
    try {
      const [updatedConfig] = await this.db.update(schema.whatsappSettings)
        .set({ ...config, updatedAt: new Date() })
        .where(and(
          eq(schema.whatsappSettings.storeId, storeId),
          eq(schema.whatsappSettings.isActive, true)
        ))
        .returning();

      if (!updatedConfig) {
        throw new Error(`WhatsApp config for store ${storeId} not found`);
      }

      console.log(`✅ WhatsApp config updated for store ${storeId}`);
      return updatedConfig;
    } catch (error) {
      console.error('Error updating WhatsApp config:', error);
      throw error;
    }
  }

  async updateWhatsAppConfigById(id: number, config: Partial<InsertWhatsAppSettings>): Promise<WhatsAppSettings> {
    try {
      const [updatedConfig] = await this.db.update(schema.whatsappSettings)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(schema.whatsappSettings.id, id))
        .returning();

      if (!updatedConfig) {
        throw new Error(`WhatsApp config with ID ${id} not found`);
      }

      console.log(`✅ WhatsApp config updated (ID: ${id})`);
      return updatedConfig;
    } catch (error) {
      console.error('Error updating WhatsApp config by ID:', error);
      throw error;
    }
  }

  async deleteWhatsAppConfig(id: number): Promise<boolean> {
    try {
      const [deletedConfig] = await this.db.delete(schema.whatsappSettings)
        .where(eq(schema.whatsappSettings.id, id))
        .returning();

      if (!deletedConfig) {
        return false;
      }

      console.log(`✅ WhatsApp config deleted (ID: ${id})`);
      return true;
    } catch (error) {
      console.error('Error deleting WhatsApp config:', error);
      return false;
    }
  }

  // ========================================
  // WHATSAPP LOGS (CENTRAL)
  // ========================================


  async getAllWhatsAppLogs(limit = 100, offset = 0, filters?: WhatsAppLogFilters): Promise<WhatsAppLog[]> {
    try {
      let query = this.db.select().from(schema.whatsappLogs);
      
      // Aplicar filtros si se proporcionan
      const conditions = [];
      if (filters?.storeId) {
        conditions.push(eq(schema.whatsappLogs.storeId, filters.storeId));
      }
      if (filters?.type) {
        conditions.push(eq(schema.whatsappLogs.type, filters.type));
      }
      if (filters?.phoneNumber) {
        conditions.push(eq(schema.whatsappLogs.phoneNumber, filters.phoneNumber));
      }
      if (filters?.status) {
        conditions.push(eq(schema.whatsappLogs.status, filters.status));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      return await query
        .orderBy(desc(schema.whatsappLogs.timestamp))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error getting WhatsApp logs:', error);
      return [];
    }
  }

  async getWhatsAppLogStats(storeId?: number): Promise<any> {
    try {
      let baseQuery = this.db.select({
        type: schema.whatsappLogs.type,
        status: schema.whatsappLogs.status,
        count: count()
      }).from(schema.whatsappLogs);

      if (storeId) {
        baseQuery = baseQuery.where(eq(schema.whatsappLogs.storeId, storeId));
      }

      const stats = await baseQuery
        .groupBy(schema.whatsappLogs.type, schema.whatsappLogs.status);

      // Organizar estadísticas por tipo y estado
      const organized: any = {};
      stats.forEach(({ type, status, count }) => {
        if (!organized[type]) {
          organized[type] = {};
        }
        organized[type][status || 'unknown'] = count;
      });

      return organized;
    } catch (error) {
      console.error('Error getting WhatsApp log stats:', error);
      return {};
    }
  }

  async cleanupOldWhatsAppLogs(days = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const [result] = await this.db.delete(schema.whatsappLogs)
        .where(lt(schema.whatsappLogs.timestamp, cutoffDate))
        .returning({ count: count() });

      console.log(`✅ Cleaned up WhatsApp logs older than ${days} days`);
      return result?.count || 0;
    } catch (error) {
      console.error('Error cleaning up WhatsApp logs:', error);
      return 0;
    }
  }

  async getWhatsAppLogsByStoreId(storeId: number, limit = 100, offset = 0): Promise<WhatsAppLog[]> {
    try {
      return await this.db.select().from(schema.whatsappLogs)
        .where(eq(schema.whatsappLogs.storeId, storeId))
        .orderBy(desc(schema.whatsappLogs.timestamp))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error getting WhatsApp logs by store ID:', error);
      return [];
    }
  }

  // ========================================
  // SYSTEM ANALYTICS & METRICS
  // ========================================

  async getSystemMetrics(): Promise<any> {
    try {
      // Métricas básicas del sistema
      const [totalStores] = await this.db
        .select({ count: count() })
        .from(schema.virtualStores);

      const [activeStores] = await this.db
        .select({ count: count() })
        .from(schema.virtualStores)
        .where(eq(schema.virtualStores.isActive, true));

      const [totalUsers] = await this.db
        .select({ count: count() })
        .from(schema.users);

      const [totalStoreUsers] = await this.db
        .select({ count: count() })
        .from(schema.systemUsers);

      // Métricas de WhatsApp
      const [totalWhatsAppConfigs] = await this.db
        .select({ count: count() })
        .from(schema.whatsappSettings)
        .where(eq(schema.whatsappSettings.isActive, true));

      // Logs de los últimos 7 días
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [recentWhatsAppLogs] = await this.db
        .select({ count: count() })
        .from(schema.whatsappLogs)
        .where(gte(schema.whatsappLogs.timestamp, sevenDaysAgo));

      return {
        stores: {
          total: totalStores.count,
          active: activeStores.count,
          inactive: totalStores.count - activeStores.count
        },
        users: {
          global: totalUsers.count,
          store: totalStoreUsers.count,
          total: totalUsers.count + totalStoreUsers.count
        },
        whatsapp: {
          activeConfigs: totalWhatsAppConfigs.count,
          logsLast7Days: recentWhatsAppLogs.count
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting system metrics:', error);
      return {
        stores: { total: 0, active: 0, inactive: 0 },
        users: { global: 0, store: 0, total: 0 },
        whatsapp: { activeConfigs: 0, logsLast7Days: 0 },
        timestamp: new Date()
      };
    }
  }

  async getGlobalDashboard(): Promise<any> {
    try {
      const systemMetrics = await this.getSystemMetrics();
      const userStats = await this.getUserStats();

      // Actividad reciente de tiendas
      const recentStores = await this.db.select()
        .from(schema.virtualStores)
        .orderBy(desc(schema.virtualStores.createdAt))
        .limit(5);

      // Logs recientes de WhatsApp
      const recentLogs = await this.getAllWhatsAppLogs(10, 0);

      return {
        metrics: systemMetrics,
        userStats,
        recentActivity: {
          newStores: recentStores,
          whatsappLogs: recentLogs
        }
      };
    } catch (error) {
      console.error('Error getting global dashboard:', error);
      return {
        metrics: {},
        userStats: {},
        recentActivity: { newStores: [], whatsappLogs: [] }
      };
    }
  }

  async getMultiStoreAnalytics(): Promise<any> {
    try {
      // Analytics por tienda
      const storeAnalytics = await this.db
        .select({
          storeId: schema.virtualStores.id,
          storeName: schema.virtualStores.name,
          isActive: schema.virtualStores.isActive,
          createdAt: schema.virtualStores.createdAt,
          planType: schema.virtualStores.planType
        })
        .from(schema.virtualStores)
        .orderBy(desc(schema.virtualStores.createdAt));

      // Enriquecer con datos de usuarios y WhatsApp por tienda
      const enrichedAnalytics = await Promise.all(
        storeAnalytics.map(async (store) => {
          const [userCount] = await this.db
            .select({ count: count() })
            .from(schema.systemUsers)
            .where(eq(schema.systemUsers.storeId, store.storeId));

          const [whatsappConfig] = await this.db
            .select({ count: count() })
            .from(schema.whatsappSettings)
            .where(and(
              eq(schema.whatsappSettings.storeId, store.storeId),
              eq(schema.whatsappSettings.isActive, true)
            ));

          const [whatsappLogsCount] = await this.db
            .select({ count: count() })
            .from(schema.whatsappLogs)
            .where(eq(schema.whatsappLogs.storeId, store.storeId));

          return {
            ...store,
            userCount: userCount.count,
            hasWhatsAppConfig: whatsappConfig.count > 0,
            whatsappLogsCount: whatsappLogsCount.count
          };
        })
      );

      return {
        stores: enrichedAnalytics,
        summary: {
          totalStores: storeAnalytics.length,
          activeStores: storeAnalytics.filter(s => s.isActive).length,
          storesWithWhatsApp: enrichedAnalytics.filter(s => s.hasWhatsAppConfig).length,
          totalUsers: enrichedAnalytics.reduce((sum, s) => sum + s.userCount, 0)
        }
      };
    } catch (error) {
      console.error('Error getting multi-store analytics:', error);
      return {
        stores: [],
        summary: {
          totalStores: 0,
          activeStores: 0,
          storesWithWhatsApp: 0,
          totalUsers: 0
        }
      };
    }
  }

  // ========================================
  // VALIDATION HELPERS (PRIVATE)
  // ========================================

  private async validateGlobalUserUniqueness(username: string, email: string): Promise<void> {
    // Verificar username único en usuarios globales
    const existingUsername = await this.db.select().from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);
    
    if (existingUsername.length > 0) {
      throw new Error(`Username '${username}' already exists in global users`);
    }

    // Verificar email único en usuarios globales
    const existingEmail = await this.db.select().from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    
    if (existingEmail.length > 0) {
      throw new Error(`Email '${email}' already exists in global users`);
    }

    // También verificar en usuarios de tienda para evitar conflictos
    const existingStoreUsername = await this.db.select().from(schema.systemUsers)
      .where(eq(schema.systemUsers.username, username))
      .limit(1);
    
    if (existingStoreUsername.length > 0) {
      throw new Error(`Username '${username}' already exists in store users`);
    }

    const existingStoreEmail = await this.db.select().from(schema.systemUsers)
      .where(eq(schema.systemUsers.email, email))
      .limit(1);
    
    if (existingStoreEmail.length > 0) {
      throw new Error(`Email '${email}' already exists in store users`);
    }
  }

  private async validateStoreUserUniqueness(username: string, email: string): Promise<void> {
    // Verificar username único en usuarios de tienda
    const existingUsername = await this.db.select().from(schema.systemUsers)
      .where(eq(schema.systemUsers.username, username))
      .limit(1);
    
    if (existingUsername.length > 0) {
      throw new Error(`Username '${username}' already exists in store users`);
    }

    // Verificar email único en usuarios de tienda
    const existingEmail = await this.db.select().from(schema.systemUsers)
      .where(eq(schema.systemUsers.email, email))
      .limit(1);
    
    if (existingEmail.length > 0) {
      throw new Error(`Email '${email}' already exists in store users`);
    }

    // También verificar en usuarios globales para evitar conflictos
    const existingGlobalUsername = await this.db.select().from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);
    
    if (existingGlobalUsername.length > 0) {
      throw new Error(`Username '${username}' already exists in global users`);
    }

    const existingGlobalEmail = await this.db.select().from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    
    if (existingGlobalEmail.length > 0) {
      throw new Error(`Email '${email}' already exists in global users`);
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Verifica la salud de la conexión de base de datos
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'error'; message?: string }> {
    try {
      // Test simple query
      await this.db.select().from(schema.virtualStores).limit(1);
      return { status: 'healthy' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      return { status: 'error', message };
    }
  }

  /**
   * Obtiene estadísticas de uso del sistema
   */
  async getUsageStats(): Promise<any> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfWeek = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Logs de WhatsApp por período
      const [logsToday] = await this.db
        .select({ count: count() })
        .from(schema.whatsappLogs)
        .where(gte(schema.whatsappLogs.timestamp, startOfDay));

      const [logsThisWeek] = await this.db
        .select({ count: count() })
        .from(schema.whatsappLogs)
        .where(gte(schema.whatsappLogs.timestamp, startOfWeek));

      const [logsThisMonth] = await this.db
        .select({ count: count() })
        .from(schema.whatsappLogs)
        .where(gte(schema.whatsappLogs.timestamp, startOfMonth));

      // Tiendas creadas por período
      const [storesThisWeek] = await this.db
        .select({ count: count() })
        .from(schema.virtualStores)
        .where(gte(schema.virtualStores.createdAt, startOfWeek));

      const [storesThisMonth] = await this.db
        .select({ count: count() })
        .from(schema.virtualStores)
        .where(gte(schema.virtualStores.createdAt, startOfMonth));

      return {
        whatsappLogs: {
          today: logsToday.count,
          thisWeek: logsThisWeek.count,
          thisMonth: logsThisMonth.count
        },
        storesCreated: {
          thisWeek: storesThisWeek.count,
          thisMonth: storesThisMonth.count
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return {
        whatsappLogs: { today: 0, thisWeek: 0, thisMonth: 0 },
        storesCreated: { thisWeek: 0, thisMonth: 0 },
        timestamp: new Date()
      };
    }
  }

  /**
   * Limpia datos antiguos del sistema
   */
  async performMaintenance(): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = [];
    let totalCleaned = 0;

    try {
      // Limpiar logs de WhatsApp antiguos (más de 90 días)
      const cleanedLogs = await this.cleanupOldWhatsAppLogs(90);
      totalCleaned += cleanedLogs;
      console.log(`✅ Cleaned ${cleanedLogs} old WhatsApp logs`);
    } catch (error) {
      const errorMsg = `Failed to clean WhatsApp logs: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }

    // Aquí se pueden agregar más tareas de mantenimiento según sea necesario
    // Por ejemplo: limpiar sesiones expiradas, optimizar índices, etc.

    return {
      cleaned: totalCleaned,
      errors
    };
  }
}