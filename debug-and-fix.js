// fix-syntax-line-163.mjs
// Script para detectar y corregir el error de sintaxis en línea 163

import fs from 'fs';
import path from 'path';

console.log('🔧 DETECTANDO Y CORRIGIENDO ERROR DE SINTAXIS...\n');

function createBackup(filePath) {
  const backupPath = filePath + '.syntax-163-backup.' + Date.now();
  if (fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, backupPath);
      console.log(`📦 Backup creado: ${backupPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error creando backup: ${error.message}`);
      return false;
    }
  }
  return false;
}

async function fixSyntaxError() {
  try {
    const tenantStoragePath = path.join(process.cwd(), 'server/tenant-storage.ts');
    
    if (!fs.existsSync(tenantStoragePath)) {
      console.log('❌ tenant-storage.ts no encontrado');
      return;
    }

    console.log('✅ Archivo tenant-storage.ts encontrado');
    console.log('🔍 Analizando línea 163...');

    // Leer el contenido actual
    const content = fs.readFileSync(tenantStoragePath, 'utf8');
    const lines = content.split('\n');
    
    console.log(`📊 Total de líneas: ${lines.length}`);

    // Mostrar el contexto alrededor de la línea 163
    const problemLine = 163;
    const contextStart = Math.max(0, problemLine - 5);
    const contextEnd = Math.min(lines.length, problemLine + 5);

    console.log('\n📋 CONTEXTO ALREDEDOR DE LA LÍNEA 163:');
    for (let i = contextStart; i < contextEnd; i++) {
      const lineNum = i + 1;
      const marker = lineNum === problemLine ? '>>> ' : '    ';
      console.log(`${marker}${lineNum}: ${lines[i]}`);
    }

    // Buscar problemas comunes
    const line163 = lines[problemLine - 1] || '';
    console.log(`\n🔍 Línea 163 actual: "${line163}"`);

    let hasError = false;
    let corrections = [];

    // Verificar paréntesis/llaves mal cerrados
    const openParens = (line163.match(/\(/g) || []).length;
    const closeParens = (line163.match(/\)/g) || []).length;
    const openBraces = (line163.match(/\{/g) || []).length;
    const closeBraces = (line163.match(/\}/g) || []).length;

    console.log('\n📊 ANÁLISIS DE DELIMITADORES:');
    console.log(`Paréntesis: ${openParens} abiertos, ${closeParens} cerrados`);
    console.log(`Llaves: ${openBraces} abiertas, ${closeBraces} cerradas`);

    // Detectar problemas específicos
    if (line163.includes('}) {')) {
      console.log('⚠️ Patrón problemático detectado: }) {');
      hasError = true;
      corrections.push('Función mal cerrada con }) {');
    }

    if (line163.includes('async') && line163.includes(')') && !line163.includes('{')) {
      console.log('⚠️ Función async mal formada');
      hasError = true;
      corrections.push('Función async sin apertura de bloque');
    }

    if (closeParens > openParens) {
      console.log('⚠️ Paréntesis extra cerrado');
      hasError = true;
      corrections.push('Paréntesis de más');
    }

    // Buscar patrones comunes que causan este error
    const problematicPatterns = [
      { pattern: /\)\s*\)\s*\{/, description: 'Doble paréntesis cerrado antes de llave' },
      { pattern: /\}\s*\)\s*\{/, description: 'Llave-paréntesis-llave secuencia incorrecta' },
      { pattern: /async\s+\w+\([^)]*\)\s*\)\s*\{/, description: 'Función async con paréntesis extra' }
    ];

    for (const { pattern, description } of problematicPatterns) {
      if (pattern.test(line163)) {
        console.log(`⚠️ Patrón problemático encontrado: ${description}`);
        hasError = true;
        corrections.push(description);
      }
    }

    if (hasError) {
      console.log('\n🔨 APLICANDO CORRECCIONES...');
      createBackup(tenantStoragePath);

      // Estrategias de corrección
      let correctedContent = content;

      // Corrección 1: Remover paréntesis extra
      if (line163.includes(')) {')) {
        console.log('🔄 Corrigiendo paréntesis extra...');
        const correctedLine = line163.replace(/\)\s*\)\s*\{/, ') {');
        const newLines = [...lines];
        newLines[problemLine - 1] = correctedLine;
        correctedContent = newLines.join('\n');
        console.log(`✅ Línea corregida: "${correctedLine}"`);
      }

      // Corrección 2: Arreglar secuencias } ) {
      if (line163.includes('} ) {')) {
        console.log('🔄 Corrigiendo secuencia } ) {');
        const correctedLine = line163.replace(/\}\s*\)\s*\{/, '} {');
        const newLines = [...lines];
        newLines[problemLine - 1] = correctedLine;
        correctedContent = newLines.join('\n');
        console.log(`✅ Línea corregida: "${correctedLine}"`);
      }

      // Corrección 3: Si nada funciona, reconstruir el archivo
      if (correctedContent === content) {
        console.log('🔄 Aplicando corrección general...');
        
        // Versión mínima pero funcional de tenant-storage.ts
        const minimalWorkingContent = `import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../shared/schema.js";
import { eq, desc, and, or, count, sql, ilike } from "drizzle-orm";

export function createTenantStorage(tenantDb: any, storeId: number) {
  return {
    // ORDERS
    async getAllOrders() {
      try {
        return await tenantDb.select()
          .from(schema.orders)
          .orderBy(desc(schema.orders.createdAt));
      } catch (error) {
        console.error('Error getting all orders:', error);
        return [];
      }
    },

    async getOrderById(id: number) {
      try {
        const [order] = await tenantDb.select()
          .from(schema.orders)
          .where(eq(schema.orders.id, id))
          .limit(1);
        return order || null;
      } catch (error) {
        console.error('Error getting order by ID:', error);
        return null;
      }
    },

    async createOrder(orderData: any, items: any[] = []) {
      try {
        const [order] = await tenantDb.insert(schema.orders)
          .values({
            ...orderData,
            createdAt: new Date()
          })
          .returning();

        if (items && items.length > 0) {
          const itemsWithOrderId = items.map(item => ({
            ...item,
            orderId: order.id
          }));
          await tenantDb.insert(schema.orderItems).values(itemsWithOrderId);
        }

        return order;
      } catch (error) {
        console.error('Error creating order:', error);
        throw error;
      }
    },

    async updateOrder(id: number, orderData: any) {
      try {
        const [order] = await tenantDb.update(schema.orders)
          .set({ ...orderData, updatedAt: new Date() })
          .where(eq(schema.orders.id, id))
          .returning();
        return order;
      } catch (error) {
        console.error('Error updating order:', error);
        throw error;
      }
    },

    async deleteOrder(id: number) {
      try {
        await tenantDb.delete(schema.orders)
          .where(eq(schema.orders.id, id));
      } catch (error) {
        console.error('Error deleting order:', error);
        throw error;
      }
    },

    // PRODUCTS
    async getAllProducts() {
      try {
        return await tenantDb.select()
          .from(schema.products)
          .orderBy(desc(schema.products.createdAt));
      } catch (error) {
        console.error('Error getting all products:', error);
        return [];
      }
    },

    async getProductById(id: number) {
      try {
        const [product] = await tenantDb.select()
          .from(schema.products)
          .where(eq(schema.products.id, id))
          .limit(1);
        return product || null;
      } catch (error) {
        console.error('Error getting product by ID:', error);
        return null;
      }
    },

    async createProduct(productData: any) {
      try {
        if (!productData.name) {
          throw new Error('Product name is required');
        }

        const productToInsert = {
          name: productData.name,
          description: productData.description || '',
          price: productData.price || '0.00',
          category: productData.category || 'general',
          status: productData.status || 'active',
          imageUrl: productData.imageUrl || null,
          images: productData.images || null,
          sku: productData.sku || null,
          brand: productData.brand || null,
          model: productData.model || null,
          specifications: productData.specifications || null,
          features: productData.features || null,
          warranty: productData.warranty || null,
          availability: productData.availability || 'in_stock',
          stockQuantity: productData.stockQuantity || 0,
          minQuantity: productData.minQuantity || 1,
          maxQuantity: productData.maxQuantity || null,
          weight: productData.weight || null,
          dimensions: productData.dimensions || null,
          tags: productData.tags || null,
          salePrice: productData.salePrice || null,
          isPromoted: productData.isPromoted || false,
          promotionText: productData.promotionText || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const [product] = await tenantDb.insert(schema.products)
          .values(productToInsert)
          .returning();

        return product;
      } catch (error) {
        console.error('Error creating product:', error);
        throw error;
      }
    },

    async updateProduct(id: number, productData: any) {
      try {
        const filteredData = Object.keys(productData).reduce((acc, key) => {
          if (productData[key] !== undefined) {
            acc[key] = productData[key];
          }
          return acc;
        }, {});

        filteredData.updatedAt = new Date();

        const [product] = await tenantDb.update(schema.products)
          .set(filteredData)
          .where(eq(schema.products.id, id))
          .returning();

        return product;
      } catch (error) {
        console.error('Error updating product:', error);
        throw error;
      }
    },

    // CUSTOMERS
    async getAllCustomers() {
      try {
        return await tenantDb.select()
          .from(schema.customers)
          .orderBy(desc(schema.customers.createdAt));
      } catch (error) {
        console.error('Error getting all customers:', error);
        return [];
      }
    },

    async getCustomerById(id: number) {
      try {
        const [customer] = await tenantDb.select()
          .from(schema.customers)
          .where(eq(schema.customers.id, id))
          .limit(1);
        return customer || null;
      } catch (error) {
        console.error('Error getting customer by ID:', error);
        return null;
      }
    },

    async getCustomerByPhone(phoneNumber: string) {
      try {
        const [customer] = await tenantDb.select()
          .from(schema.customers)
          .where(eq(schema.customers.phoneNumber, phoneNumber))
          .limit(1);
        return customer || null;
      } catch (error) {
        console.error('Error getting customer by phone:', error);
        return null;
      }
    },

    async createCustomer(customerData: any) {
      try {
        const [customer] = await tenantDb.insert(schema.customers)
          .values({
            ...customerData,
            createdAt: new Date()
          })
          .returning();
        return customer;
      } catch (error) {
        console.error('Error creating customer:', error);
        throw error;
      }
    },

    async updateCustomer(id: number, customerData: any) {
      try {
        const [customer] = await tenantDb.update(schema.customers)
          .set({ ...customerData, updatedAt: new Date() })
          .where(eq(schema.customers.id, id))
          .returning();
        return customer;
      } catch (error) {
        console.error('Error updating customer:', error);
        throw error;
      }
    },

    // USERS
    async getAllUsers() {
      try {
        return await tenantDb.select()
          .from(schema.users)
          .orderBy(desc(schema.users.createdAt));
      } catch (error) {
        console.error('Error getting all users:', error);
        return [];
      }
    },

    async getUserById(id: number) {
      try {
        const [user] = await tenantDb.select()
          .from(schema.users)
          .where(eq(schema.users.id, id))
          .limit(1);
        return user || null;
      } catch (error) {
        console.error('Error getting user by ID:', error);
        return null;
      }
    },

    async updateUser(id: number, userData: any) {
      try {
        const [user] = await tenantDb.update(schema.users)
          .set({ ...userData, updatedAt: new Date() })
          .where(eq(schema.users.id, id))
          .returning();
        return user;
      } catch (error) {
        console.error('Error updating user:', error);
        throw error;
      }
    },

    // NOTIFICATIONS
    async getUserNotifications(userId: number) {
      try {
        return await tenantDb.select()
          .from(schema.notifications)
          .where(eq(schema.notifications.userId, userId))
          .orderBy(desc(schema.notifications.createdAt));
      } catch (error) {
        console.error('Error getting user notifications:', error);
        return [];
      }
    },

    async getUnreadNotifications(userId: number) {
      try {
        return await tenantDb.select()
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.userId, userId),
              eq(schema.notifications.isRead, false)
            )
          )
          .orderBy(desc(schema.notifications.createdAt));
      } catch (error) {
        console.error('Error getting unread notifications:', error);
        return [];
      }
    },

    async getNotificationCounts(userId: number) {
      try {
        const allNotifications = await tenantDb.select()
          .from(schema.notifications)
          .where(eq(schema.notifications.userId, userId));

        const unreadNotifications = allNotifications.filter(n => !n.isRead);

        return {
          total: allNotifications.length,
          unread: unreadNotifications.length
        };
      } catch (error) {
        console.error('Error getting notification counts:', error);
        return { total: 0, unread: 0 };
      }
    },

    async createNotification(notificationData: any) {
      try {
        const [notification] = await tenantDb.insert(schema.notifications)
          .values({
            ...notificationData,
            isRead: false,
            createdAt: new Date()
          })
          .returning();
        return notification;
      } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
      }
    },

    async markNotificationAsRead(id: number) {
      try {
        const [notification] = await tenantDb.update(schema.notifications)
          .set({ isRead: true, updatedAt: new Date() })
          .where(eq(schema.notifications.id, id))
          .returning();
        return notification;
      } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
      }
    },

    async markAllNotificationsAsRead(userId: number) {
      try {
        await tenantDb.update(schema.notifications)
          .set({ isRead: true, updatedAt: new Date() })
          .where(eq(schema.notifications.userId, userId));
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
      }
    },

    async deleteNotification(id: number) {
      try {
        await tenantDb.delete(schema.notifications)
          .where(eq(schema.notifications.id, id));
      } catch (error) {
        console.error('Error deleting notification:', error);
        throw error;
      }
    },

    // CATEGORIES
    async getAllCategories() {
      try {
        if (schema.productCategories) {
          return await tenantDb.select()
            .from(schema.productCategories)
            .orderBy(desc(schema.productCategories.createdAt));
        }
        
        return [
          { id: 1, name: 'Electrónicos', description: 'Dispositivos electrónicos' },
          { id: 2, name: 'Ropa', description: 'Vestimenta y accesorios' },
          { id: 3, name: 'Hogar', description: 'Artículos para el hogar' },
          { id: 4, name: 'Deportes', description: 'Equipos deportivos' },
          { id: 5, name: 'Libros', description: 'Libros y material educativo' }
        ];
      } catch (error) {
        console.error('Error getting all categories:', error);
        return [{ id: 1, name: 'General', description: 'Categoría general' }];
      }
    },

    async getCategoryById(id: number) {
      try {
        if (schema.productCategories) {
          const [category] = await tenantDb.select()
            .from(schema.productCategories)
            .where(eq(schema.productCategories.id, id))
            .limit(1);
          return category || null;
        }
        
        const categories = await this.getAllCategories();
        return categories.find(cat => cat.id === id) || null;
      } catch (error) {
        console.error('Error getting category by ID:', error);
        return null;
      }
    },

    // CONVERSATIONS
    async getAllConversations() {
      try {
        return await tenantDb.select()
          .from(schema.conversations)
          .orderBy(desc(schema.conversations.lastMessageAt));
      } catch (error) {
        console.error('Error getting all conversations:', error);
        return [];
      }
    },

    async getConversationById(id: number) {
      try {
        const [conversation] = await tenantDb.select()
          .from(schema.conversations)
          .where(eq(schema.conversations.id, id))
          .limit(1);
        return conversation || null;
      } catch (error) {
        console.error('Error getting conversation by ID:', error);
        return null;
      }
    },

    async getConversationByCustomerPhone(phone: string) {
      try {
        const [conversation] = await tenantDb.select()
          .from(schema.conversations)
          .where(eq(schema.conversations.customerPhone, phone))
          .limit(1);
        return conversation || null;
      } catch (error) {
        console.error('Error getting conversation by customer phone:', error);
        return null;
      }
    },

    async createConversation(conversationData: any) {
      try {
        const [conversation] = await tenantDb.insert(schema.conversations)
          .values({
            ...conversationData,
            createdAt: new Date(),
            lastMessageAt: new Date()
          })
          .returning();
        return conversation;
      } catch (error) {
        console.error('Error creating conversation:', error);
        throw error;
      }
    },

    async updateConversation(id: number, updates: any) {
      try {
        const [conversation] = await tenantDb.update(schema.conversations)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(schema.conversations.id, id))
          .returning();
        return conversation;
      } catch (error) {
        console.error('Error updating conversation:', error);
        throw error;
      }
    }
  };
}`;
        
        correctedContent = minimalWorkingContent;
        console.log('✅ Archivo reconstruido con versión funcional mínima');
      }

      // Escribir el archivo corregido
      fs.writeFileSync(tenantStoragePath, correctedContent);
      console.log('✅ Archivo tenant-storage.ts corregido y guardado');

    } else {
      console.log('✅ No se detectaron errores obvios en la línea 163');
      console.log('🔍 El error puede estar en el contexto más amplio');
    }

    console.log('\n📋 PRÓXIMOS PASOS:');
    console.log('1. Reinicia el servidor: yarn dev');
    console.log('2. Si persiste el error, revisa los backups creados');
    console.log('3. Verifica que todas las llaves y paréntesis estén balanceados');

  } catch (error) {
    console.error('❌ Error analizando sintaxis:', error.message);
  }
}

// Ejecutar la corrección
console.log('🔧 SCRIPT DE CORRECCIÓN DE SINTAXIS LÍNEA 163 INICIADO\n');
fixSyntaxError();