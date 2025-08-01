import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../shared/schema.js";
import { eq, desc, and, or, count, sql, ilike, asc, like, lt } from "drizzle-orm";
import { getTenantDb } from "./multi-tenant-db.js";
import { CustomerRegistrationFlow } from "../shared/schema.js";

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
 async getOrderItemsByOrderId(orderId: number) {
  try {
    console.log(`🔍 GETTING ORDER ITEMS WITH PRODUCT NAMES - Order ID: ${orderId}`);
    
    // ✅ HACER JOIN entre order_items y products para obtener nombres
    const orderItemsWithProducts = await tenantDb
      .select({
        // Campos de order_items
        id: schema.orderItems.id,
        orderId: schema.orderItems.orderId,
        productId: schema.orderItems.productId,
        quantity: schema.orderItems.quantity,
        unitPrice: schema.orderItems.unitPrice,
        totalPrice: schema.orderItems.totalPrice,
        installationCost: schema.orderItems.installationCost,
        partsCost: schema.orderItems.partsCost,
        laborHours: schema.orderItems.laborHours,
        laborRate: schema.orderItems.laborRate,
        deliveryCost: schema.orderItems.deliveryCost,
        deliveryDistance: schema.orderItems.deliveryDistance,
        notes: schema.orderItems.notes,
        storeId: schema.orderItems.storeId,
        
        // ✅ CAMPOS DEL PRODUCTO (lo que necesitamos)
        productName: schema.products.name,
        productDescription: schema.products.description,
        productPrice: schema.products.price,
        productCategory: schema.products.category,
        productBrand: schema.products.brand,
        productModel: schema.products.model
      })
      .from(schema.orderItems)
      .leftJoin(
        schema.products,
        eq(schema.orderItems.productId, schema.products.id)
      )
      .where(eq(schema.orderItems.orderId, orderId))
      .orderBy(desc(schema.orderItems.id));

    console.log(`📦 ORDER ITEMS WITH PRODUCTS FOUND: ${orderItemsWithProducts.length}`);
    
    // ✅ LOGGING DETALLADO para debugging
    orderItemsWithProducts.forEach((item, index) => {
      console.log(`  ${index + 1}. Product ID: ${item.productId} | Name: "${item.productName}" | Quantity: ${item.quantity}`);
    });

    return orderItemsWithProducts;
    
  } catch (error) {
    console.error('❌ Error getting order items with products:', error);
    return [];
  }
},

async createOrderItem(itemData: any) {
  try {
    const [item] = await tenantDb.insert(schema.orderItems)
      .values({
        ...itemData,
        createdAt: new Date()
      })
      .returning();
    return item;
  } catch (error) {
    console.error('Error creating order item:', error);
    throw error;
  }
},

async updateOrderItem(id: number, itemData: any) {
  try {
    const [item] = await tenantDb.update(schema.orderItems)
      .set({ ...itemData, updatedAt: new Date() })
      .where(eq(schema.orderItems.id, id))
      .returning();
    return item;
  } catch (error) {
    console.error('Error updating order item:', error);
    throw error;
  }
},

async deleteOrderItem(id: number) {
  try {
    await tenantDb.delete(schema.orderItems)
      .where(eq(schema.orderItems.id, id));
  } catch (error) {
    console.error('Error deleting order item:', error);
    throw error;
  }
},

async updateCustomerLocation(customerId: number, locationData: {
  address: string;
  latitude?: number;
  longitude?: number;
  locationType: 'coordinates' | 'text';
  formattedAddress?: string;
}): Promise<void> {
  try {
    const updateData = {
      address: locationData.address,
      latitude: locationData.latitude || null,
      longitude: locationData.longitude || null,
      location_type: locationData.locationType,
      formatted_address: locationData.formattedAddress || locationData.address,
      updated_at: new Date()
    };

    await this.db
      .update(this.schema.customers)
      .set(updateData)
      .where(eq(this.schema.customers.id, customerId));

  } catch (error) {
    console.error('❌ Error updating customer location:', error);
    throw error;
  }
},

async getStoreLocation(storeId: number): Promise<any | null> {
  try {
    // Si no tienes tabla store_locations, crear ubicación por defecto
    return {
      id: 1,
      storeId: storeId,
      name: 'Tienda Principal',
      address: 'Santo Domingo, República Dominicana',
      latitude: 18.4861,  // Coordenadas de Santo Domingo
      longitude: -69.9312,
      isMainLocation: true
    };
  } catch (error) {
    console.error('❌ Error getting store location:', error);
    return null;
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

   async createProduct(productData: any, storeId: number) {
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
      storeId: storeId,  // ← ¡Este campo falta!
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
    // Filtrar campos undefined
    const filteredData = Object.fromEntries(
      Object.entries(productData).filter(([_, value]) => value !== undefined)
    );

    const updateData = {
      ...filteredData,
      updatedAt: new Date()
    };

    const [product] = await tenantDb.update(schema.products)
      .set(updateData)
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

   // 🔧 FUNCIONES CORREGIDAS PARA tenant-storage.ts

// ✅ CORREGIR getCustomerByPhone - usar "phone" en lugar de "phoneNumber"
async getCustomerByPhone(phoneNumber: string) {
  try {
    const [customer] = await tenantDb.select()
      .from(schema.customers)
      .where(eq(schema.customers.phone, phoneNumber)) // ⚠️ CAMBIO: "phone" no "phoneNumber"
      .limit(1);
    return customer || null;
  } catch (error) {
    console.error('Error getting customer by phone:', error);
    return null;
  }
},

// ✅ MEJORAR createCustomer con UPSERT y manejo de errores
async createCustomer(customerData: any) {
  try {
    // 🔍 PRIMERA VERIFICACIÓN: ¿Ya existe el cliente?
    const existingCustomer = await this.getCustomerByPhone(customerData.phone);
    if (existingCustomer) {
      console.log('Customer already exists, returning existing:', existingCustomer.id);
      return existingCustomer;
    }

    // 🚀 CREAR NUEVO CLIENTE
    const customerToInsert = {
      ...customerData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [customer] = await tenantDb.insert(schema.customers)
      .values(customerToInsert)
      .returning();
    
    console.log('✅ NEW CUSTOMER CREATED:', customer.id);
    return customer;
    
  } catch (error: any) {
    console.error('Error in createCustomer:', error);
    
    // 🚨 MANEJO DE ERROR DE CLAVE DUPLICADA
    if (error.message?.includes('duplicate key') || 
        error.message?.includes('unique constraint') ||
        error.code === '23505') {
      
      console.log('🔄 Handling duplicate key error - fetching existing customer');
      
      // Buscar el cliente existente
      const existingCustomer = await this.getCustomerByPhone(customerData.phone);
      if (existingCustomer) {
        console.log('✅ Retrieved existing customer:', existingCustomer.id);
        return existingCustomer;
      } else {
        console.error('❌ Could not retrieve existing customer after duplicate error');
        throw new Error(`Failed to handle duplicate customer: ${customerData.phone}`);
      }
    }
    
    // Re-lanzar otros tipos de errores
    throw error;
  }
},

// 🔄 ALTERNATIVA: Usar UPSERT para mayor robustez
async createOrUpdateCustomer(customerData: any) {
  try {
    const customerToInsert = {
      ...customerData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [customer] = await tenantDb.insert(schema.customers)
      .values(customerToInsert)
      .onConflictDoUpdate({
        target: schema.customers.phone,
        set: {
          lastContact: new Date(),
          updatedAt: new Date(),
          // Opcional: actualizar otros campos si es necesario
          name: customerToInsert.name,
          whatsappId: customerToInsert.whatsappId
        }
      })
      .returning();
    
    return customer;
  } catch (error) {
    console.error('Error in createOrUpdateCustomer:', error);
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


      // Auto Responses
   
async getAllAutoResponses() {
  try {
    const responses = await tenantDb.select()
      .from(schema.autoResponses)
      .orderBy(asc(schema.autoResponses.priority));
    
    console.log(`📋 Retrieved ${responses.length} auto-responses for store ${storeId}`);
    
    // Si no hay respuestas, crear las por defecto
    if (responses.length === 0) {
      console.log(`⚠️ NO AUTO-RESPONSES FOUND - Creating defaults`);
      await this.createDefaultAutoResponses();
      
      // Volver a consultar
      return await tenantDb.select()
        .from(schema.autoResponses)
        .orderBy(asc(schema.autoResponses.priority));
    }
    
    responses.forEach(resp => {
      console.log(`  - ${resp.name} (Trigger: ${resp.trigger}, Active: ${resp.isActive})`);
    });
    
    return responses;
  } catch (error) {
    console.error('Error getting auto responses:', error);
    return [];
  }
},

async verifyRegistrationFlowHealth(phoneNumber: string): Promise<{
  isHealthy: boolean;
  issues: string[];
  flow: any;
}> {
  try {
    const flow = await this.getRegistrationFlowByPhoneNumber(phoneNumber);
    const issues: string[] = [];
    
    if (!flow) {
      return {
        isHealthy: false,
        issues: ['No registration flow found'],
        flow: null
      };
    }
    
    // Verificar si expiró
    if (flow.expiresAt && new Date() > flow.expiresAt) {
      issues.push('Flow has expired');
    }
    
    // Verificar si tiene orderId cuando debería
    if (flow.flowType === 'order_data_collection' && !flow.orderId) {
      issues.push('Missing orderId for order data collection flow');
    }
    
    // Verificar paso válido
    const validSteps = ['collect_name', 'collect_address', 'collect_contact', 'collect_contact_number', 'collect_payment', 'collect_notes', 'confirm_order', 'completed'];
    if (!validSteps.includes(flow.currentStep)) {
      issues.push(`Invalid step: ${flow.currentStep}`);
    }
    
    // Verificar datos recopilados
    try {
      if (flow.collectedData && typeof flow.collectedData === 'string') {
        JSON.parse(flow.collectedData);
      }
    } catch (parseError) {
      issues.push('Invalid JSON in collectedData');
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      flow
    };
  } catch (error) {
    return {
      isHealthy: false,
      issues: [`Error verifying flow: ${error.message}`],
      flow: null
    };
  }
},

// 🔧 NUEVA FUNCIÓN: Reparar flujo de registro
async repairRegistrationFlow(phoneNumber: string): Promise<boolean> {
  try {
    console.log(`🔧 REPAIRING REGISTRATION FLOW for ${phoneNumber}`);
    
    const health = await this.verifyRegistrationFlowHealth(phoneNumber);
    
    if (health.isHealthy) {
      console.log(`✅ Flow is healthy, no repair needed`);
      return true;
    }
    
    console.log(`⚠️ Issues found:`, health.issues);
    
    if (!health.flow) {
      console.log(`❌ No flow to repair`);
      return false;
    }
    
    let repairData: any = {};
    
    // Reparar datos según los problemas encontrados
    if (health.issues.includes('Flow has expired')) {
      repairData.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    
    if (health.issues.includes('Invalid JSON in collectedData')) {
      repairData.collectedData = JSON.stringify({});
    }
    
    if (health.issues.some(issue => issue.includes('Invalid step'))) {
      repairData.currentStep = 'collect_name';
    }
    
    // Aplicar reparaciones
    if (Object.keys(repairData).length > 0) {
      await this.updateRegistrationFlowByPhone(phoneNumber, {
        ...repairData,
        updatedAt: new Date()
      });
      
      console.log(`✅ Flow repaired with:`, repairData);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error repairing registration flow:', error);
    return false;
  }
},

async getAutoResponse(id: number) {
  try {
    const [response] = await tenantDb.select()
      .from(schema.autoResponses)
      .where(
        and(
          eq(schema.autoResponses.id, id),
          eq(schema.autoResponses.storeId, storeId)
        )
      )
      .limit(1);
    return response || null;
  } catch (error) {
    console.error('Error getting auto response:', error);
    return null;
  }
},

async getAutoResponseByTrigger(trigger: string) {
  try {
    const responses = await this.getAutoResponsesByTrigger(trigger);
    return responses.length > 0 ? responses[0] : null;
  } catch (error) {
    console.error('Error getting auto response by trigger:', error);
    return null;
  }
},

async createAutoResponse(responseData: any) {
  try {
    const autoResponseToInsert = {
      name: responseData.name,
      trigger: responseData.trigger,
      messageText: responseData.messageText,
      storeId: storeId,  // ← Usar storeId del tenant
      isActive: responseData.isActive !== undefined ? responseData.isActive : true,
      priority: responseData.priority || 1,
      requiresRegistration: responseData.requiresRegistration || false,
      menuOptions: responseData.menuOptions || null,
      nextAction: responseData.nextAction || null,
      menuType: responseData.menuType || 'buttons',
      showBackButton: responseData.showBackButton || false,
      allowFreeText: responseData.allowFreeText !== undefined ? responseData.allowFreeText : true,
      responseTimeout: responseData.responseTimeout || 300,
      maxRetries: responseData.maxRetries || 3,
      fallbackMessage: responseData.fallbackMessage || null,
      conditionalDisplay: responseData.conditionalDisplay || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [autoResponse] = await tenantDb.insert(schema.autoResponses)
      .values(autoResponseToInsert)
      .returning();
    
    console.log('✅ AUTO RESPONSE CREATED - ID:', autoResponse.id);
    return autoResponse;
  } catch (error) {
    console.error('Error creating auto response:', error);
    throw error;
  }
},

async updateAutoResponse(id: number, updates: any) {
  try {
    const filteredData = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    const updateData = {
      ...filteredData,
      updatedAt: new Date()
    };

    const [autoResponse] = await tenantDb.update(schema.autoResponses)
      .set(updateData)
      .where(
        and(
          eq(schema.autoResponses.id, id),
          eq(schema.autoResponses.storeId, storeId)
        )
      )
      .returning();
    
    return autoResponse;
  } catch (error) {
    console.error('Error updating auto response:', error);
    throw error;
  }
},

async deleteAutoResponse(id: number) {
  try {
    await tenantDb.delete(schema.autoResponses)
      .where(
        and(
          eq(schema.autoResponses.id, id),
          eq(schema.autoResponses.storeId, storeId)
        )
      );
    
    console.log('✅ AUTO RESPONSE DELETED - ID:', id);
  } catch (error) {
    console.error('Error deleting auto response:', error);
    throw error;
  }
},

async getAutoResponsesByTrigger(trigger: string) {
  try {
    console.log(`🔍 SEARCHING AUTO-RESPONSES BY TRIGGER: "${trigger}"`);
    
    const responses = await tenantDb.select()
      .from(schema.autoResponses)
      .where(
        and(
          eq(schema.autoResponses.trigger, trigger),
          eq(schema.autoResponses.isActive, true)
        )
      )
      .orderBy(asc(schema.autoResponses.priority));
    
    console.log(`📋 FOUND ${responses.length} responses for trigger "${trigger}"`);
    
    // Si no encuentra respuestas, intentar buscar por nombre
    if (responses.length === 0) {
      console.log(`🔍 FALLBACK: Searching by name containing "${trigger}"`);
      
      const fallbackResponses = await tenantDb.select()
        .from(schema.autoResponses)
        .where(
          and(
            or(
              like(schema.autoResponses.name, `%${trigger}%`),
              like(schema.autoResponses.trigger, `%${trigger}%`)
            ),
            eq(schema.autoResponses.isActive, true)
          )
        )
        .orderBy(asc(schema.autoResponses.priority));
      
      console.log(`📋 FALLBACK FOUND ${fallbackResponses.length} responses`);
      return fallbackResponses;
    }
    
    return responses;
  } catch (error) {
    console.error('Error getting auto responses by trigger:', error);
    return [];
  }
},

async clearAllAutoResponses() {
  try {
    await tenantDb.delete(schema.autoResponses)
      .where(eq(schema.autoResponses.storeId, storeId));
    
    console.log('✅ ALL AUTO RESPONSES CLEARED for store:', storeId);
  } catch (error) {
    console.error('Error clearing all auto responses:', error);
    throw error;
  }
},
async createDefaultAutoResponses() {
  try {
    console.log(`📝 CREATING DEFAULT AUTO-RESPONSES for store ${storeId}`);

    const defaultResponses = [
      {
        name: "Bienvenida General",
        trigger: "welcome",
        messageText: "¡Hola! 👋 Bienvenido a nuestro servicio.\n\n¿En qué puedo ayudarte hoy?",
        isActive: true,
        priority: 1,
        menuOptions: JSON.stringify([
          { label: "Ver Productos 📦", value: "products", action: "show_products" },
          { label: "Ver Servicios ⚙️", value: "services", action: "show_services" },
          { label: "Hacer Pedido 🛒", value: "order", action: "start_order" },
          { label: "Contactar Agente 👨‍💼", value: "contact", action: "contact_agent" }
        ]),
        menuType: "buttons",
        nextAction: "wait_selection"
      },
      {
        name: "Saludo",
        trigger: "hola",
        messageText: "¡Hola! 😊 Me da mucho gusto saludarte.\n\n¿En qué puedo ayudarte hoy?",
        isActive: true,
        priority: 2,
        nextAction: "show_menu"
      },
      {
        name: "Solicitar Nombre Cliente",
        trigger: "collect_name",
        messageText: "📝 *Paso 1/5: Datos Personales*\n\nPara completar tu pedido necesito tu nombre completo.\n\n👤 Por favor escribe tu nombre:",
        isActive: true,
        priority: 5,
        menuType: "text_only",
        nextAction: "collect_address",
        allowFreeText: true
      },
      {
        name: "Solicitar Dirección",
        trigger: "collect_address", 
        messageText: "📍 *Paso 2/5: Dirección de Entrega*\n\nPor favor proporciona tu dirección completa:\n\n🏠 Puedes escribir la dirección o compartir tu ubicación GPS",
        isActive: true,
        priority: 6,
        menuType: "text_only",
        nextAction: "collect_contact",
        allowFreeText: true
      },
      {
        name: "Solicitar Número Contacto",
        trigger: "collect_contact",
        messageText: "📞 *Paso 3/5: Número de Contacto*\n\n¿Deseas usar este número de WhatsApp como contacto principal o prefieres proporcionar otro número?",
        isActive: true,
        priority: 7,
        menuOptions: JSON.stringify([
          { label: "✅ Usar este número", value: "use_whatsapp", action: "collect_payment" },
          { label: "📱 Otro número", value: "other_number", action: "collect_contact_number" }
        ]),
        menuType: "buttons",
        nextAction: "collect_payment"
      },
      {
        name: "Solicitar Método de Pago",
        trigger: "collect_payment",
        messageText: "💳 *Paso 4/5: Método de Pago*\n\n¿Cómo deseas pagar tu pedido?",
        isActive: true,
        priority: 8,
        menuOptions: JSON.stringify([
          { label: "💳 Tarjeta", value: "card", action: "collect_notes" },
          { label: "🏦 Transferencia", value: "transfer", action: "collect_notes" },
          { label: "💵 Efectivo", value: "cash", action: "collect_notes" }
        ]),
        menuType: "buttons", 
        nextAction: "collect_notes"
      },
      {
        name: "Solicitar Notas",
        trigger: "collect_notes",
        messageText: "📝 *Paso 5/5: Notas Adicionales*\n\n¿Tienes alguna instrucción especial o comentario para tu pedido?\n\n(Opcional - puedes escribir 'continuar' si no tienes notas)",
        isActive: true,
        priority: 9,
        menuOptions: JSON.stringify([
          { label: "➡️ Continuar sin notas", value: "no_notes", action: "confirm_order" }
        ]),
        menuType: "buttons",
        nextAction: "confirm_order",
        allowFreeText: true
      },
      {
        name: "Confirmación de Pedido",
        trigger: "confirm_order",
        messageText: "📋 *CONFIRMACIÓN DE PEDIDO*\n\nPor favor revisa los datos y confirma si todo está correcto.",
        isActive: true,
        priority: 10,
        menuOptions: JSON.stringify([
          { label: "✅ Confirmar Pedido", value: "confirm", action: "complete_order" },
          { label: "✏️ Modificar", value: "modify", action: "modify_order" }
        ]),
        menuType: "buttons",
        nextAction: "complete_order"
      }
    ];

    let createdCount = 0;

    for (const response of defaultResponses) {
      try {
        // Verificar si ya existe
        const existing = await tenantDb.select()
          .from(schema.autoResponses)
          .where(
            and(
              eq(schema.autoResponses.trigger, response.trigger),
              eq(schema.autoResponses.storeId, storeId)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await tenantDb.insert(schema.autoResponses).values({
            ...response,
            storeId: storeId,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          createdCount++;
          console.log(`✅ Created auto-response: ${response.name}`);
        } else {
          console.log(`⚠️ Auto-response already exists: ${response.name}`);
        }
      } catch (insertError) {
        console.error(`❌ Error creating auto-response ${response.name}:`, insertError);
      }
    }

    console.log(`✅ Created ${createdCount} default auto-responses for store ${storeId}`);
    return createdCount;
  } catch (error) {
    console.error('Error creating default auto responses:', error);
    throw error;
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
    // 1. Primero buscar el cliente por teléfono
    const customer = await this.getCustomerByPhone(phone);
    if (!customer) {
      return null;
    }
    
    // 2. Luego buscar la conversación por customerId
    const [conversation] = await tenantDb.select()
      .from(schema.conversations)
      .where(eq(schema.conversations.customerId, customer.id))
      .orderBy(desc(schema.conversations.lastMessageAt))
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
    },
     async getAllMessages() {
      try {
        return await tenantDb.select()
          .from(schema.messages)
          .orderBy(desc(schema.messages.sentAt));
      } catch (error) {
        console.error('Error getting all messages:', error);
        return [];
      }
    },

    async getMessagesByConversation(conversationId: number) {
      try {
        return await tenantDb.select()
          .from(schema.messages)
          .where(eq(schema.messages.conversationId, conversationId))
          .orderBy(schema.messages.sentAt);
      } catch (error) {
        console.error('Error getting messages by conversation:', error);
        return [];
      }
    },

    async createMessage(messageData: any) {
      try {
        console.log('📝 CREATING MESSAGE - Data:', messageData);

        const messageToInsert = {
          conversationId: messageData.conversationId,
          senderId: messageData.senderId || null,
          senderType: messageData.senderType,
          content: messageData.content,
          messageType: messageData.messageType || 'text',
          whatsappMessageId: messageData.whatsappMessageId || null,
          isRead: messageData.isRead || false,
          sentAt: new Date(),
          createdAt: new Date()
        };

        const [message] = await tenantDb.insert(schema.messages)
          .values(messageToInsert)
          .returning();

        // ✅ Actualizar lastMessageAt de la conversación
        await tenantDb.update(schema.conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(schema.conversations.id, messageData.conversationId));

        console.log('✅ MESSAGE CREATED - ID:', message.id);
        return message;
      } catch (error) {
        console.error('❌ ERROR CREATING MESSAGE:', error);
        throw error;
      }
    },

    async updateMessage(id: number, updates: any) {
      try {
        const filteredData = Object.fromEntries(
          Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        const [message] = await tenantDb.update(schema.messages)
          .set(filteredData)
          .where(eq(schema.messages.id, id))
          .returning();
        
        return message;
      } catch (error) {
        console.error('Error updating message:', error);
        throw error;
      }
    },

    async markMessagesAsRead(conversationId: number) {
      try {
        await tenantDb.update(schema.messages)
          .set({ isRead: true })
          .where(
            and(
              eq(schema.messages.conversationId, conversationId),
              eq(schema.messages.senderType, 'customer')
            )
          );
        
        console.log('✅ MESSAGES MARKED AS READ - Conversation:', conversationId);
      } catch (error) {
        console.error('Error marking messages as read:', error);
        throw error;
      }
    },

    // ✅ HELPERS
    async getOrCreateConversationByPhone(phone: string, storeId: number) {
      try {
        // 1. Buscar conversación existente
        let conversation = await this.getConversationByCustomerPhone(phone);
        
        if (conversation) {
          console.log('✅ EXISTING CONVERSATION FOUND - ID:', conversation.id);
          return conversation;
        }
        
        // 2. Si no existe, buscar o crear cliente
        let customer = await this.getCustomerByPhone(phone);
    if (!customer) {
      console.log('➕ CREATING NEW CUSTOMER FOR CONVERSATION');
      
      // ✅ CORRECCIÓN: Usar los campos correctos
      customer = await this.createCustomer({
        name: `Cliente ${phone.slice(-4)}`,
        phone: phone,                   // ✅ CORRECTO: "phone" no "phoneNumber"  
        storeId: storeId,              // ✅ AGREGAR: storeId requerido
        whatsappId: phone,
        address: null,
        latitude: null,
        longitude: null,
        lastContact: new Date(),
        registrationDate: new Date(),
        totalOrders: 0,
        totalSpent: "0.00",
        isVip: false,
        notes: 'Cliente creado automáticamente desde WhatsApp'
      });
    }
        
        // 3. Crear nueva conversación
        console.log('➕ CREATING NEW CONVERSATION');
    conversation = await this.createConversation({
      customerId: customer.id,
      conversationType: 'initial',
      status: 'active',
      storeId: storeId
    });
    
    return conversation;
  } catch (error) {
    console.error('Error getting or creating conversation by phone:', error);
    throw error;
  }
},

    async getRegistrationFlowByPhoneNumber(phoneNumber: string): Promise<CustomerRegistrationFlow | null> {
  try {
    const [flow] = await tenantDb.select()
      .from(schema.customerRegistrationFlows)
      .where(eq(schema.customerRegistrationFlows.phoneNumber, phoneNumber))
      .limit(1);
    
    return flow || null;
  } catch (error) {
    console.error('Error getting registration flow by phone:', error);
    return null;
  }
},

async updateRegistrationFlowByPhone(phoneNumber: string, updates: any) {
  try {
    const [flow] = await tenantDb.update(schema.customerRegistrationFlows)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(schema.customerRegistrationFlows.phoneNumber, phoneNumber))
      .returning();
    return flow || null;
  } catch (error) {
    console.error('Error updating registration flow by phone:', error);
    return null;
  }
},

async deleteRegistrationFlowByPhone(phoneNumber: string) {
  try {
    await tenantDb.delete(schema.customerRegistrationFlows)
      .where(eq(schema.customerRegistrationFlows.phoneNumber, phoneNumber));
    console.log(`✅ REGISTRATION FLOW DELETED - Phone: ${phoneNumber}`);
  } catch (error) {
    console.error('Error deleting registration flow by phone:', error);
    throw error;
  }
},
async createOrUpdateRegistrationFlow(flowData: any): Promise<any> {
  console.log(`\n🔄 ===== CREATING/UPDATING REGISTRATION FLOW =====`);
  console.log(`👤 Customer ID: ${flowData.customerId}`);
  console.log(`📞 Phone: ${flowData.phoneNumber}`);
  console.log(`📋 Step: ${flowData.currentStep}`);
  console.log(`📦 Order ID: ${flowData.orderId}`);
  
  try {
    // Verificar si ya existe un flujo para este teléfono
    const existingFlow = await this.getRegistrationFlowByPhoneNumber(flowData.phoneNumber);
    console.log(`🔍 Existing flow: ${existingFlow ? 'Found' : 'Not found'}`);
    
    if (existingFlow) {
      console.log(`📝 UPDATING EXISTING FLOW - ID: ${existingFlow.id}`);
      
      // Actualizar flujo existente
      const [updatedFlow] = await tenantDb.update(schema.customerRegistrationFlows)
        .set({
          customerId: flowData.customerId,
          currentStep: flowData.currentStep,
          flowType: flowData.flowType || 'order_data_collection',
          orderId: flowData.orderId,
          orderNumber: flowData.orderNumber,
          collectedData: flowData.collectedData || JSON.stringify({}),
          expiresAt: flowData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
          isCompleted: flowData.isCompleted || false,
          updatedAt: new Date()
        })
        .where(eq(schema.customerRegistrationFlows.phoneNumber, flowData.phoneNumber))
        .returning();
      
      console.log(`✅ FLOW UPDATED - ID: ${updatedFlow.id}`);
      return updatedFlow;
    } else {
      console.log(`➕ CREATING NEW FLOW`);
      
      // Crear nuevo flujo
      const [newFlow] = await tenantDb.insert(schema.customerRegistrationFlows)
        .values({
          customerId: flowData.customerId,
          phoneNumber: flowData.phoneNumber,
          currentStep: flowData.currentStep,
          flowType: flowData.flowType || 'order_data_collection',
          orderId: flowData.orderId,
          orderNumber: flowData.orderNumber,
          collectedData: flowData.collectedData || JSON.stringify({}),
          expiresAt: flowData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
          isCompleted: flowData.isCompleted || false,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          storeId: storeId
        })
        .returning();
      
      console.log(`✅ NEW FLOW CREATED - ID: ${newFlow.id}`);
      return newFlow;
    }
  } catch (error) {
    console.error('❌ ERROR in createOrUpdateRegistrationFlow:', error);
    throw error;
  }
},

async cleanupExpiredRegistrationFlows() {
  try {
    const expiredFlows = await tenantDb.delete(schema.customerRegistrationFlows)
      .where(
        and(
          lt(schema.customerRegistrationFlows.expiresAt, new Date()),
          eq(schema.customerRegistrationFlows.isCompleted, false)
        )
      )
      .returning();
    
    if (expiredFlows.length > 0) {
      console.log(`🧹 CLEANED UP ${expiredFlows.length} expired registration flows`);
    }
    
    return expiredFlows.length;
  } catch (error) {
    console.error('Error cleaning up expired registration flows:', error);
    return 0;
  }
},

    };
}

// En tenant-storage.ts - agregar al final del archivo
export async function createTenantStorageForStore(storeId: number) {
  const tenantDb = await getTenantDb(storeId);
  return createTenantStorage(tenantDb, storeId);
}