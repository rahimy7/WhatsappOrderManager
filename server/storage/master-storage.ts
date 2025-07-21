// server/storage/master-storage.ts
// Implementación del storage para operaciones del sistema global

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, desc, and, or, count, sql } from "drizzle-orm";
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

export class MasterStorageService implements MasterStorage {
  private db: ReturnType<typeof drizzle>;

  constructor(connectionString: string) {
    const pool = new Pool({ connectionString });
    this.db = drizzle(pool, { schema });
  }

  // ========================================
  // VIRTUAL STORES MANAGEMENT
  // ========================================

  async getAllVirtualStores(): Promise<VirtualStore[]> {
    try {
      return await this.db.select().from(schema.virtualStores)
        .orderBy(desc(schema.virtualStores.createdAt));
    } catch (error) {
      console.error('Error getting all virtual stores:', error);
      return [];
    }
  }

  async getVirtualStore(storeId: number): Promise<VirtualStore | null> {
    try {
      const [store] = await this.db.select().from(schema.virtualStores)
        .where(eq(schema.virtualStores.id, storeId))
        .limit(1);
      return store || null;
    } catch (error) {
      console.error('Error getting virtual store:', error);
      return null;
    }
  }

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

      const [user] = await this.db.update(schema.users)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(schema.users.id, id))
        .returning();

      if (!user) {
        throw new Error(`Global user with ID ${id} not found`);
      }

      console.log(`✅ Global user updated: ${user.username}`);
      return user;
    } catch (error) {
      console.error('Error updating global user:', error);
      throw error;
    }
  }

  async deleteGlobalUser(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(schema.users)
        .where(eq(schema.users.id, id));

      const success = result.rowCount > 0;
      if (success) {
        console.log(`✅ Global user deleted: ID ${id}`);
      }
      return success;
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
      // Validar unicidad
      await this.validateStoreUserUniqueness(userData.username, userData.email);
      
      // Validar que la tienda existe
      const store = await this.getVirtualStore(userData.storeId);
      if (!store) {
        throw new Error(`Store with ID ${userData.storeId} not found`);
      }

      // Hash password si se proporciona
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      const [user] = await this.db.insert(schema.systemUsers).values(userData).returning();
      console.log(`✅ Store user created: ${user.username} (${user.role}) for store ${user.storeId}`);
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
      return await this.db.select({
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

      const [user] = await this.db.update(schema.systemUsers)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(schema.systemUsers.id, id))
        .returning();

      if (!user) {
        throw new Error(`Store user with ID ${id} not found`);
      }

      console.log(`✅ Store user updated: ${user.username}`);
      return user;
    } catch (error) {
      console.error('Error updating store user:', error);
      throw error;
    }
  }

  async deleteStoreUser(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(schema.systemUsers)
        .where(eq(schema.systemUsers.id, id));

      const success = result.rowCount > 0;
      if (success) {
        console.log(`✅ Store user deleted: ID ${id}`);
      }
      return success;
    } catch (error) {
      console.error('Error deleting store user:', error);
      return false;
    }
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
      // 1. Buscar en usuarios globales
      const globalUser = await this.getGlobalUser(username);
      if (globalUser) {
        return { user: globalUser, level: 'global' };
      }

      // 2. Buscar en usuarios de tienda
      const storeUser = await this.getStoreUser(username);
      if (storeUser) {
        return { user: storeUser, level: 'store', storeId: storeUser.storeId };
      }

      return { user: null, level: null };
    } catch (error) {
      console.error('Error finding user at any level:', error);
      return { user: null, level: null };
    }
  }

  async getUserStats(): Promise<UserStats> {
    try {
      const [globalCount] = await this.db.select({ count: count() }).from(schema.users);
      const [storeCount] = await this.db.select({ count: count() }).from(schema.systemUsers);
      const [activeStoreCount] = await this.db.select({ count: count() })
        .from(schema.systemUsers)
        .where(eq(schema.systemUsers.isActive, true));

      // Contar por roles en system_users
      const roleStats = await this.db.select({
        role: schema.systemUsers.role,
        count: count()
      })
      .from(schema.systemUsers)
      .groupBy(schema.systemUsers.role);

      const usersByRole = roleStats.reduce((acc, stat) => {
        acc[stat.role] = stat.count;
        return acc;
      }, {} as Record<string, number>);

      return {
        globalUsers: globalCount.count,
        storeUsers: storeCount.count,
        activeStoreUsers: activeStoreCount.count,
        usersByRole
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

  async getWhatsAppConfig(storeId: number): Promise<WhatsAppSettings | null> {
    try {
      const [config] = await this.db.select().from(schema.whatsappSettings)
        .where(and(
          eq(schema.whatsappSettings.storeId, storeId),
          eq(schema.whatsappSettings.isActive, true)
        ))
        .limit(1);
      return config || null;
    } catch (error) {
      console.error('Error getting WhatsApp config:', error);
      return null;
    }
  }

  async getWhatsAppConfigByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppSettings | null> {
    try {
      if (!phoneNumberId || phoneNumberId.length < 5) return null;

      const [config] = await this.db.select().from(schema.whatsappSettings)
        .where(and(
          eq(schema.whatsappSettings.phoneNumberId, phoneNumberId),
          eq(schema.whatsappSettings.isActive, true)
        ))
        .limit(1);
      return config || null;
    } catch (error) {
      console.error('Error getting WhatsApp config by phoneNumberId:', error);
      return null;
    }
  }

  async createWhatsAppConfig(config: InsertWhatsAppSettings): Promise<WhatsAppSettings> {
    try {
      const [newConfig] = await this.db.insert(schema.whatsappSettings)
        .values(config)
        .returning();
      
      console.log(`✅ WhatsApp config created for store ${config.storeId}`);
      return newConfig;
    } catch (error) {
      console.error('Error creating WhatsApp config:', error);
      throw error;
    }
  }

  async updateWhatsAppConfig(storeId: number, config: Partial<InsertWhatsAppSettings>): Promise<WhatsAppSettings> {
    try {
      const existingConfig = await this.getWhatsAppConfig(storeId);
      
      if (existingConfig) {
        const [updatedConfig] = await this.db.update(schema.whatsappSettings)
          .set({ ...config, updatedAt: new Date() } as any)
          .where(eq(schema.whatsappSettings.id, existingConfig.id))
          .returning();
        
        console.log(`✅ WhatsApp config updated for store ${storeId}`);
        return updatedConfig;
      } else {
        return await this.createWhatsAppConfig({
          ...config,
          storeId,
          isActive: true
        } as InsertWhatsAppSettings);
      }
    } catch (error) {
      console.error('Error updating WhatsApp config:', error);
      throw error;
    }
  }

  async updateWhatsAppConfigById(id: number, config: Partial<InsertWhatsAppSettings>): Promise<WhatsAppSettings> {
    try {
      const [updatedConfig] = await this.db.update(schema.whatsappSettings)
        .set({ ...config, updatedAt: new Date() } as any)
        .where(eq(schema.whatsappSettings.id, id))
        .returning();
      
      if (!updatedConfig) {
        throw new Error(`WhatsApp config with ID ${id} not found`);
      }

      console.log(`✅ WhatsApp config updated: ID ${id}`);
      return updatedConfig;
    } catch (error) {
      console.error('Error updating WhatsApp config by ID:', error);
      throw error;
    }
  }

  async deleteWhatsAppConfig(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(schema.whatsappSettings)
        .where(eq(schema.whatsappSettings.id, id));
      
      const success = result.rowCount > 0;
      if (success) {
        console.log(`✅ WhatsApp config deleted: ID ${id}`);
      }
      return success;
    } catch (error) {
      console.error('Error deleting WhatsApp config:', error);
      return false;
    }
  }

  // ========================================
  // WHATSAPP LOGS (CENTRAL)
  // ========================================

  async getAllWhatsAppLogs(limit = 50, offset = 0, filters: WhatsAppLogFilters = {}): Promise<WhatsAppLog[]> {
    try {
      const baseQuery = this.db.select().from(schema.whatsappLogs);

      const conditions = [];
      if (filters.type) {
        conditions.push(eq(schema.whatsappLogs.type, filters.type));
      }
      if (filters.phoneNumber) {
        conditions.push(eq(schema.whatsappLogs.phoneNumber, filters.phoneNumber));
      }
      if (filters.status) {
        conditions.push(eq(schema.whatsappLogs.status, filters.status));
      }

      const filteredQuery = conditions.length > 0
        ? baseQuery.where(and(...conditions))
        : baseQuery;

      return await filteredQuery
        .orderBy(desc(schema.whatsappLogs.timestamp))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error getting all WhatsApp logs:', error);
      return [];
    }
  }

  async getWhatsAppLogStats(storeId?: number): Promise<any> {
    try {
      const baseQuery = this.db.select({ count: count() }).from(schema.whatsappLogs);
      const storeCondition = storeId ? eq(schema.whatsappLogs.storeId, storeId) : undefined;

      const [total] = storeCondition 
        ? await baseQuery.where(storeCondition)
        : await baseQuery;

      const [success] = storeCondition
        ? await baseQuery.where(and(eq(schema.whatsappLogs.type, 'success'), storeCondition))
        : await baseQuery.where(eq(schema.whatsappLogs.type, 'success'));

      const [errors] = storeCondition
        ? await baseQuery.where(and(eq(schema.whatsappLogs.type, 'error'), storeCondition))
        : await baseQuery.where(eq(schema.whatsappLogs.type, 'error'));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [todayLogs] = storeCondition
        ? await baseQuery.where(and(sql`DATE(${schema.whatsappLogs.timestamp}) = DATE(${today.toISOString()})`, storeCondition))
        : await baseQuery.where(sql`DATE(${schema.whatsappLogs.timestamp}) = DATE(${today.toISOString()})`);

      return {
        total: total.count || 0,
        success: success.count || 0,
        errors: errors.count || 0,
        today: todayLogs.count || 0,
        thisWeek: 0, // Implementar si es necesario
        thisMonth: 0 // Implementar si es necesario
      };
    } catch (error) {
      console.error('Error getting WhatsApp log stats:', error);
      return {
        total: 0,
        success: 0,
        errors: 0,
        today: 0,
        thisWeek: 0,
        thisMonth: 0
      };
    }
  }

  async cleanupOldWhatsAppLogs(days = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const result = await this.db.delete(schema.whatsappLogs)
        .where(sql`${schema.whatsappLogs.timestamp} < ${cutoffDate.toISOString()}`);
      
      const deletedCount = result.rowCount || 0;
      console.log(`✅ Cleaned up ${deletedCount} WhatsApp logs older than ${days} days`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up WhatsApp logs:', error);
      return 0;
    }
  }

  async addWhatsAppLog(log: InsertWhatsAppLog): Promise<WhatsAppLog> {
    try {
      const [logEntry] = await this.db.insert(schema.whatsappLogs)
        .values(log)
        .returning();
      return logEntry;
    } catch (error) {
      console.error('Error adding WhatsApp log:', error);
      throw error;
    }
  }

  // ========================================
  // SYSTEM METRICS
  // ========================================

  async getSystemMetrics(): Promise<{
    totalStores: number;
    activeStores: number;
    totalUsers: number;
    totalOrders: number;
    totalRevenue: number;
    totalMessages: number;
  }> {
    try {
      const stores = await this.getAllVirtualStores();
      const totalStores = stores.length;
      const activeStores = stores.filter(store => store.isActive).length;

      const [totalUsersResult] = await this.db.select({ count: count() }).from(schema.systemUsers);
      const totalUsers = totalUsersResult.count;

      // Para órdenes, ingresos y mensajes necesitaríamos consultar todas las bases de datos tenant
      // Por ahora retornamos valores básicos
      return {
        totalStores,
        activeStores,
        totalUsers,
        totalOrders: 0, // Requiere consulta en todas las tenant DBs
        totalRevenue: 0, // Requiere consulta en todas las tenant DBs
        totalMessages: 0, // Requiere consulta en todas las tenant DBs
      };
    } catch (error) {
      console.error('Error getting system metrics:', error);
      return {
        totalStores: 0,
        activeStores: 0,
        totalUsers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalMessages: 0,
      };
    }
  }

  // ========================================
  // PRIVATE UTILITY METHODS
  // ========================================

  private async validateGlobalUserUniqueness(username: string, email?: string): Promise<void> {
    const existingUser = await this.db.select().from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error(`Username '${username}' already exists in global users`);
    }

    if (email) {
      const existingEmail = await this.db.select().from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (existingEmail.length > 0) {
        throw new Error(`Email '${email}' already exists in global users`);
      }
    }
  }

  private async validateStoreUserUniqueness(username: string, email?: string): Promise<void> {
    const existingUser = await this.db.select().from(schema.systemUsers)
      .where(eq(schema.systemUsers.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error(`Username '${username}' already exists in system users`);
    }

    if (email) {
      const existingEmail = await this.db.select().from(schema.systemUsers)
        .where(eq(schema.systemUsers.email, email))
        .limit(1);

      if (existingEmail.length > 0) {
        throw new Error(`Email '${email}' already exists in system users`);
      }
    }
  }
}