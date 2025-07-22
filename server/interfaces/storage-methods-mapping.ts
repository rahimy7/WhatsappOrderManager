// server/interfaces/storage-methods-mapping.ts
// Mapeo de métodos después de la migración para evitar errores

export interface StorageMethodsMapping {
  // ================================
  // MÉTODOS QUE CAMBIARON DE UBICACIÓN
  // ================================

  // ❌ ANTES (storage original):
  // storage.createStoreUser(userData)
  // ✅ AHORA (después de migración):
  // masterStorage.createStoreUser(userData)

  // ❌ ANTES:
  // storage.updateUserStatus(id, status)
  // ✅ AHORA:
  // tenantStorage.updateUser(id, { status })

  // ❌ ANTES:
  // storage.getNotificationCount(userId)
  // ✅ AHORA:
  // tenantStorage.getNotificationCounts(userId)

  // ❌ ANTES:
  // storage.markNotificationAsRead(id)
  // ✅ AHORA:
  // tenantStorage.markNotificationAsRead(id)

  // ❌ ANTES:
  // storage.markAllNotificationsAsRead(userId)
  // ✅ AHORA:
  // tenantStorage.markAllNotificationsAsRead(userId)

  // ❌ ANTES:
  // storage.getWhatsAppLogs(phoneNumberId, limit, offset)
  // ✅ AHORA:
  // tenantStorage.getWhatsAppLogs(phoneNumberId, limit, offset)

  // ❌ ANTES:
  // storage.addWhatsAppLog(logData)
  // ✅ AHORA:
  // masterStorage.addWhatsAppLog(logData)

  // ❌ ANTES:
  // storage.getWhatsAppConfig(storeId)
  // ✅ AHORA:
  // tenantStorage.getWhatsAppSettings()

  // ❌ ANTES:
  // storage.updateWhatsAppConfig(config, storeId)
  // ✅ AHORA:
  // tenantStorage.updateWhatsAppSettings(config)
}

// ================================
// HELPER FUNCTIONS PARA MIGRACIÓN
// ================================

import { StorageFactory } from '../storage/storage-factory.js';
import type { AuthUser } from '@shared/auth.js';

const storageFactory = StorageFactory.getInstance();

/**
 * Wrapper para mantener compatibilidad con el storage original
 * Mapea los métodos antiguos a los nuevos storages
 */
export class StorageCompatibilityWrapper {
  private masterStorage = storageFactory.getMasterStorage();

  constructor(private user: AuthUser) {}

  /**
   * Obtiene tenant storage para el usuario actual
   */
  private async getTenantStorage() {
    if (!this.user.storeId) {
      throw new Error('User must have a store ID for tenant operations');
    }
    return await storageFactory.getTenantStorage(this.user.storeId);
  }

  // ================================
  // MÉTODOS DE COMPATIBILIDAD
  // ================================

  /**
   * ✅ CORREGIDO: createStoreUser
   * Antes: storage.createStoreUser(userData)
   * Ahora: masterStorage.createStoreUser(userData)
   */
  async createStoreUser(userData: any) {
    return await this.masterStorage.createStoreUser(userData);
  }

  /**
   * ✅ CORREGIDO: updateUserStatus
   * Antes: storage.updateUserStatus(id, status)
   * Ahora: tenantStorage.updateUser(id, { status })
   */
  async updateUserStatus(id: number, status: string) {
    const tenantStorage = await this.getTenantStorage();
    return await tenantStorage.updateUser(id, { status });
  }

  /**
   * ✅ CORREGIDO: getNotificationCount
   * Antes: storage.getNotificationCount(userId)
   * Ahora: tenantStorage.getNotificationCounts(userId)
   */
  async getNotificationCount(userId: number) {
    const tenantStorage = await this.getTenantStorage();
    return await tenantStorage.getNotificationCounts(userId);
  }

  /**
   * ✅ CORREGIDO: markNotificationAsRead
   * Antes: storage.markNotificationAsRead(id)
   * Ahora: tenantStorage.markNotificationAsRead(id)
   */
  async markNotificationAsRead(id: number) {
    const tenantStorage = await this.getTenantStorage();
    return await tenantStorage.markNotificationAsRead(id);
  }

  /**
   * ✅ CORREGIDO: markAllNotificationsAsRead
   * Antes: storage.markAllNotificationsAsRead(userId)
   * Ahora: tenantStorage.markAllNotificationsAsRead(userId)
   */
  async markAllNotificationsAsRead(userId: number) {
    const tenantStorage = await this.getTenantStorage();
    return await tenantStorage.markAllNotificationsAsRead(userId);
  }

  /**
   * ✅ CORREGIDO: createNotification
   * Antes: storage.createNotification(data)
   * Ahora: tenantStorage.createNotification(data)
   */
  async createNotification(data: any) {
    const tenantStorage = await this.getTenantStorage();
    return await tenantStorage.createNotification(data);
  }

  /**
   * ✅ CORREGIDO: getWhatsAppLogs
   * Antes: storage.getWhatsAppLogs(phoneNumberId, limit, offset)
   * Ahora: tenantStorage.getWhatsAppLogs(phoneNumberId, limit, offset)
   */
  async getWhatsAppLogs(phoneNumberId: string, limit = 50, offset = 0, filters?: any) {
    const tenantStorage = await this.getTenantStorage();
    return await tenantStorage.getWhatsAppLogs(phoneNumberId, limit, offset, filters);
  }

  /**
   * ✅ CORREGIDO: addWhatsAppLog
   * Antes: storage.addWhatsAppLog(logData)
   * Ahora: masterStorage.addWhatsAppLog(logData)
   */
  async addWhatsAppLog(logData: any) {
    return await this.masterStorage.addWhatsAppLog(logData);
  }

  /**
   * ✅ CORREGIDO: getWhatsAppConfig
   * Antes: storage.getWhatsAppConfig(storeId)
   * Ahora: tenantStorage.getWhatsAppSettings()
   */
  async getWhatsAppConfig() {
    const tenantStorage = await this.getTenantStorage();
    return await tenantStorage.getWhatsAppSettings();
  }

  /**
   * ✅ CORREGIDO: updateWhatsAppConfig
   * Antes: storage.updateWhatsAppConfig(config, storeId)
   * Ahora: tenantStorage.updateWhatsAppSettings(config)
   */
  async updateWhatsAppConfig(config: any) {
    const tenantStorage = await this.getTenantStorage();
    return await tenantStorage.updateWhatsAppSettings(config);
  }

  /**
   * ✅ MÉTODOS QUE PERMANECEN IGUALES
   */
  async getAllUsers() {
    const tenantStorage = await this.getTenantStorage();
    return await tenantStorage.getAllUsers();
  }

  async getUserById(id: number) {
    const tenantStorage = await this.getTenantStorage();
    return await tenantStorage.getUserById(id);
  }

  async getUserNotifications(userId: number) {
    const tenantStorage = await this.getTenantStorage();
    return await tenantStorage.getUserNotifications(userId);
  }
}

// ================================
// FUNCIÓN HELPER PARA USO FÁCIL
// ================================

export function getCompatibleStorage(user: AuthUser): StorageCompatibilityWrapper {
  return new StorageCompatibilityWrapper(user);
}