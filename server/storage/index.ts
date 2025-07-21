// server/storage/index.ts
// Punto de entrada temporal para migración gradual

// Importar storage original para compatibilidad
import { storage as originalStorage } from '../storage.js';

// Exportar la capa de compatibilidad temporal
export { storage } from '../storage.js';

// Implementaciones temporales para las nuevas funciones
export function getMasterStorage() {
  console.log('⚠️ Usando getMasterStorage temporal');
  return originalStorage;
}

export async function getTenantStorage(storeId: number) {
  console.log(`⚠️ Usando getTenantStorage temporal para store ${storeId}`);
  // Devolver un wrapper que mantenga compatibilidad
  return {
    getAllProducts: () => originalStorage.getAllProducts(storeId),
    getAllCustomers: () => originalStorage.getAllCustomers(storeId),
    getAllOrders: () => originalStorage.getAllOrders(storeId),
    getOrderById: (id: number) => originalStorage.getOrder(id, storeId),
    createOrder: (orderData: any, items: any[]) => originalStorage.createOrder(orderData, items),
    getAllUsers: () => originalStorage.getAllUsers(storeId),
    getUserNotifications: (userId: number) => originalStorage.getUserNotifications(userId, storeId),
    getNotificationCounts: (userId: number) => originalStorage.getNotificationCounts(userId),
    getStoreConfig: () => originalStorage.getStoreConfig(storeId),
    updateStoreSettings: (settings: any) => originalStorage.updateStoreSettings(storeId, settings),
    getWhatsAppSettings: () => originalStorage.getWhatsAppSettings(storeId),
    getReports: (filters: any) => originalStorage.getReports(storeId, filters),
    // Agregar más métodos según necesidad
  };
}

export async function getTenantStorageForUser(user: { storeId: number }) {
  if (!user.storeId) {
    throw new Error('User does not have a valid store ID');
  }
  return await getTenantStorage(user.storeId);
}

export async function validateTenantAccess(storeId: number) {
  // Validación básica temporal
  if (!storeId || storeId <= 0) {
    throw new Error('Invalid store ID');
  }
  return true;
}

console.log('⚠️ Usando storage de compatibilidad temporal');
console.log('💡 Implementar clases completas para producción');
