import { StorageFactory } from './storage/storage-factory.js';
import { getMasterStorage, getTenantStorage } from './storage/index.js';
import { createTenantStorage } from './tenant-storage.js';
import { createTenantStorageForStore } from './tenant-storage.js';
import { IntelligentWelcomeService, OrderTrackingService } from './order-tracking';

import { resilientDb } from './db'; // Tu nuevo db con ResilientDatabase
import { ImprovedWebhookHandler } from '../webhook/improved-handler';
import { fixDatabaseSchema } from './database-migration.js';

const webhookHandler = new ImprovedWebhookHandler(resilientDb);
const storageFactory = StorageFactory.getInstance();
const masterStorage = storageFactory.getMasterStorage();

async function getStorageHelper() {
  return masterStorage;
}

interface CollectedData {
  customerName?: string;
  address?: string;
  contactNumber?: string;
  paymentMethod?: string;
  notes?: string;
  location?: LocationData;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  [key: string]: any;
}

interface RegistrationFlow {
  currentStep: string;
  collectedData?: string | object;
  orderId?: number;
  phoneNumber: string;
  [key: string]: any;
}


// Interfaces para manejo de ubicaciones
interface WhatsAppLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

interface LocationData {
  type: 'coordinates' | 'text';
  latitude?: number;
  longitude?: number;
  address?: string;
  formatted_address?: string;
}

function getStatusEmoji(status) {
  const statusEmojis = {
    'pending': '⏳',
    'confirmed': '✅',
    'processing': '🔄',
    'shipped': '🚚',
    'delivered': '📦',
    'cancelled': '❌',
    'completed': '✅'
  };
  return statusEmojis[status] || '📋';
}

function getStatusText(status) {
  const statusTexts = {
    'pending': 'Pendiente',
    'confirmed': 'Confirmado',
    'processing': 'En Proceso',
    'shipped': 'Enviado',
    'delivered': 'Entregado',
    'cancelled': 'Cancelado',
    'completed': 'Completado'
  };
  return statusTexts[status] || 'Desconocido';
}

async function checkCustomerOrders(phoneNumber: string, tenantStorage: any, storeId: number) {
  try {
    // Obtener cliente por número de teléfono
    const customer = await tenantStorage.getCustomerByPhone(phoneNumber);
    if (!customer) {
      console.log(`👤 CUSTOMER NOT FOUND - Phone: ${phoneNumber}`);
      return { hasOrders: false };
    }

    console.log(`👤 CUSTOMER FOUND - ID: ${customer.id}, Name: ${customer.name}`);

    // ✅ SIMPLIFICADO: Usar getAllOrders directamente en lugar de OrderTrackingService
    const allOrders = await tenantStorage.getAllOrders();
    const customerOrders = allOrders.filter(order => order.customerId === customer.id);
    const activeOrders = customerOrders.filter(order => 
      ['pending', 'confirmed', 'processing', 'shipped'].includes(order.status)
    );

    console.log(`📦 ACTIVE ORDERS FOUND: ${activeOrders.length}`);

    return {
      hasOrders: activeOrders.length > 0,
      orders: activeOrders,
      customerName: customer.name,
      customerId: customer.id
    };
  } catch (error) {
    console.error('❌ Error verificando órdenes del cliente:', error);
    return { 
      hasOrders: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


async function processAutoResponse(messageText: string, phoneNumber: string, storeId: number, tenantStorage: any) {
  try {
    console.log(`🤖 PROCESSING AUTO-RESPONSE - Store ID: ${storeId}, Message: "${messageText}"`);

    // ✅ VERIFICACIÓN ADICIONAL: Asegurar que no hay flujo activo
    const activeFlow = await tenantStorage.getRegistrationFlowByPhoneNumber(phoneNumber);
    if (activeFlow && !activeFlow.isCompleted && (!activeFlow.expiresAt || new Date() <= activeFlow.expiresAt)) {
      console.log(`⚠️ ACTIVE FLOW DETECTED IN processAutoResponse - Should not reach here`);
      return; // No procesar auto-respuesta si hay flujo activo
    }

    const messageTextLower = messageText.toLowerCase();

    // Verificar órdenes pendientes del cliente - ✅ CORRECCIÓN
    const customer = await tenantStorage.getCustomerByPhone(phoneNumber);
    if (customer) {
      // ✅ Usar getAllOrders y filtrar por customerId
      const allOrders = await tenantStorage.getAllOrders();
      const customerOrders = allOrders.filter(order => order.customerId === customer.id);
      const pendingOrders = customerOrders.filter(order => 
        order.status === 'pending' || order.status === 'created'
      );

      if (pendingOrders.length > 0) {
        console.log(`📦 PENDING ORDERS FOUND: ${pendingOrders.length}`);
        
        // Mostrar información sobre órdenes pendientes
        let pendingMessage = `🔔 **Tienes ${pendingOrders.length} pedido(s) en proceso:**\n\n`;
        
        for (const order of pendingOrders.slice(0, 3)) { // Mostrar máximo 3
          pendingMessage += `📦 Orden #${order.orderNumber || order.id}\n`;
          pendingMessage += `💰 Total: $${order.totalAmount}\n`;
          pendingMessage += `📅 Fecha: ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}\n\n`;
        }
        
        pendingMessage += `¿Qué deseas hacer?\n\n`;
        pendingMessage += `🔍 **"Seguimiento"** - Ver estado del pedido\n`;
        pendingMessage += `📞 **"Contactar"** - Hablar con un agente\n`;
        pendingMessage += `🛒 **"Nuevo pedido"** - Realizar nueva compra`;

        await sendWhatsAppMessageDirect(phoneNumber, pendingMessage, storeId);
        return;
      }
    }

    // Procesar auto-respuestas normales (menú, catálogo, etc.)
    const responses = await tenantStorage.getAllAutoResponses();
    let matchedResponse = null;

    // Buscar respuesta exacta por trigger
    for (const response of responses) {
      if (response.isActive && response.trigger && 
          messageTextLower.includes(response.trigger.toLowerCase())) {
        matchedResponse = response;
        break;
      }
    }

    // Si no hay coincidencia exacta, usar respuesta de bienvenida por defecto
    if (!matchedResponse) {
      matchedResponse = responses.find(r => r.trigger === 'welcome' && r.isActive);
    }

    if (matchedResponse) {
      console.log(`✅ MATCHED AUTO-RESPONSE: ${matchedResponse.name}`);
      await sendAutoResponseMessage(phoneNumber, matchedResponse.trigger, storeId, tenantStorage);
    } else {
      console.log(`❌ NO AUTO-RESPONSE MATCHED`);
      await sendWhatsAppMessageDirect(
        phoneNumber,
        "Hola! ¿En qué puedo ayudarte hoy?",
        storeId
      );
    }

  } catch (error) {
    console.error('❌ ERROR in processAutoResponse:', error);
  }
}

async function sendWhatsAppMessage(phoneNumber: string, message: string, config: any): Promise<boolean> {
  try {
    console.log(`📤 SENDING WHATSAPP MESSAGE - To: ${phoneNumber}`);

    // 🔧 SOLUCIÓN: Obtener token fresco directamente de la DB
    const { getMasterStorage } = await import('./storage/index.js');
    const storage = getMasterStorage();
    
    // Usar storeId del config, o el store conocido como fallback
    const storeId = config.storeId || 6;
    const freshConfig = await storage.getWhatsAppConfig(storeId);
    
    if (!freshConfig) {
      console.error('❌ NO FRESH CONFIG FOUND');
      return false;
    }

    const url = `https://graph.facebook.com/v22.0/${freshConfig.phoneNumberId}/messages`;
    
    const data = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      text: { body: message }
    };

    console.log('🔧 USING FRESH TOKEN FROM DB');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${freshConfig.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ WHATSAPP API ERROR:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ MESSAGE SENT SUCCESSFULLY:', result);
    return true;
    
  } catch (error) {
    console.error('❌ ERROR SENDING WHATSAPP MESSAGE:', error);
    return false;
  }
}

export async function debugRegistrationFlow(phoneNumber: string, storeId: number) {
  try {
    console.log(`\n🔍 ===== DEBUG REGISTRATION FLOW =====`);
    console.log(`📞 Phone: ${phoneNumber}`);
    console.log(`🏪 Store: ${storeId}`);
    
    // ✅ CORRECCIÓN: Agregar await
    const tenantStorage = await createTenantStorageForStore(storeId);
    
    // 1. Verificar cliente
    const customer = await tenantStorage.getCustomerByPhone(phoneNumber);
    console.log(`👤 Customer:`, customer ? {
      id: customer.id,
      name: customer.name,
      phone: customer.phone
    } : 'NOT FOUND');
    
    // 2. Verificar flujo de registro
    const flow = await tenantStorage.getRegistrationFlowByPhoneNumber(phoneNumber);
    console.log(`🔄 Registration Flow:`, flow ? {
      id: flow.id,
      customerId: flow.customerId,
      currentStep: flow.currentStep,
      isCompleted: flow.isCompleted,
      orderId: flow.orderId,
      expiresAt: flow.expiresAt,
      hasExpired: flow.expiresAt ? new Date() > flow.expiresAt : false,
      collectedData: flow.collectedData
    } : 'NOT FOUND');
    
    // 3. Verificar órdenes - ✅ CORRECCIÓN: usar getAllOrders y filtrar
    if (customer) {
      const allOrders = await tenantStorage.getAllOrders();
      const customerOrders = allOrders.filter(order => order.customerId === customer.id);
      
      console.log(`📦 Orders:`, customerOrders.length);
      customerOrders.forEach(order => {
        console.log(`   - Order ${order.id}: Status ${order.status}, Total $${order.totalAmount}`);
      });
    }
    
    // 4. Verificar auto-respuestas
    const autoResponses = await tenantStorage.getAllAutoResponses();
    console.log(`🤖 Auto-responses:`, autoResponses.length);
    autoResponses.forEach(resp => {
      console.log(`   - ${resp.trigger}: ${resp.name} (Active: ${resp.isActive})`);
    });
    
    console.log(`✅ DEBUG COMPLETED`);
    
  } catch (error) {
    console.error('❌ ERROR in debugRegistrationFlow:', error);
  }
}


// ======================================
// FUNCIÓN COMPLETA: processConfiguredAutoResponse
// ======================================

async function processConfiguredAutoResponse(messageText: string, from: string, customer: any, tenantStorage: any, storeMapping: any) {
 console.log(`🎯 PROCESSING CONFIGURED AUTO-RESPONSE - Store ${storeMapping.storeId}`);
  console.log(`📝 MESSAGE TEXT: "${messageText}"`);
  console.log(`📝 MESSAGE LENGTH: ${messageText.length}`);
  console.log(`📝 FIRST 100 CHARS: "${messageText.substring(0, 100)}"`);
  
  // ✅ NUEVO: VERIFICAR SI ES UN PEDIDO PRIMERO
  const isOrder = await isOrderMessage(messageText);
  console.log(`🛍️ IS ORDER MESSAGE: ${isOrder}`);
  if (isOrder) {
    console.log(`🛍️ ORDER DETECTED - Processing catalog order`);
    console.log(`📋 CALLING processWebCatalogOrderSimple...`);
    try {
    await processWebCatalogOrderSimple(
      customer, 
      from, 
      messageText, 
      storeMapping.storeId, 
      storeMapping.phoneNumberId, 
      tenantStorage
    );
    console.log(`✅ processWebCatalogOrderSimple COMPLETED`);
     } catch (orderError) {
      console.error(`❌ ERROR IN processWebCatalogOrderSimple:`, orderError);
    }
    return; // ✅ IMPORTANTE: Salir aquí para no procesar auto-respuestas
     } else {
    console.log(`❌ NOT AN ORDER - Processing as regular message`);
    }

  // CRITICAL: Use only tenant schema for store-specific auto-responses
  let autoResponse = null;
  const messageTextLower = messageText.toLowerCase().trim();
  
  // Get auto-responses ONLY from tenant schema (store-specific)
  const autoResponses = await tenantStorage.getAllAutoResponses();
  console.log(`🔍 STORE-SPECIFIC AUTO-RESPONSE VALIDATION - Store ${storeMapping.storeId}: Found ${autoResponses.length} tenant auto-responses`);

  if (!autoResponses || autoResponses.length === 0) {
    console.log(`❌ NO AUTO-RESPONSES CONFIGURED - Store ${storeMapping.storeId}: No responses found in tenant database`);
    return;
  }

  // 1. Buscar respuesta específica por trigger
  autoResponse = autoResponses.find((resp: any) => {
    if (!resp.isActive) return false;
    
    const triggers = resp.triggers ? 
      (typeof resp.triggers === 'string' ? JSON.parse(resp.triggers) : resp.triggers) : 
      [resp.trigger];
    
    return triggers.some((trigger: string) => 
      messageTextLower.includes(trigger.toLowerCase())
    );
  });

  // 2. Si no encuentra respuesta específica, usar respuesta de bienvenida
  if (!autoResponse) {
    console.log(`🔄 NO SPECIFIC MATCH - Using default welcome auto-response`);
    autoResponse = autoResponses.find((resp: any) => 
      resp.isActive && (resp.trigger === 'welcome' || resp.name?.includes('Bienvenida'))
    );
  }

  if (!autoResponse) {
    console.log(`❌ NO WELCOME RESPONSE FOUND - Store ${storeMapping.storeId}: No welcome response configured`);
    return;
  }

  console.log(`✅ AUTO-RESPONSE FOUND - Store ${storeMapping.storeId}: "${autoResponse.name}" (ID: ${autoResponse.id})`);

  try {
    // ✅ CORRECCIÓN: Obtener configuración de WhatsApp desde MASTER STORAGE
    const { getMasterStorage } = await import('./storage/index.js');
    const storage = getMasterStorage();
    const globalConfig = await storage.getWhatsAppConfig(storeMapping.storeId); // ✅ Pass storeId parameter
    
    if (!globalConfig || !globalConfig.accessToken || !globalConfig.phoneNumberId) {
        console.log(`❌ WHATSAPP CONFIG INCOMPLETE - Store ${storeMapping.storeId}: Missing access token or phone number ID`);
        return;
    }

    console.log(`✅ WHATSAPP CONFIG FOUND - Store ${storeMapping.storeId}: phoneNumberId ${globalConfig.phoneNumberId}`);

    const finalConfig = {
      accessToken: globalConfig.accessToken,
      phoneNumberId: globalConfig.phoneNumberId
    };

    console.log(`✅ GLOBAL WHATSAPP CONFIG LOADED - Store ${storeMapping.storeId}: phoneNumberId ${finalConfig.phoneNumberId}`);

    // Prepare message text
    let messageText = autoResponse.messageText;
    
    // Replace store name placeholder
    if (messageText.includes('{storeName}')) {
      messageText = messageText.replace(/{storeName}/g, storeMapping.storeName);
    }

    console.log(`📝 USING CONFIGURED MESSAGE: "${messageText.substring(0, 50)}..."`);

    // Check if response has interactive buttons
    let menuOptions = null;
    try {
      if (autoResponse.menuOptions && typeof autoResponse.menuOptions === 'string') {
        menuOptions = JSON.parse(autoResponse.menuOptions);
      } else if (autoResponse.menuOptions) {
        menuOptions = autoResponse.menuOptions;
      }
    } catch (parseError) {
      console.log(`⚠️ INVALID MENU OPTIONS JSON - Store ${storeMapping.storeId}: ${parseError}`);
    }

    if (menuOptions && Array.isArray(menuOptions) && menuOptions.length > 0) {
      console.log(`🔘 INTERACTIVE BUTTONS DETECTED - Store ${storeMapping.storeId}: ${menuOptions.length} buttons configured`);
      
      // Send interactive message with buttons
      console.log(`📤 SENDING INTERACTIVE MESSAGE - Store ${storeMapping.storeId}: ${menuOptions.length} buttons`);
      await sendInteractiveMessage(from, messageText, menuOptions, finalConfig);
    } else {
      // Send regular text message
      console.log(`📤 SENDING MESSAGE WITH GLOBAL CONFIG - Store ${storeMapping.storeId} phoneNumberId: ${finalConfig.phoneNumberId}`);
      await sendWhatsAppMessage(from, messageText, finalConfig);
    }

    // Check for button interactions in the incoming message
    await checkButtonInteractions(messageText, from, customer, tenantStorage, storeMapping, autoResponses);

    // Execute next action if configured
    if (autoResponse.nextAction) {
      await executeNextAction(autoResponse, customer, tenantStorage, storeMapping.storeId);
    }

  } catch (error: any) {
    console.error(`❌ ERROR IN AUTO-RESPONSE - Store ${storeMapping.storeId}:`, error);
    
    const masterStorage = getMasterStorage();
    await masterStorage.addWhatsAppLog({
      type: 'error',
      phoneNumber: from,
      messageContent: `Error procesando auto-respuesta para tienda ${storeMapping.storeId}`,
      status: 'error',
      errorMessage: error.message || 'Unknown error',
      rawData: JSON.stringify({ messageText, error: error instanceof Error ? error.stack : error })
    });
    
    throw error;
  }
}


// ======================================
// FUNCIÓN AUXILIAR: s   endWhatsAppMessageDirect
// ======================================


async function handleRegistrationFlow(
  customer: any,
  messageText: string,
  messageData: any,
  registrationFlow: any,
  storeId: number,
  tenantStorage: any
): Promise<void> {
  try {
    const currentStep = registrationFlow.currentStep;
    
    console.log(`🔄 HANDLING REGISTRATION STEP: ${currentStep}`);
    console.log(`📋 Message received: "${messageText}"`);
    console.log(`👤 Customer: ${customer.id} - ${customer.name}`);

    // Manejo seguro de collectedData
    let collectedData: any = {};
    try {
      if (registrationFlow.collectedData) {
        if (typeof registrationFlow.collectedData === 'string') {
          collectedData = JSON.parse(registrationFlow.collectedData);
        } else {
          collectedData = registrationFlow.collectedData;
        }
      }
    } catch (parseError) {
      console.log(`⚠️ Invalid JSON in collectedData, starting fresh`);
      collectedData = {};
    }

    switch (currentStep) {
      case 'collect_name':
        console.log(`📝 PROCESSING NAME COLLECTION`);
        
        // ✅ VALIDACIÓN MEJORADA DE NOMBRE
        const cleanName = messageText.trim();
        
        // Verificar longitud mínima
        if (cleanName.length < 2) {
          await sendWhatsAppMessageDirect(
            customer.phone,
            "❌ Por favor ingresa un nombre de al menos 2 caracteres:",
            storeId
          );
          return;
        }

        // Verificar longitud máxima
        if (cleanName.length > 50) {
          await sendWhatsAppMessageDirect(
            customer.phone,
            "❌ El nombre es muy largo. Por favor ingresa un nombre más corto:",
            storeId
          );
          return;
        }

        // Verificar que contenga solo letras, espacios y caracteres especiales del español
        const namePattern = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s'-]+$/;
        if (!namePattern.test(cleanName)) {
          await sendWhatsAppMessageDirect(
            customer.phone,
            "❌ Por favor ingresa un nombre válido (solo letras y espacios):",
            storeId
          );
          return;
        }

        console.log(`✅ NAME VALIDATION PASSED: "${cleanName}"`);

        // ✅ ACTUALIZAR DATOS DEL CLIENTE
        try {
          await tenantStorage.updateCustomer(customer.id, { 
            name: cleanName 
          });
          console.log(`✅ CUSTOMER NAME UPDATED: ${customer.id} -> "${cleanName}"`);
        } catch (updateError) {
          console.error(`❌ ERROR UPDATING CUSTOMER NAME:`, updateError);
        }

        // ✅ ACTUALIZAR DATOS RECOPILADOS
        collectedData.customerName = cleanName;

        // ✅ ACTUALIZAR FLUJO AL SIGUIENTE PASO
        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'collect_contact',
          collectedData: JSON.stringify(collectedData),
          updatedAt: new Date()
        });

        console.log(`✅ FLOW UPDATED TO NEXT STEP: collect_contact`);

        // ✅ ENVIAR SIGUIENTE MENSAJE (COLLECT_CONTACT)
        await sendAutoResponseMessage(customer.phone, 'collect_contact', storeId, tenantStorage);
        
        console.log(`✅ NAME COLLECTION COMPLETED SUCCESSFULLY`);
        break;

      case 'collect_contact':
        // Procesar número de contacto
        console.log(`📞 PROCESSING CONTACT COLLECTION`);
        
        // Verificar si quiere usar el mismo número o proporcionar otro
        const contactLower = messageText.toLowerCase();
        
        if (contactLower.includes('mismo') || 
            contactLower.includes('este') || 
            contactLower.includes('sí') ||
            contactLower.includes('si') ||
            contactLower.includes('yes') ||
            contactLower.includes('ok')) {
          
          collectedData.contactNumber = customer.phone;
          collectedData.useWhatsAppNumber = true;
          
        } else {
          // Validar número de teléfono proporcionado
          const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
          const cleanPhone = messageText.replace(/[\s\-\(\)]/g, '');
          
          if (phonePattern.test(cleanPhone)) {
            collectedData.contactNumber = cleanPhone;
            collectedData.useWhatsAppNumber = false;
          } else {
            await sendWhatsAppMessageDirect(
              customer.phone,
              "❌ Por favor ingresa un número de teléfono válido o responde 'mismo' para usar este número:",
              storeId
            );
            return;
          }
        }

        // Continuar al siguiente paso
        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'collect_address',
          collectedData: JSON.stringify(collectedData),
          updatedAt: new Date()
        });

        await sendAutoResponseMessage(customer.phone, 'collect_address', storeId, tenantStorage);
        break;

      case 'collect_address':
        // Procesar dirección
        console.log(`📍 PROCESSING ADDRESS COLLECTION`);
        
        if (messageText.trim().length < 10) {
          await sendWhatsAppMessageDirect(
            customer.phone,
            "❌ Por favor proporciona una dirección más detallada (incluye calle, número, sector):",
            storeId
          );
          return;
        }

        collectedData.address = messageText.trim();

        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'collect_payment',
          collectedData: JSON.stringify(collectedData),
          updatedAt: new Date()
        });

        await sendAutoResponseMessage(customer.phone, 'collect_payment', storeId, tenantStorage);
        break;

      case 'collect_payment':
        // Procesar método de pago
        console.log(`💳 PROCESSING PAYMENT METHOD COLLECTION`);
        
        const paymentLower = messageText.toLowerCase();
        let paymentMethod = '';
        
        if (paymentLower.includes('tarjeta') || paymentLower.includes('card')) {
          paymentMethod = 'Tarjeta de Crédito/Débito';
        } else if (paymentLower.includes('transferencia') || paymentLower.includes('transfer')) {
          paymentMethod = 'Transferencia Bancaria';
        } else if (paymentLower.includes('efectivo') || paymentLower.includes('cash')) {
          paymentMethod = 'Efectivo (Contra Entrega)';
        } else {
          paymentMethod = messageText.trim();
        }

        collectedData.paymentMethod = paymentMethod;

        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'collect_notes',
          collectedData: JSON.stringify(collectedData),
          updatedAt: new Date()
        });

        await sendAutoResponseMessage(customer.phone, 'collect_notes', storeId, tenantStorage);
        break;

      case 'collect_notes':
        // Procesar notas adicionales
        console.log(`📝 PROCESSING NOTES COLLECTION`);
        
        const notesLower = messageText.toLowerCase();
        
        if (notesLower.includes('continuar') || 
            notesLower.includes('no_notes') ||
            notesLower.includes('sin notas') ||
            notesLower.includes('ninguna')) {
          collectedData.notes = 'Sin notas adicionales';
        } else {
          collectedData.notes = messageText.trim();
        }

        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'confirm_order',
          collectedData: JSON.stringify(collectedData),
          updatedAt: new Date()
        });

        // Generar y enviar confirmación
        await generateAndSendOrderConfirmation(customer, registrationFlow, collectedData, storeId, tenantStorage);
        break;

      case 'confirm_order':
        // Procesar confirmación final
        console.log(`✅ PROCESSING ORDER CONFIRMATION`);
        
        const confirmLower = messageText.toLowerCase();
        
        if (confirmLower.includes('confirmar') || 
            confirmLower.includes('sí') ||
            confirmLower.includes('si') ||
            confirmLower.includes('confirm') ||
            confirmLower.includes('yes') ||
            confirmLower.includes('proceder')) {
          
          await completeOrderRegistration(customer, registrationFlow, collectedData, storeId, tenantStorage);
          
        } else if (confirmLower.includes('modificar') || confirmLower.includes('cambiar') ||
                  confirmLower.includes('editar')) {
          
          await sendWhatsAppMessageDirect(
            customer.phone,
            "✏️ ¿Qué deseas modificar?\n\n1️⃣ Nombre\n2️⃣ Dirección\n3️⃣ Contacto\n4️⃣ Método de pago\n5️⃣ Notas",
            storeId
          );
          
        } else {
          // Volver a enviar confirmación
          await generateAndSendOrderConfirmation(customer, registrationFlow, collectedData, storeId, tenantStorage);
        }
        break;

      default:
        console.log(`⚠️ UNKNOWN REGISTRATION STEP: ${currentStep}`);
        // Reiniciar flujo
        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'collect_name',
          collectedData: JSON.stringify({}),
          updatedAt: new Date()
        });
        await sendAutoResponseMessage(customer.phone, 'collect_name', storeId, tenantStorage);
        break;
    }
    
  } catch (error) {
    console.error('❌ ERROR IN handleRegistrationFlow:', error);
    
    await sendWhatsAppMessageDirect(
      customer.phone,
      "❌ Ocurrió un error procesando tu información. Un agente te contactará pronto para completar tu pedido.",
      storeId
    );
  }
}


async function generateAndSendOrderConfirmation(
  customer: any, 
  registrationFlow: any, 
  collectedData: any, 
  storeId: number, 
  tenantStorage: any
) {
  try {
    console.log(`📋 GENERATING ORDER CONFIRMATION for customer ${customer.id}`);
    
    let orderDetails = '';
    let totalAmount = '0.00';
    let displayOrderNumber = '';
    
    // Obtener detalles del pedido
    if (registrationFlow.orderId) {
      const order = await tenantStorage.getOrderById(registrationFlow.orderId);
      const orderItems = await tenantStorage.getOrderItemsByOrderId(registrationFlow.orderId);
      
      if (order && orderItems.length > 0) {
        displayOrderNumber = `#${order.orderNumber || order.id}`;
        totalAmount = order.totalAmount || '0.00';
        
        for (const item of orderItems) {
          const product = await tenantStorage.getProductById(item.productId);
          const productName = product?.name || 'Producto';
          orderDetails += `• ${productName} x${item.quantity} - $${item.totalPrice}\n`;
        }
      }
    }
    
    if (!orderDetails) {
      orderDetails = '• Consulta de servicios\n';
    }

    // Generar mensaje de confirmación
    const confirmationMessage = `📋 *CONFIRMACIÓN DE PEDIDO* ${displayOrderNumber}

👤 *Datos del Cliente:*
• Nombre: ${collectedData.customerName || 'No especificado'}
• Teléfono: ${collectedData.contactNumber || customer.phone}
• Dirección: ${collectedData.address || 'No especificada'}

📦 *Productos/Servicios:*
${orderDetails}

💳 *Método de Pago:*
${collectedData.paymentMethod || 'No especificado'}

📝 *Notas:*
${collectedData.notes || 'Sin notas'}

💰 *Total: $${totalAmount}*

✅ ¿Confirmas que todos los datos son correctos?

Responde:
• *"Confirmar"* para proceder
• *"Modificar"* para cambiar algo`;

    await sendWhatsAppMessageDirect(customer.phone, confirmationMessage, storeId);

  } catch (error) {
    console.error('❌ ERROR generating order confirmation:', error);
    
    // Mensaje de respaldo
    await sendWhatsAppMessageDirect(
      customer.phone,
      `📋 *CONFIRMACIÓN DE PEDIDO*

Datos recopilados:
• Nombre: ${collectedData.customerName || 'No especificado'}
• Dirección: ${collectedData.address || 'No especificada'}
• Contacto: ${collectedData.contactNumber || customer.phone}
• Pago: ${collectedData.paymentMethod || 'No especificado'}

✅ ¿Todo correcto? Responde "Confirmar" para proceder`,
      storeId
    );
  }
}

// 🔧 CORRECCIÓN 4: Nueva función para completar registro
async function completeOrderRegistration(
  customer: any, 
  registrationFlow: any, 
  collectedData: any, 
  storeId: number, 
  tenantStorage: any
) {
  try {
    console.log(`✅ COMPLETING ORDER REGISTRATION for customer ${customer.id}`);
    
    // Actualizar datos del cliente
    await tenantStorage.updateCustomer(customer.id, {
      name: collectedData.customerName || customer.name,
      address: collectedData.address,
      notes: collectedData.notes
    });
    
    // Actualizar pedido si existe
    if (registrationFlow.orderId) {
      await tenantStorage.updateOrder(registrationFlow.orderId, {
        status: 'confirmed',
        paymentMethod: collectedData.paymentMethod,
        deliveryAddress: collectedData.address,
        notes: collectedData.notes,
        contactNumber: collectedData.contactNumber
      });
    }
    
    // Marcar flujo como completado
    await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
      currentStep: 'completed',
      isCompleted: true,
      completedAt: new Date(),
      collectedData: JSON.stringify(collectedData),
      updatedAt: new Date()
    });
    
    // Enviar confirmación final
    const finalMessage = `🎉 *¡PEDIDO CONFIRMADO!*

Gracias ${collectedData.customerName}. Tu pedido ha sido registrado exitosamente.

📞 Te contactaremos pronto al ${collectedData.contactNumber || customer.phone} para coordinar la entrega.

⏰ Tiempo estimado: 24-48 horas

¿Necesitas algo más?`;

    await sendWhatsAppMessageDirect(customer.phone, finalMessage, storeId);
    
    console.log(`✅ ORDER REGISTRATION COMPLETED - Customer: ${customer.id}, Order: ${registrationFlow.orderId}`);
    
  } catch (error) {
    console.error('❌ ERROR completing order registration:', error);
    
    await sendWhatsAppMessageDirect(
      customer.phone,
      "✅ Tu pedido ha sido registrado. Un agente te contactará pronto para confirmar los detalles.",
      storeId
    );
  }
}


async function finalizeOrderWithData(
  orderId: number,
  collectedData: any,
  customer: any,
  storeId: number,
  tenantStorage: any
): Promise<void> {
  try {
    console.log(`🎯 FINALIZING ORDER ${orderId} WITH COLLECTED DATA`);
    
    // 1. Obtener la orden antes de actualizar para tener el orderNumber
    const currentOrder = await tenantStorage.getOrderById(orderId);
    const orderNumber = currentOrder?.orderNumber || `ORD-${orderId}`;
    
    console.log(`📋 Order details: ID ${orderId}, Number: ${orderNumber}`);
    
    const orderUpdates = {
      status: 'confirmed',
      notes: `Datos del cliente:\n• Contacto: ${collectedData.contactNumber}\n• Dirección: ${collectedData.address}\n• Pago: ${collectedData.paymentMethod}\n• Notas adicionales: ${collectedData.notes}`,
      updatedAt: new Date()
    };
    
    await tenantStorage.updateOrder(orderId, orderUpdates);
    
    // 2. Actualizar datos del cliente
    const customerUpdates = {
      name: collectedData.customerName || customer.name,
      address: collectedData.address || customer.address,
      phone: collectedData.contactNumber || customer.phone,
      lastContact: new Date()
    };
    
    await tenantStorage.updateCustomer(customer.id, customerUpdates);
    
    // 3. Obtener orden actualizada para mensaje final
    const finalOrder = await tenantStorage.getOrderById(orderId);
    const orderItems = await tenantStorage.getOrderItemsByOrderId(orderId);
    
    // ✅ CORRECCIÓN: Generar texto de productos con nombres completos
    let orderItemsText = '';
    if (orderItems && orderItems.length > 0) {
      const productTexts = [];
      
      for (const item of orderItems) {
        // ✅ CORRECCIÓN MEJORADA: Resolución robusta de nombres de productos
        let itemName = null;
        
        console.log(`🔍 RESOLVING PRODUCT NAME FOR FINAL MESSAGE - ITEM:`, JSON.stringify(item, null, 2));
        
        // Paso 1: Intentar obtener de los campos del item
        itemName = item.productName || item.name || item.title;
        console.log(`📝 Final Step 1 - From item fields: "${itemName}"`);
        
        // Paso 2: Si no existe o es genérico, buscar en la tabla de productos
        if (!itemName || itemName === 'Producto' || itemName === 'Nombre del Producto' || itemName.trim() === '') {
          try {
            if (item.productId) {
              console.log(`🔍 Final Step 2 - Searching product by ID: ${item.productId}`);
              const product = await tenantStorage.getProductById(item.productId);
              console.log(`📦 Final Product found:`, JSON.stringify(product, null, 2));
              
              if (product) {
                // Probar diferentes campos del producto
                itemName = product.name || product.title || product.productName || product.displayName;
                console.log(`✅ Final Step 2 - Resolved from product table: "${itemName}"`);
              }
            }
          } catch (productError) {
            console.log(`⚠️ Final Error obteniendo producto ${item.productId}:`, productError);
          }
        }
        
        // Paso 3: Fallback descriptivo si aún no se resuelve
        if (!itemName || itemName === 'Producto' || itemName === 'Nombre del Producto' || itemName.trim() === '') {
          itemName = `Producto ID-${item.productId || item.id || 'N/A'}`;
          console.log(`🔄 Final Step 3 - Using fallback: "${itemName}"`);
        }
        
        console.log(`🎯 FINAL RESOLVED NAME FOR MESSAGE: "${itemName}"`);
        
        const quantity = item.quantity || 1;
        productTexts.push(`• ${itemName} (Cantidad: ${quantity})`);
      }
      
      orderItemsText = productTexts.join('\n');
    } else {
      orderItemsText = '• No se pudieron cargar los detalles de productos';
    }
    
    console.log(`📦 FINAL ORDER ITEMS TEXT:`, orderItemsText);
    
    const displayOrderNumber = finalOrder?.orderNumber || orderNumber;
    
    const finalMessage = `🎉 *¡PEDIDO CONFIRMADO!*

✅ Tu pedido **${displayOrderNumber}** ha sido registrado exitosamente.

📋 *Detalles Finales:*
• Cliente: ${collectedData.customerName || customer.name}
• Contacto: ${collectedData.contactNumber || customer.phone}
• Dirección: ${collectedData.address || 'No especificada'}
• Pago: ${collectedData.paymentMethod || 'No especificado'}
• Total: $${parseFloat(finalOrder?.totalAmount || '0').toLocaleString('es-DO', { minimumFractionDigits: 2 })}
• Estado: Confirmado
• Notas: ${collectedData.notes || 'Sin notas adicionales'}

📦 *Productos:*
${orderItemsText}

📞 **Próximos pasos:**
Nuestro equipo se pondrá en contacto contigo en las próximas 2 horas para:
• Confirmar disponibilidad
• Coordinar fecha y hora de entrega
• Procesar el pago

📱 **Contacto directo:** +1 809-357-6939

¡Gracias por confiar en MAS QUE SALUD! 🙏`;

    await sendWhatsAppMessageDirect(customer.phone, finalMessage, storeId);
    
    // 5. Log del éxito
    const storageFactory = await import('./storage/storage-factory.js');
    const masterStorage = storageFactory.StorageFactory.getInstance().getMasterStorage();
    await masterStorage.addWhatsAppLog({
      type: 'success',
      phoneNumber: customer.phone,
      messageContent: `Pedido ${displayOrderNumber} (ID: ${orderId}) finalizado exitosamente con datos completos.`,
      status: 'completed',
      storeId: storeId,
      rawData: JSON.stringify({ 
        orderId, 
        orderNumber: displayOrderNumber,
        collectedData, 
        finalOrder,
        resolvedProductNames: orderItemsText
      })
    });
    
    console.log(`✅ ORDER ${displayOrderNumber} (ID: ${orderId}) FINALIZED SUCCESSFULLY WITH COMPLETE DATA`);
    
  } catch (error) {
    console.error(`❌ ERROR FINALIZING ORDER ${orderId}:`, error);
    
    let orderReference = `ID ${orderId}`;
    try {
      const errorOrder = await tenantStorage.getOrderById(orderId);
      if (errorOrder?.orderNumber) {
        orderReference = errorOrder.orderNumber;
      }
    } catch (getOrderError) {
      console.log(`⚠️ Could not get order number for error message`);
    }
    
    await sendWhatsAppMessageDirect(
      customer.phone,
      `❌ Ha ocurrido un error al procesar tu pedido ${orderReference}. Nuestro equipo te contactará pronto para resolverlo. 📞 +1 809-357-6939`,
      storeId
    );
    
    const storageFactory = await import('./storage/storage-factory.js');
    const masterStorage = storageFactory.StorageFactory.getInstance().getMasterStorage();
    await masterStorage.addWhatsAppLog({
      type: 'error',
      phoneNumber: customer.phone,
      messageContent: `Error finalizando pedido ${orderReference} (ID: ${orderId})`,
      status: 'error',
      storeId: storeId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      rawData: JSON.stringify({ 
        orderId, 
        orderReference,
        collectedData,
        error: error instanceof Error ? error.stack : error 
      })
    });
  }
}

export async function safeWhatsAppLog(
  logData: {
    type: string;
    phoneNumber: string;
    messageContent?: string;
    messageId?: string;
    status?: string;
    errorMessage?: string;
    rawData?: string;
    storeId?: number;
  }
): Promise<void> {
  try {
    // 🔍 VALIDAR store_id antes de insertar
    const { getMasterStorage } = await import('./storage/index.js');
    const masterStorage = getMasterStorage();
    
    let validStoreId = logData.storeId || 0;
    
    // ✅ Si storeId es 0 o inválido, buscar un store válido
    if (validStoreId === 0 || !validStoreId) {
      try {
        const stores = await masterStorage.getAllVirtualStores();
        if (stores.length > 0) {
          validStoreId = stores[0].id; // Usar el primer store disponible
          console.log(`🔄 Using fallback store ID: ${validStoreId}`);
        } else {
          console.warn('⚠️ No virtual stores found, skipping log');
          return; // No hacer log si no hay stores
        }
      } catch (storeError) {
        console.warn('⚠️ Cannot validate store, skipping log:', storeError);
        return;
      }
    }

    // ✅ INTENTAR INSERTAR LOG con storeId válido
    await masterStorage.addWhatsAppLog({
      ...logData,
      storeId: validStoreId
    });

    console.log(`✅ WhatsApp log saved successfully with store ID: ${validStoreId}`);

  } catch (error: any) {
    // 🚨 Si falla el logging, no fallar el proceso principal
    console.warn('⚠️ Failed to save WhatsApp log (non-critical):', {
      error: error.message,
      code: error.code,
      originalData: logData
    });
    
    // 📝 Log básico en consola como fallback
    console.log(`📋 FALLBACK LOG: ${logData.type} - ${logData.phoneNumber} - ${logData.messageContent}`);
  }
}



/**
 * 🔄 VERSIÓN RESILIENTE del manejo de flujo de registro
 */



/**
 * 🎯 Verifica si un mensaje coincide con una auto-respuesta
 */
function matchesAutoResponse(messageText: string, autoResponse: any): boolean {
  const text = messageText.toLowerCase().trim();
  const trigger = autoResponse.trigger?.toLowerCase();
  const triggerText = autoResponse.triggerText?.toLowerCase();
  
  // Coincidencia por trigger
  if (trigger && text.includes(trigger)) {
    return true;
  }
  
  // Coincidencia por trigger text
  if (triggerText && text.includes(triggerText)) {
    return true;
  }
  
  // Triggers especiales
  if (trigger === 'welcome' && (text === 'hola' || text === 'hello' || text === 'hi')) {
    return true;
  }
  
  if (trigger === 'menu' && (text === 'menu' || text === 'menú' || text === 'opciones')) {
    return true;
  }
  
  return false;
}

/**
 * 📤 VERSIÓN RESILIENTE del envío de auto-respuestas
 */
async function sendAutoResponseResilient(
  phoneNumber: string, 
  autoResponse: any, 
  storeMapping: any
): Promise<void> {
  try {
    console.log(`📤 Sending auto-response: ${autoResponse.name} to ${phoneNumber}`);
    
    if (autoResponse.isInteractive && autoResponse.interactiveData) {
      // Mensaje interactivo
      await sendInteractiveMessageResilient(
        phoneNumber, 
        autoResponse.messageText || autoResponse.message,
        autoResponse.interactiveData.buttons || [],
        storeMapping
      );
    } else {
      // Mensaje simple
      await sendWhatsAppMessageResilient(
        phoneNumber,
        autoResponse.messageText || autoResponse.message,
        storeMapping
      );
    }
    
    console.log(`✅ Auto-response sent: ${autoResponse.name}`);
    
  } catch (error) {
    console.error(`❌ Error sending auto-response ${autoResponse.name}:`, error);
    throw error;
  }
}

async function handleRegistrationFlowResilient(
  customer: any,
  messageText: string,
  message: any,
  registrationFlow: any,
  storeId: number,
  tenantStorage: any
): Promise<void> {
  try {
    console.log(`🔄 Processing registration flow step: ${registrationFlow.currentStep}`);
    
    // ✅ USAR DIRECTAMENTE tu función existente handleRegistrationFlow
    // Esta función SÍ EXISTE en tu whatsapp-simple.ts (línea aproximada 2800+)
    await handleRegistrationFlow(
      customer,
      messageText,
      message,
      registrationFlow,
      storeId,
      tenantStorage
    );
    
    console.log(`✅ Registration flow step processed: ${registrationFlow.currentStep}`);
    
  } catch (error: any) {
    console.error(`❌ Error in registration flow resilient:`, error);
    
    // 🚨 Enviar mensaje de error al cliente si falla el flujo
    try {
      const success = await sendWhatsAppMessage(
        customer.phone,
        "Lo siento, hubo un problema procesando tu solicitud. Por favor intenta nuevamente o contacta a soporte.",
        { storeId }
      );
      if (!success) {
        console.error('❌ Failed to send error message to customer');
      }
    } catch (sendError) {
      console.error('❌ Error enviando mensaje de error:', sendError);
    }
    
    throw error;
  }
}

/**
 * 🤖 VERSIÓN CORREGIDA del procesamiento de auto-respuestas
 * Usa las funciones que realmente existen
 */
async function processAutoResponseResilient(
  messageText: string,
  customerPhone: string,
  storeId: number,
  tenantStorage: any,
  storeMapping: any
): Promise<void> {
  try {
    console.log(`🤖 PROCESSING AUTO-RESPONSES for message: "${messageText}"`);
    
    // 🔄 USAR TU FUNCIÓN EXISTENTE processAutoResponse
    // Esta función YA EXISTE en tu whatsapp-simple.ts
    await processAutoResponse(messageText, customerPhone, storeId, tenantStorage);
    
    console.log(`✅ Auto-response processing completed`);
    
  } catch (error: any) {
    console.error('❌ Error in processAutoResponseResilient:', error);
    throw error;
  }
}

export async function processIncomingUserMessage(webhookData: any, storeMapping: any): Promise<void> {
   try {
    console.log('📱 Processing incoming user message - FIXED VERSION');
    
    const entry = webhookData.entry?.[0];
    if (!entry) {
      throw new Error('NO ENTRY FOUND in webhook data');
    }

    const changes = entry.changes?.[0];
    if (!changes || changes.field !== 'messages') {
      throw new Error('NO MESSAGE CHANGES FOUND or field is not "messages"');
    }

    const value = changes.value;
    if (!value.metadata) {
      throw new Error('NO METADATA FOUND');
    }

    const phoneNumberId = value.metadata.phone_number_id;
    
    // 🔍 USAR FUNCIÓN SEGURA PARA ENCONTRAR STORE
    let safeStoreMapping = storeMapping;
    if (!safeStoreMapping) {
      safeStoreMapping = await findStoreByPhoneNumberSafe(phoneNumberId);
      if (!safeStoreMapping) {
        console.error(`❌ No store found for phoneNumberId: ${phoneNumberId}`);
        return;
      }
    }

    // 2️⃣ PROCESAR MENSAJES DE USUARIOS
    if (!value.messages || !Array.isArray(value.messages) || value.messages.length === 0) {
      console.log('ℹ️ NO USER MESSAGES FOUND - This was likely a status-only webhook');
      return;
    }

    const message = value.messages[0];
    const customerPhone = message.from;
       const messageId = message.id;
   const messageType = message.type || 'text';
let messageText = '';

// Extraer texto o acción según el tipo de mensaje
if (messageType === 'text') {
  messageText = message.text?.body || '';
} else if (messageType === 'interactive' && message.interactive?.button_reply) {
  // Procesar botón presionado
  const buttonId = message.interactive.button_reply.id;
  const buttonTitle = message.interactive.button_reply.title;
  
  console.log(`🔘 BUTTON PRESSED: ${buttonId} (${buttonTitle})`);
  
  // Usar el ID del botón como texto del mensaje
  messageText = buttonId;
} else {
  console.log(`ℹ️ SKIPPING UNSUPPORTED MESSAGE - Type: ${messageType}, From: ${customerPhone}`);
  return;
}

// Validar que tenemos contenido para procesar
if (!messageText || messageText.trim() === '') {
  console.log(`ℹ️ SKIPPING EMPTY MESSAGE - From: ${customerPhone}`);
  return;
}

    console.log(`📱 USER MESSAGE RECEIVED - From: ${customerPhone}, Text: "${messageText}"`);
    console.log(`✅ PROCESSING USER MESSAGE - Store: ${safeStoreMapping.storeName} (ID: ${safeStoreMapping.storeId})`);

    // 🏪 OBTENER TENANT STORAGE CON MANEJO DE ERRORES
    const { createTenantStorageForStore } = await import('./tenant-storage.js');
    const tenantStorage = await createTenantStorageForStore(safeStoreMapping.storeId);

    // 👤 PROCESAR CLIENTE CON RETRY
    let customer = await resilientDb.executeWithRetry(
      async (client) => {
        return await tenantStorage.getCustomerByPhone(customerPhone);
      },
      `get customer ${customerPhone}`
    );
    
    if (!customer) {
      console.log(`👤 CREATING NEW CUSTOMER - Phone: ${customerPhone}`);
      
      customer = await resilientDb.executeWithRetry(
        async (client) => {
          return await tenantStorage.createCustomer({
            name: `Cliente ${customerPhone.slice(-4)}`,
            phone: customerPhone,
            storeId: safeStoreMapping.storeId,
            whatsappId: customerPhone,
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
        },
        `create customer ${customerPhone}`
      );
    }

    // 📝 REGISTRAR LOG SEGURO
    await safeWhatsAppLog({
      type: 'incoming',
      phoneNumber: customerPhone,
      messageContent: messageText,
      messageId: messageId,
      status: 'received',
      rawData: JSON.stringify(webhookData),
      storeId: safeStoreMapping.storeId
    });

    // ✅ VERIFICACIÓN CRÍTICA: Flujo activo PRIMERO
    console.log(`🔍 CHECKING REGISTRATION FLOW for phone: ${customerPhone}`);
    
    const registrationFlow = await resilientDb.executeWithRetry(
      async (client) => {
        return await tenantStorage.getRegistrationFlowByPhoneNumber(customerPhone);
      },
      `get registration flow ${customerPhone}`
    );
    
    console.log(`🔍 Registration Flow Result:`, {
      exists: !!registrationFlow,
      isCompleted: registrationFlow?.isCompleted,
      currentStep: registrationFlow?.currentStep,
      isExpired: registrationFlow?.expiresAt ? new Date() > registrationFlow.expiresAt : false
    });

    // ✅ SI HAY FLUJO ACTIVO, PROCESARLO PRIMERO
    if (registrationFlow && !registrationFlow.isCompleted && 
        (!registrationFlow.expiresAt || new Date() <= registrationFlow.expiresAt)) {
      
      console.log(`🔄 CONTINUING REGISTRATION FLOW - Step: ${registrationFlow.currentStep}`);
      
      await resilientDb.executeWithRetry(
        async (client) => {
          await handleRegistrationFlow(
            customer, 
            messageText, 
            message, 
            registrationFlow, 
            safeStoreMapping.storeId, 
            tenantStorage
          );
        },
        `handle registration flow ${customerPhone}`
      );
      
      return;
    }

    // ✅ PROCESAR AUTO-RESPUESTAS
    console.log(`🤖 PROCESSING AUTO-RESPONSES`);
    
    await resilientDb.executeWithRetry(
      async (client) => {
        await processAutoResponse(
          messageText, 
          customerPhone, 
          safeStoreMapping.storeId, 
          tenantStorage
        );
      },
      `process auto-response ${customerPhone}`
    );

  } catch (error: any) {
    console.error('❌ ERROR in processIncomingUserMessageFixed:', error);
    
    // 📝 LOG SEGURO DEL ERROR
    await safeWhatsAppLog({
      type: 'error',
      phoneNumber: 'PROCESSING_ERROR',
      messageContent: `Error processing message: ${error.message}`,
      errorMessage: error.message,
      rawData: JSON.stringify({ error: error.message, webhookData }),
      storeId: 0 // Se manejará con fallback en safeWhatsAppLog
    });
    
    throw error;
  }
}

/**
 * 📊 FUNCIÓN HELPER CORREGIDA - Procesa estados de mensaje
 */
export async function processMessageStatusUpdate(status: any, storeMapping: any): Promise<void> {
  try {
    console.log(`📊 Processing status update: ${status.status} for message ${status.id}`);
    
    // Usar tu función existente con retry
    await resilientDb.executeWithRetry(
      async (client) => {
        const { createTenantStorageForStore } = await import('./tenant-storage.js');
        const tenantStorage = await createTenantStorageForStore(storeMapping.storeId);
        
        // ✅ LLAMAR A TU FUNCIÓN EXISTENTE processMessageStatus
        await processMessageStatus(status, storeMapping, tenantStorage);
      },
      `process message status ${status.id}`
    );
    
    console.log(`✅ Status update processed for message ${status.id}`);
    
  } catch (error: any) {
    console.error('❌ Error in processMessageStatusUpdate:', error);
    throw error;
  }
}
export async function processWhatsAppMessageSafe(webhookData: any): Promise<void> {
  try {
    // 🔧 APLICAR FIXES DE SCHEMA SI ES NECESARIO
    await fixDatabaseSchema();
    
    console.log('📥 Webhook recibido, procesando con manejo seguro...');
    
    // 🔍 VALIDAR ESTRUCTURA BÁSICA  
    if (!webhookData?.entry?.[0]?.changes?.[0]?.value) {
      throw new Error('Invalid webhook structure');
    }
    
    const value = webhookData.entry[0].changes[0].value;
    const phoneNumberId = value.metadata?.phone_number_id;
    
    if (!phoneNumberId) {
      throw new Error('No phone_number_id in webhook metadata');
    }
    
    // 🏪 ENCONTRAR STORE DE FORMA SEGURA
    const storeMapping = await findStoreByPhoneNumberSafe(phoneNumberId);
    
    if (!storeMapping) {
      console.error(`❌ No store found for phoneNumberId: ${phoneNumberId}`);
      return;
    }
    
    // 📊 PROCESAR SEGÚN TIPO
    if (value.messages && value.messages.length > 0) {
      await processIncomingUserMessage(webhookData, storeMapping);
    }
    
    if (value.statuses && value.statuses.length > 0) {
      for (const status of value.statuses) {
        await processMessageStatusSafe(status, storeMapping);
      }
    }
    
    console.log('✅ Webhook procesado exitosamente con manejo seguro');
    
  } catch (error: any) {
    console.error('💥 Error crítico en webhook seguro:', error);
    
    // 📝 LOG SEGURO DEL ERROR CRÍTICO
    await safeWhatsAppLog({
      type: 'error',
      phoneNumber: 'CRITICAL_WEBHOOK_ERROR',
      messageContent: `Critical webhook error: ${error.message}`,
      errorMessage: error.message,
      rawData: JSON.stringify({ error: error.message, webhookData })
    });
    
    throw error;
  }
}

/**
 * 📊 Procesar estados de mensaje de forma segura
 */
async function processMessageStatusSafe(status: any, storeMapping: any): Promise<void> {
  try {
    console.log(`📊 Processing status: ${status.status} for message ${status.id}`);
    
    await safeWhatsAppLog({
      type: 'status',
      phoneNumber: status.recipient_id,
      messageContent: `Estado: ${status.status}`,
      messageId: status.id,
      status: status.status,
      rawData: JSON.stringify(status),
      storeId: storeMapping.storeId
    });
    
  } catch (error) {
    console.error('❌ Error processing message status:', error);
  }
}

/**
 * 📤 VERSIÓN RESILIENTE del envío de mensajes de WhatsApp
 */
async function sendWhatsAppMessageResilient(
  phoneNumber: string,
  message: string,
  storeMapping: any
): Promise<void> {
  return resilientDb.executeWithRetry(
    async (client) => {
      // ✅ USAR TU FUNCIÓN EXISTENTE sendWhatsAppMessage
      const success = await sendWhatsAppMessage(phoneNumber, message, storeMapping);
      if (!success) {
        throw new Error('Failed to send WhatsApp message');
      }
    },
    `send whatsapp message to ${phoneNumber}`
  );
}

/**
 * 🔘 VERSIÓN RESILIENTE del envío de mensajes interactivos  
 */
async function sendInteractiveMessageResilient(
  phoneNumber: string,
  messageText: string,
  buttons: any[],
  storeMapping: any
): Promise<void> {
  return resilientDb.executeWithRetry(
    async (client) => {
      // ✅ USAR TU FUNCIÓN EXISTENTE sendInteractiveMessage
      await sendInteractiveMessage(phoneNumber, messageText, buttons, storeMapping);
    },
    `send interactive message to ${phoneNumber}`
  );
}


export async function validateUpdatedWebhookProcessing(): Promise<boolean> {
  try {
    console.log('🧪 Validating updated webhook processing...');
    
    // Test 1: Handler resiliente
    const health = await resilientDb.healthCheck();
    if (!health.healthy) {
      throw new Error('ResilientDatabase not healthy');
    }
    console.log('✅ ResilientDatabase health check passed');
    
    // Test 2: Verificar que las funciones requeridas existen
    if (typeof handleRegistrationFlow !== 'function') {
      throw new Error('handleRegistrationFlow function not found');
    }
    console.log('✅ handleRegistrationFlow function exists');
    
    if (typeof processAutoResponse !== 'function') {
      throw new Error('processAutoResponse function not found');
    }
    console.log('✅ processAutoResponse function exists');
    
    console.log('✅ All required functions validated');
    console.log('✅ Updated webhook processing validation completed');
    return true;
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
}

function detectUserAction(messageText: string): 'confirm' | 'modify' | 'cancel' | 'unknown' {
  const message = messageText.toLowerCase().trim();
  
  // Detectar confirmación
  if (
    message.includes('confirmar') ||
    message.includes('confirm') ||
    message.includes('order_confirmed') ||
    message === 'confirm_order' ||
    message.includes('✅') ||
    message.includes('si') ||
    message.includes('sí') ||
    message.includes('yes') ||
    message.includes('ok') ||
    message.includes('correcto')
  ) {
    return 'confirm';
  }
  
  // Detectar modificación
  if (
    message.includes('modificar') ||
    message.includes('modify') ||
    message.includes('edit') ||
    message.includes('edit_data') ||
    message === 'edit_data' ||
    message.includes('cambiar') ||
    message.includes('corregir') ||
    message.includes('✏️') ||
    message.includes('editar')
  ) {
    return 'modify';
  }
  
  // Detectar cancelación
  if (
    message.includes('cancelar') ||
    message.includes('cancel') ||
    message === 'cancel' ||
    message.includes('❌') ||
    message.includes('no') ||
    message.includes('anular')
  ) {
    return 'cancel';
  }
  
  return 'unknown';
}


function isWelcomeMessage(messageText: string): boolean {
  const welcomePatterns = [
    'hola', 'hello', 'hi', 'buenos días', 'buenas tardes', 'buenas noches',
    'saludos', 'hey', 'start', 'comenzar', 'empezar', 'menu', 'menú'
  ];
  
  const normalizedText = messageText.toLowerCase().trim();
  return welcomePatterns.some(pattern => normalizedText.includes(pattern));
}
// ========================================
// PROCESS MESSAGE STATUSES
// ========================================
async function processMessageStatus(
  status: any,
  storeMapping: any,
  tenantStorage: any
): Promise<void> {
  try {
    const messageId = status.id;
    const statusType = status.status; // 'sent', 'delivered', 'read', 'failed'
    const recipientId = status.recipient_id;
    const timestamp = status.timestamp;
    const conversation = status.conversation;

    console.log(`📊 STATUS UPDATE - MessageID: ${messageId}, Status: ${statusType}, Recipient: ${recipientId}`);

    // ✅ REGISTRAR STATUS EN BASE DE DATOS
    const masterStorage = getMasterStorage();
    await masterStorage.addWhatsAppLog({
      type: 'status',
      phoneNumber: recipientId,
      messageContent: `Estado actualizado: ${statusType}`,
      messageId: messageId,
      status: statusType,
      rawData: JSON.stringify(status),
      storeId: storeMapping.storeId
    });

    // ✅ PROCESAR TIPOS ESPECÍFICOS DE STATUS
    switch (statusType) {
      case 'read':
        console.log(`✅ MESSAGE READ - MessageID: ${messageId} by ${recipientId}`);
        await markMessageAsReadInConversation(messageId, recipientId, tenantStorage);
        break;
      
      case 'delivered':
        console.log(`📬 MESSAGE DELIVERED - MessageID: ${messageId} to ${recipientId}`);
        // Opcional: Actualizar estado en base de datos local
        break;
      
      case 'sent':
        console.log(`📤 MESSAGE SENT - MessageID: ${messageId} to ${recipientId}`);
        break;
      
      case 'failed':
        console.log(`❌ MESSAGE FAILED - MessageID: ${messageId} to ${recipientId}`);
        const errorCode = status.errors?.[0]?.code;
        const errorTitle = status.errors?.[0]?.title;
        const errorMessage = status.errors?.[0]?.message;
        
        console.log(`💥 DELIVERY ERROR - Code: ${errorCode}, Title: ${errorTitle}, Message: ${errorMessage}`);
        
        // ✅ REGISTRAR ERROR DETALLADO
        await masterStorage.addWhatsAppLog({
          type: 'error',
          phoneNumber: recipientId,
          messageContent: `Mensaje falló: ${errorTitle}`,
          messageId: messageId,
          status: 'failed',
          errorMessage: `Code: ${errorCode}, Title: ${errorTitle}, Message: ${errorMessage}`,
          rawData: JSON.stringify(status),
          storeId: storeMapping.storeId
        });
        break;
      
      default:
        console.log(`ℹ️ UNKNOWN STATUS TYPE: ${statusType} - MessageID: ${messageId}`);
    }

    // ✅ INFORMACIÓN ADICIONAL DE LA CONVERSACIÓN
    if (conversation) {
      console.log(`💬 CONVERSATION INFO - ID: ${conversation.id}, Origin: ${conversation.origin?.type}`);
      
      // Registrar información de pricing si está disponible
      if (status.pricing) {
        console.log(`💰 PRICING INFO - Billable: ${status.pricing.billable}, Category: ${status.pricing.category}, Type: ${status.pricing.type}`);
      }
    }

  } catch (error: any) {
    console.error('❌ ERROR PROCESSING MESSAGE STATUS:', error);
    console.error('Status data:', JSON.stringify(status, null, 2));
  }
}

export function debugWebhookStructure(webhookData: any): void {
  console.log('🔍 WEBHOOK STRUCTURE DEBUG:');
  console.log('- Has entry:', !!webhookData?.entry);
  console.log('- Has changes:', !!webhookData?.entry?.[0]?.changes);
  console.log('- Field:', webhookData?.entry?.[0]?.changes?.[0]?.field);
  console.log('- Has messages:', !!webhookData?.entry?.[0]?.changes?.[0]?.value?.messages);
  console.log('- Has statuses:', !!webhookData?.entry?.[0]?.changes?.[0]?.value?.statuses);
  console.log('- Has metadata:', !!webhookData?.entry?.[0]?.changes?.[0]?.value?.metadata);
  
  const value = webhookData?.entry?.[0]?.changes?.[0]?.value;
  if (value) {
    console.log('- Messages count:', value.messages?.length || 0);
    console.log('- Statuses count:', value.statuses?.length || 0);
    console.log('- Phone Number ID:', value.metadata?.phone_number_id);
  }
}

// ========================================
// PROCESS WEBHOOK ERRORS
// ========================================
async function processWebhookError(
  error: any,
  storeMapping: any,
  tenantStorage: any
): Promise<void> {
  try {
    const errorCode = error.code;
    const errorTitle = error.title;
    const errorMessage = error.message;

    console.log(`💥 WEBHOOK ERROR - Code: ${errorCode}, Title: ${errorTitle}, Message: ${errorMessage}`);

    // Log error to database
    const masterStorage = getMasterStorage();
   await masterStorage.addWhatsAppLog({
      type: 'error',
      phoneNumber: 'WEBHOOK_ERROR',
      messageContent: `Error: ${errorTitle} - ${errorMessage}`,
      status: 'error',
      errorMessage: `Code: ${errorCode}`,
      rawData: JSON.stringify(error),
      storeId: storeMapping.storeId
    });

  } catch (processingError: any) {
    console.error('❌ ERROR PROCESSING WEBHOOK ERROR:', processingError);
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

async function markMessageAsReadInConversation(
  messageId: string,
  phoneNumber: string,
  tenantStorage: any
): Promise<void> {
  try {
    // Find customer by phone
    const customer = await tenantStorage.getCustomerByPhone(phoneNumber);
    if (!customer) {
      console.log(`⚠️ CUSTOMER NOT FOUND for read receipt - Phone: ${phoneNumber}`);
      return;
    }

    // Mark messages as read in conversation
    const conversation = await tenantStorage.getOrCreateConversationByPhone(
      phoneNumber,
      customer.storeId || 0
    );
    
    if (conversation) {
      await tenantStorage.markMessagesAsRead(conversation.id);
      console.log(`✅ MESSAGES MARKED AS READ - Conversation: ${conversation.id}`);
    }

  } catch (error: any) {
    console.error('Error marking message as read:', error);
  }
}



async function findStoreByPhoneNumberId(phoneNumberId: string) {
  try {
    console.log(`🔍 SEARCHING FOR STORE - phoneNumberId: ${phoneNumberId}`);
    
    // ✅ Import and initialize master storage
    const { getMasterStorage } = await import('./storage/index.js');
    const masterStorage = getMasterStorage();
    
    // Buscar configuración directamente en la base de datos
    const config = await masterStorage.getWhatsAppConfigByPhoneNumberId(phoneNumberId);
    
    if (!config) {
      console.log('❌ NO STORE CONFIGURED - phoneNumberId not found in database:', phoneNumberId);
      return null;
    }
    
    console.log(`🎯 PHONE NUMBER MATCH - Store ID: ${config.storeId}`);
    
    // Obtener información de la tienda
    const allStores = await masterStorage.getAllVirtualStores();
    const storeInfo = allStores.find(store => store.id === config.storeId);
    
    if (!storeInfo) {
      console.log('❌ STORE NOT FOUND - Store ID not found:', config.storeId);
      return null;
    }
    
    console.log(`✅ STORE FOUND - Store: ${storeInfo.name} (ID: ${config.storeId})`);
    
    // Verificar que la tienda esté activa
    if (!storeInfo.isActive) {
      console.log(`⚠️ STORE INACTIVE - Store: ${storeInfo.name} is not active`);
      return null;
    }
    
    return {
      storeId: config.storeId,
      storeName: storeInfo.name,
      phoneNumberId: phoneNumberId,
      isActive: storeInfo.isActive
    };
    
  } catch (error) {
    console.error('Error finding store by phoneNumberId:', error);
    return null;
  }
}

// Simplified order processing for tenant storage

async function processWebCatalogOrderSimple(customer: any, phoneNumber: string, orderText: string, storeId: number, phoneNumberId: string, tenantStorage: any) {
  try {
    console.log(`🛍️ PROCESSING WEB CATALOG ORDER - Store: ${storeId}, Customer: ${customer.id}`);
    
    // Parse the order message to extract products
    const orderItems = parseOrderFromMessage(orderText);
    
    if (orderItems.length === 0) {
      await sendWhatsAppMessageDirect(phoneNumber, 
        "No pude procesar los productos de tu pedido. ¿Podrías enviarlo nuevamente?", storeId);
      return;
    }

    // Calculate total
    const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderNumber = `ORD-${Date.now()}`;

    // ✅ PROCESAR CADA ITEM Y RESOLVER product_id
    const processedItems = [];
    
    for (const item of orderItems) {
      let productId = item.productId;
      
      // Si no tiene productId, buscar por nombre
      if (!productId) {
        console.log(`🔍 SEARCHING PRODUCT BY NAME: "${item.name}"`);
        
        const existingProducts = await tenantStorage.getAllProducts();
        
        // Buscar producto por nombre (mejorado)
        const existingProduct = existingProducts.find(p => {
          const productName = p.name.toLowerCase().trim();
          const itemName = item.name.toLowerCase().trim();
          
          // Coincidencia exacta
          if (productName === itemName) return true;
          
          // Coincidencia parcial
          if (productName.includes(itemName) || itemName.includes(productName)) return true;
          
          // Coincidencia por palabras clave importantes
          const productWords = productName.split(' ').filter(w => w.length > 3);
          const itemWords = itemName.split(' ').filter(w => w.length > 3);
          
          const commonWords = productWords.filter(word => 
            itemWords.some(itemWord => itemWord.includes(word) || word.includes(itemWord))
          );
          
          return commonWords.length >= Math.min(productWords.length, itemWords.length) / 2;
        });
        
        if (existingProduct) {
          productId = existingProduct.id;
          console.log(`✅ PRODUCT FOUND BY NAME: "${item.name}" -> "${existingProduct.name}" (ID: ${productId})`);
        } else {
          // Crear nuevo producto si no se encuentra
          console.log(`➕ CREATING NEW PRODUCT: "${item.name}"`);
          
          const newProduct = await tenantStorage.createProduct({
            name: item.name,
            price: item.price.toString(),
            description: `Producto creado automáticamente desde pedido web: ${item.name}`,
            category: 'product',
            status: 'active',
            availability: 'in_stock',
            stockQuantity: 100,
            isActive: true,
            storeId: storeId,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          productId = newProduct.id;
          console.log(`✅ NEW PRODUCT CREATED: "${item.name}" (ID: ${productId})`);
        }
      } else {
        console.log(`✅ PRODUCT ID PROVIDED: ${productId}`);
      }
      
      // ✅ VALIDAR QUE productId existe antes de agregar
      if (!productId) {
        console.error(`❌ FAILED TO GET PRODUCT ID for item: "${item.name}"`);
        continue; // Saltar este item
      }
      
      // Preparar item limpio
      const cleanedItem = {
        productId: Number(productId), // ✅ Asegurar que es número
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.price).toFixed(2),
        totalPrice: Number(item.price * item.quantity).toFixed(2),
        storeId: storeId
      };
      
      console.log(`✅ PROCESSED ITEM:`, cleanedItem);
      processedItems.push(cleanedItem);
    }
    
    if (processedItems.length === 0) {
      await sendWhatsAppMessageDirect(phoneNumber, 
        "No pude procesar ningún producto de tu pedido. Por favor verifica el formato.", storeId);
      return;
    }

    // ✅ CREAR ORDEN CON ITEMS VALIDADOS
    const orderData = {
      orderNumber: orderNumber,
      customerId: customer.id,
      totalAmount: total.toString(),
      status: 'pending',
      notes: `Pedido generado automáticamente desde catálogo web.\nTotal: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
      storeId: storeId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`🏗️ CREATING ORDER:`, orderData);
    console.log(`📦 WITH ITEMS:`, processedItems);

    const order = await tenantStorage.createOrder(orderData, processedItems);

    console.log(`✅ ORDER CREATED SUCCESSFULLY - ID: ${order.id}, Number: ${orderNumber}`);

    // Send order confirmation message
    const confirmationMessage = `✅ *PEDIDO RECIBIDO*

📦 *Resumen de tu pedido:*
📋 Número: ${orderNumber}
🛍️ Productos: ${orderItems.length} artículo(s)
${orderItems.map(item => 
      `• ${item.name} (Cantidad: ${item.quantity})`
    ).join('\n')}
💰 Total: ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}

🎯 Tu pedido ha sido registrado exitosamente. Ahora necesitamos algunos datos para completar tu pedido.`;

    await sendWhatsAppMessageDirect(phoneNumber, confirmationMessage, storeId);

    // 🔥 INICIAR FLUJO DE RECOLECCIÓN DE DATOS AUTOMÁTICAMENTE
    console.log(`🚀 STARTING REGISTRATION FLOW - Order: ${order.id}, Customer: ${customer.id}`);
    console.log(`🚀 ===== STARTING REGISTRATION FLOW =====`);
    console.log(`👤 Customer ID: ${customer.id}`);
    console.log(`📞 Phone Number: ${phoneNumber}`);
    console.log(`📦 Order ID: ${order.id}`);
    
    // ✅ CORRECCIÓN CRÍTICA: Verificar si ya existe un flujo activo
    const existingFlow = await tenantStorage.getRegistrationFlowByPhoneNumber(phoneNumber);
    
    if (existingFlow && !existingFlow.isCompleted) {
      console.log(`⚠️ ACTIVE REGISTRATION FLOW EXISTS - Updating with new order ID`);
      
      // Actualizar el flujo existente con el nuevo orderId
      await tenantStorage.updateRegistrationFlowByPhone(phoneNumber, {
        orderId: order.id,  // ✅ ASEGURAR que se guarde el orderId
        currentStep: 'collect_name',
        collectedData: JSON.stringify({}),
        updatedAt: new Date()
      });
    } else {
      console.log(`➕ CREATING NEW REGISTRATION FLOW`);
      
      // Crear flujo de registro para recopilar datos del cliente
      const flowData = {
        customerId: customer.id,
        phoneNumber: phoneNumber,
        currentStep: 'collect_name',
        flowType: 'order_data_collection',
        orderId: order.id,  // ✅ CRÍTICO: Asegurar que se pasa el orderId
        orderNumber: orderNumber,
        collectedData: JSON.stringify({}),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
        isCompleted: false
      };
      
      console.log(`📋 FLOW DATA TO CREATE:`, flowData);
      
      await tenantStorage.createOrUpdateRegistrationFlow(flowData);
    }
    
    console.log(`✅ REGISTRATION FLOW CREATED/UPDATED`);
    
    // ✅ VERIFICAR QUE EL FLUJO SE CREÓ CORRECTAMENTE
    const createdFlow = await tenantStorage.getRegistrationFlowByPhoneNumber(phoneNumber);
    console.log(`🔍 VERIFICATION - Created flow:`, {
      exists: !!createdFlow,
      orderId: createdFlow?.orderId,
      orderNumber: createdFlow?.orderNumber,
      step: createdFlow?.currentStep,
      completed: createdFlow?.isCompleted
    });
    
    if (!createdFlow || (createdFlow.orderId !== order.id && createdFlow.orderNumber !== orderNumber)) {
  console.error(`❌ REGISTRATION FLOW CREATION FAILED`);
  console.error(`Expected orderId: ${order.id}, Got: ${createdFlow?.orderId}`);
  console.error(`Expected orderNumber: ${orderNumber}, Got: ${createdFlow?.orderNumber}`);
      try {
        await tenantStorage.createOrUpdateRegistrationFlow({
          customerId: customer.id,
          phoneNumber: phoneNumber,
          currentStep: 'collect_name',
          flowType: 'order_data_collection',
          orderId: order.id,
          collectedData: JSON.stringify({}),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isCompleted: false
        });
        
        // Verificar nuevamente
        const retryFlow = await tenantStorage.getRegistrationFlowByPhoneNumber(phoneNumber);
        console.log(`🔍 RETRY VERIFICATION:`, {
          exists: !!retryFlow,
          orderId: retryFlow?.orderId,
          step: retryFlow?.currentStep
        });
      } catch (retryError) {
        console.error(`❌ RETRY ALSO FAILED:`, retryError);
      }
    }
    
    // Enviar primer mensaje del flujo (solicitar nombre)
    console.log(`📤 SENDING COLLECT_NAME MESSAGE...`);
    await sendAutoResponseMessage(phoneNumber, 'collect_name', storeId, tenantStorage);
    console.log(`✅ COLLECT_NAME MESSAGE SENT`);
    
    console.log(`✅ REGISTRATION FLOW COMPLETED`);

    // Log del éxito
    const storageFactory = await import('./storage/storage-factory.js');
    const masterStorage = storageFactory.StorageFactory.getInstance().getMasterStorage();
    await masterStorage.addWhatsAppLog({
      type: 'success',
      phoneNumber: phoneNumber,
      messageContent: `Pedido ${orderNumber} creado exitosamente con ${orderItems.length} productos. Flujo de recolección iniciado.`,
      status: 'completed',
      storeId: storeId,
      rawData: JSON.stringify({ 
        orderId: order.id,
        orderNumber: orderNumber,
        total: total,
        itemsCount: orderItems.length,
        registrationFlowStarted: true,
        flowVerification: {
          exists: !!createdFlow,
          orderId: createdFlow?.orderId,
          step: createdFlow?.currentStep
        }
      })
    });

  } catch (error: any) {
    console.error(`❌ ERROR IN processWebCatalogOrderSimple:`, error);
    
    // Log error using master storage
    const storageFactory = await import('./storage/storage-factory.js');
    const masterStorage = storageFactory.StorageFactory.getInstance().getMasterStorage();
    
    await masterStorage.addWhatsAppLog({
      type: 'error',
      phoneNumber: phoneNumber,
      messageContent: 'Error procesando pedido desde catálogo web',
      status: 'error',
      errorMessage: error.message,
      timestamp: new Date()
    });
    
    // No enviar mensaje de error al cliente - solo logging interno
  }
}


// ========================================
// FUNCIONES AUXILIARES NECESARIAS
// ========================================

// ✅ FUNCIÓN AUXILIAR PARA DETECTAR ÓRDENES
// ✅ VERSIÓN MEJORADA (funciona con cualquier formato)
async function isOrderMessage(text: string): Promise<boolean> {
  const cleanText = text.toLowerCase();
  
  const isOrder = 
    (cleanText.includes('cantidad:') && cleanText.includes('precio')) ||
    (cleanText.includes('nuevo pedido')) ||
    (cleanText.includes('pedido') && cleanText.includes('total'));
  
  console.log(`🛍️ Order detection: ${isOrder ? 'YES' : 'NO'}`);
  return isOrder;
}

function parseOrderFromMessage(orderText: string): Array<{name: string, quantity: number, price: number, productId?: number}> {
  console.log(`\n🔍 ===== PARSING ORDER MESSAGE =====`);
  console.log(`📝 Original Message:`, orderText);
  
  const items: Array<{name: string, quantity: number, price: number, productId?: number}> = [];
  
  try {
    const lines = orderText.split('\n');
    console.log(`📋 Split into ${lines.length} lines:`, lines);
    
    let currentItem: any = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      console.log(`📄 Line ${i + 1}: "${trimmedLine}"`);
      
      // ✅ NUEVO: Detectar línea de producto con ID
      // Formato: "1. Nombre del Producto [ID:123]"
      const productLineMatch = trimmedLine.match(/^\d+\.\s*(.+?)\s*\[ID:(\d+)\]/);
      
      if (productLineMatch) {
        // Guardar item anterior si existe
        if (currentItem && currentItem.name && currentItem.quantity && currentItem.price) {
          console.log(`✅ Completed item:`, currentItem);
          items.push(currentItem);
        }
        
        const productName = productLineMatch[1].trim();
        const productId = parseInt(productLineMatch[2]);
        
        // Iniciar nuevo item con ID
        currentItem = {
          name: productName,
          productId: productId,
          quantity: 0,
          price: 0
        };
        
        console.log(`🆕 Started new item with ID:`, currentItem);
        continue;
      }
      
      // ✅ FALLBACK: Detectar línea de producto sin ID (formato anterior)
      // Formato: "1. Nombre del Producto"
      if (/^\d+\.\s/.test(trimmedLine) && !trimmedLine.includes('[ID:')) {
        // Guardar item anterior si existe
        if (currentItem && currentItem.name && currentItem.quantity && currentItem.price) {
          console.log(`✅ Completed item (no ID):`, currentItem);
          items.push(currentItem);
        }
        
        // Iniciar nuevo item sin ID (se buscará por nombre)
        currentItem = {
          name: trimmedLine.replace(/^\d+\.\s/, '').trim(),
          quantity: 0,
          price: 0
          // productId se agregará después al buscar por nombre
        };
        
        console.log(`🆕 Started new item without ID:`, currentItem);
        continue;
      }
      
      // Detectar cantidad
      if (trimmedLine.toLowerCase().includes('cantidad:') && currentItem) {
        const quantityMatch = trimmedLine.match(/cantidad:\s*(\d+)/i);
        if (quantityMatch) {
          currentItem.quantity = parseInt(quantityMatch[1]);
          console.log(`📊 Set quantity: ${currentItem.quantity}`);
        }
        continue;
      }
      
      // Detectar precio unitario
      if (trimmedLine.toLowerCase().includes('precio unitario:') && currentItem) {
        const priceMatch = trimmedLine.match(/\$?([\d,]+\.?\d*)/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (!isNaN(price)) {
            currentItem.price = price;
            console.log(`💰 Set price: ${currentItem.price}`);
          }
        }
        continue;
      }
    }
    
    // No olvidar el último item
    if (currentItem && currentItem.name && currentItem.quantity && currentItem.price) {
      console.log(`✅ Final item:`, currentItem);
      items.push(currentItem);
    }
    
    console.log(`🔍 ===== PARSE RESULT =====`);
    console.log(`📦 Total items parsed: ${items.length}`);
    items.forEach((item, index) => {
      console.log(`📋 Item ${index + 1}:`, {
        name: item.name,
        productId: item.productId || 'WILL BE FOUND BY NAME',
        quantity: item.quantity,
        price: item.price
      });
    });
    console.log(`🔍 ===== END PARSING =====\n`);
    
  } catch (error) {
    console.error('❌ Error parsing order message:', error);
  }
  
  return items;
}

async function sendWhatsAppMessageDirect(phoneNumber: string, message: string, storeId: number): Promise<void> {
  try {
    const storageFactory = await import('./storage/storage-factory.js');
    const masterStorage = storageFactory.StorageFactory.getInstance().getMasterStorage();
    const config = await masterStorage.getWhatsAppConfig(storeId);
    
    if (!config || !config.accessToken || !config.phoneNumberId) {
      console.error('❌ WhatsApp config not found or incomplete');
      return;
    }

    const url = `https://graph.facebook.com/v22.0/${config.phoneNumberId}/messages`; // ← v22.0
    
    const data = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      text: { body: message }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ WHATSAPP API ERROR:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ MESSAGE SENT SUCCESSFULLY:', result);
    
  } catch (error) {
    console.error('❌ ERROR SENDING WHATSAPP MESSAGE:', error);
  }
}

// ✅ REEMPLAZAR ESTA FUNCIÓN COMPLETA:
async function sendAutoResponseMessage(phoneNumber: string, trigger: string, storeId: number, tenantStorage: any) {
  try {
    console.log(`📤 SENDING AUTO-RESPONSE (CORRECTED) - Trigger: ${trigger}, Phone: ${phoneNumber}`);
    
    const responses = await tenantStorage.getAutoResponsesByTrigger(trigger);
    
    if (!responses || responses.length === 0) {
      console.log(`❌ NO AUTO-RESPONSE FOUND FOR TRIGGER: ${trigger}`);
      return;
    }
    
    const autoResponse = responses[0];
    let messageText = autoResponse.messageText || autoResponse.message || '';
    
    // ✅ REEMPLAZAR VARIABLES
    const customer = await tenantStorage.getCustomerByPhone(phoneNumber);
    if (customer) {
      messageText = messageText.replace(/{customerName}/g, customer.name || 'Cliente');
    }
    
    // ✅ VERIFICAR BOTONES
    let menuOptions = null;
    try {
      if (autoResponse.menuOptions && typeof autoResponse.menuOptions === 'string') {
        menuOptions = JSON.parse(autoResponse.menuOptions);
        console.log(`🔘 FOUND ${menuOptions.length} BUTTONS:`, menuOptions.map(opt => opt.label));
      } else if (autoResponse.menuOptions) {
        menuOptions = autoResponse.menuOptions;
      }
    } catch (parseError) {
      console.log(`⚠️ Invalid menu options JSON:`, parseError);
    }

    // ✅ OBTENER CONFIG DE WHATSAPP
    const { getMasterStorage } = await import('./storage/index.js');
    const storage = getMasterStorage();
    const config = await storage.getWhatsAppConfig(storeId);
    
    if (!config) {
      console.error('❌ WhatsApp config not found');
      return;
    }

    const finalConfig = {
      storeId: storeId,
      accessToken: config.accessToken,
      phoneNumberId: config.phoneNumberId
    };

    // ✅ ENVIAR CON O SIN BOTONES
    if (menuOptions && Array.isArray(menuOptions) && menuOptions.length > 0) {
      console.log(`🔘 SENDING INTERACTIVE MESSAGE WITH ${menuOptions.length} BUTTONS`);
      await sendInteractiveMessage(phoneNumber, messageText, menuOptions, finalConfig);
    } else {
      console.log(`📤 SENDING SIMPLE TEXT MESSAGE`);
      await sendWhatsAppMessageDirect(phoneNumber, messageText, storeId);
    }
    
    console.log(`✅ AUTO-RESPONSE SENT - Trigger: ${trigger}`);
    
  } catch (error) {
    console.error(`❌ ERROR sending auto-response for trigger ${trigger}:`, error);
  }
}

// ========================================
// FUNCIONES FALTANTES PARA whatsapp-simple.ts
// ========================================

// ✅ FUNCIÓN 1: sendInteractiveMessage
async function sendInteractiveMessage(phoneNumber: string, messageText: string, menuOptions: any[], config: any): Promise<void> {
  try {
    console.log(`📤 SENDING INTERACTIVE MESSAGE - To: ${phoneNumber}, Buttons: ${menuOptions.length}`);

    // 🔧 SOLUCIÓN: Obtener token fresco directamente de la DB
    const { getMasterStorage } = await import('./storage/index.js');
    const storage = getMasterStorage();
    const storeId = config.storeId || 6;
    const freshConfig = await storage.getWhatsAppConfig(storeId);
    
    if (!freshConfig) {
      console.error('❌ NO FRESH CONFIG FOUND');
      return;
    }

    const url = `https://graph.facebook.com/v22.0/${freshConfig.phoneNumberId}/messages`;
    
    
    // Preparar botones (máximo 3 botones permitidos por WhatsApp)
    const buttons = menuOptions.slice(0, 3).map((option, index) => ({
      type: 'reply',
      reply: {
        id: option.action || option.value || `btn_${index}`,
        title: option.label.substring(0, 20) // WhatsApp limita a 20 caracteres
      }
    }));

    const data = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: messageText
        },
        action: {
          buttons: buttons
        }
      }
    };

   const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${freshConfig.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ WHATSAPP INTERACTIVE API ERROR:', errorText);
      
      // Fallback: enviar como mensaje de texto simple
      console.log('🔄 FALLBACK: Sending as text message');
      await sendWhatsAppMessage(phoneNumber, messageText, config);
      return;
    }

    const result = await response.json();
    console.log('✅ INTERACTIVE MESSAGE SENT SUCCESSFULLY:', result);
    
  } catch (error) {
    console.error('❌ ERROR SENDING INTERACTIVE MESSAGE:', error);
    
    // Fallback: enviar como mensaje de texto simple
    try {
      console.log('🔄 FALLBACK: Sending as text message');
      await sendWhatsAppMessage(phoneNumber, messageText, config);
    } catch (fallbackError) {
      console.error('❌ FALLBACK ALSO FAILED:', fallbackError);
    }
  }
}

// ✅ FUNCIÓN 2: checkButtonInteractions
async function checkButtonInteractions(
  messageText: string, 
  from: string, 
  customer: any, 
  tenantStorage: any, 
  storeMapping: any, 
  autoResponses: any[]
): Promise<void> {
  try {
    console.log(`🔘 CHECKING BUTTON INTERACTIONS - Message: "${messageText.toLowerCase()}"`);

    // Buscar si el mensaje corresponde a una interacción de botón
    const messageTextLower = messageText.toLowerCase().trim();
    
    // Buscar en todas las auto-respuestas si hay botones que coincidan
    for (const autoResponse of autoResponses) {
      if (!autoResponse.menuOptions) continue;
      
      let menuOptions;
      try {
        menuOptions = typeof autoResponse.menuOptions === 'string' 
          ? JSON.parse(autoResponse.menuOptions) 
          : autoResponse.menuOptions;
      } catch (parseError) {
        console.log(`⚠️ INVALID MENU OPTIONS JSON in response ${autoResponse.id}`);
        continue;
      }
      
      if (!Array.isArray(menuOptions)) continue;
      
      // Verificar si el mensaje coincide con algún botón
      for (const option of menuOptions) {
        const buttonValue = (option.value || option.action || '').toLowerCase();
        const buttonLabel = (option.label || '').toLowerCase();
        
        if (messageTextLower === buttonValue || 
            messageTextLower === buttonLabel ||
            messageTextLower.includes(buttonValue) ||
            messageTextLower.includes(buttonLabel)) {
          
          console.log(`✅ BUTTON INTERACTION DETECTED - Action: ${option.action}, Label: ${option.label}`);
          
          // Procesar la acción del botón
          await processButtonAction(option, from, customer, tenantStorage, storeMapping);
          return; // Salir después de procesar la primera coincidencia
        }
      }
    }
    
    console.log(`ℹ️ NO BUTTON INTERACTION FOUND - Message: "${messageText}"`);
    
  } catch (error) {
    console.error('❌ ERROR CHECKING BUTTON INTERACTIONS:', error);
  }
}

// ✅ FUNCIÓN 3: processButtonAction (auxiliar para checkButtonInteractions)
async function processButtonAction(
  buttonOption: any, 
  phoneNumber: string, 
  customer: any, 
  tenantStorage: any, 
  storeMapping: any
): Promise<void> {
  try {
    const action = buttonOption.action || buttonOption.value;
    
    console.log(`🎯 PROCESSING BUTTON ACTION: ${action} for customer ${customer.id}`);
    
    switch (action) {
      case 'show_products':
      case 'products':
        await sendAutoResponseMessage(phoneNumber, 'product_inquiry', storeMapping.storeId, tenantStorage);
        break;
        
      case 'show_services':
      case 'services':
        await sendAutoResponseMessage(phoneNumber, 'services_inquiry', storeMapping.storeId, tenantStorage);
        break;
        
      case 'show_order_status':
      case 'order_status':
      case 'track_order':
        await sendAutoResponseMessage(phoneNumber, 'order_status', storeMapping.storeId, tenantStorage);
        break;
        
      case 'contact_technician':
      case 'technician':
        await sendAutoResponseMessage(phoneNumber, 'contact_technician', storeMapping.storeId, tenantStorage);
        break;
        
      case 'show_help':
      case 'help':
        await sendAutoResponseMessage(phoneNumber, 'help', storeMapping.storeId, tenantStorage);
        break;
        
      case 'show_main_menu':
      case 'main_menu':
      case 'menu':
        await sendAutoResponseMessage(phoneNumber, 'menu', storeMapping.storeId, tenantStorage);
        break;
        
      default:
        console.log(`⚠️ UNKNOWN BUTTON ACTION: ${action}`);
        // Enviar mensaje de bienvenida por defecto
        await sendAutoResponseMessage(phoneNumber, 'welcome', storeMapping.storeId, tenantStorage);
        break;
    }
    
  } catch (error) {
    console.error('❌ ERROR PROCESSING BUTTON ACTION:', error);
  }
}

// ✅ FUNCIÓN 4: executeNextAction (si no existe)
async function executeNextAction(
  autoResponse: any, 
  customer: any, 
  tenantStorage: any, 
  storeId: number,
  orderId?: number
): Promise<void> {
  try {
    const nextAction = autoResponse.nextAction;
    
    if (!nextAction) {
      console.log(`ℹ️ NO NEXT ACTION - Response: ${autoResponse.name}`);
      return;
    }

    console.log(`🎯 EXECUTING NEXT ACTION: ${nextAction} for customer ${customer.id}`);

    switch (nextAction) {
      case 'collect_name':
        // Crear flow de registro si no existe
        const existingFlow = await tenantStorage.getRegistrationFlowByCustomerId(customer.id);
        
        if (!existingFlow) {
          // Crear nuevo flujo de registro
          await tenantStorage.createOrUpdateRegistrationFlow({
            customerId: customer.id,
            phoneNumber: customer.phone,
            currentStep: 'collect_name',
            flowType: 'order_data_collection',
            orderId: orderId,
            collectedData: JSON.stringify({}),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
            isCompleted: false
          });
          
          console.log(`✅ REGISTRATION FLOW CREATED - Customer: ${customer.id}, Step: collect_name`);
        }
        
        // Enviar mensaje para solicitar nombre
        await sendAutoResponseMessage(customer.phone, 'collect_name', storeId, tenantStorage);
        break;

      case 'collect_address':
        await sendAutoResponseMessage(customer.phone, 'collect_address', storeId, tenantStorage);
        break;

      case 'collect_contact':
        await sendAutoResponseMessage(customer.phone, 'collect_contact', storeId, tenantStorage);
        break;

      case 'collect_payment':
        await sendAutoResponseMessage(customer.phone, 'collect_payment', storeId, tenantStorage);
        break;

      case 'collect_notes':
        await sendAutoResponseMessage(customer.phone, 'collect_notes', storeId, tenantStorage);
        break;

      case 'confirm_order':
        await sendAutoResponseMessage(customer.phone, 'confirm_order', storeId, tenantStorage);
        break;

      case 'show_menu':
        await sendAutoResponseMessage(customer.phone, 'menu', storeId, tenantStorage);
        break;

      case 'wait_selection':
      case 'wait_order':
      case 'wait_location':
      case 'end_conversation':
        // No hacer nada, esperar respuesta del usuario o terminar
        console.log(`⏳ WAITING FOR USER RESPONSE - Action: ${nextAction}`);
        break;

      default:
        console.log(`⚠️ UNKNOWN NEXT ACTION: ${nextAction}`);
        break;
    }
    
  } catch (error: any) {
    console.error('Error executing next action:', error);
  }
}

export async function findStoreByPhoneNumberSafe(phoneNumberId: string): Promise<any> {
  try {
    const { getMasterStorage } = await import('./storage/index.js');
    const masterStorage = getMasterStorage();
    
    // ✅ INTENTAR BUSCAR POR phone_number_id
    const stores = await masterStorage.getAllVirtualStores();
    
    // Buscar store que coincida con phoneNumberId
    let matchingStore = stores.find(store => 
      store.phoneNumberId === phoneNumberId || 
      store.whatsappNumber === phoneNumberId
    );
    
    if (!matchingStore && stores.length > 0) {
      // 🔄 FALLBACK: usar el primer store activo
      matchingStore = stores.find(store => store.isActive) || stores[0];
      console.log(`🔄 Using fallback store: ${matchingStore.name} (ID: ${matchingStore.id})`);
    }
    
    if (matchingStore) {
      return {
        storeId: matchingStore.id,
        storeName: matchingStore.name,
        phoneNumberId: matchingStore.phoneNumberId || matchingStore.whatsappNumber,
        displayPhoneNumber: matchingStore.whatsappNumber,
        isActive: matchingStore.isActive
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Error finding store by phone number:', error);
    return null;
  }
}

// Función para procesar mensajes de ubicación de WhatsApp
async function processLocationMessage(messageData: any): Promise<LocationData | null> {
  try {
    // Verificar si el mensaje contiene ubicación
    if (messageData.location) {
      const location = messageData.location;
      
      return {
        type: 'coordinates',
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || null,
        formatted_address: await formatLocationAddress(location.latitude, location.longitude)
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error processing location message:', error);
    return null;
  }
}

// Función para formatear dirección desde coordenadas (usando geocoding reverso)
async function formatLocationAddress(latitude: number, longitude: number): Promise<string> {
  try {
    // Aquí puedes usar un servicio como Google Maps API o OpenStreetMap
    // Ejemplo con OpenStreetMap (gratuito)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.display_name || `${latitude}, ${longitude}`;
    }
    
    return `${latitude}, ${longitude}`;
  } catch (error) {
    console.error('❌ Error formatting location address:', error);
    return `${latitude}, ${longitude}`;
  }
}

// Función mejorada para el manejo del paso collect_address
async function handleCollectAddressStep(
 customer: any,
  messageData: any,
  messageText: string,
  registrationFlow: any,
  collectedData: any,
  storeId: number,
  tenantStorage: any
): Promise<void> {
  try {
    // 1. Verificar si es una ubicación de WhatsApp
    const locationData = await processLocationMessage(messageData);
    
    if (locationData && locationData.type === 'coordinates') {
      // Es una ubicación con coordenadas
      console.log(`📍 LOCATION RECEIVED: ${locationData.latitude}, ${locationData.longitude}`);
      
      collectedData.address = locationData.formatted_address || locationData.address;
      collectedData.latitude = locationData.latitude;
      collectedData.longitude = locationData.longitude;
      collectedData.location_type = 'coordinates';
      
      // ✅ NUEVO: Actualizar datos del cliente inmediatamente
      try {
        await tenantStorage.updateCustomer(customer.id, {
          address: collectedData.address,
          latitude: locationData.latitude,
          longitude: locationData.longitude
        });
        console.log(`✅ Customer location updated in database`);
      } catch (updateError) {
        console.log(`⚠️ Could not update customer location:`, updateError);
        // Continuar sin fallar
      }
      
      await sendWhatsAppMessageDirect(
        customer.phone,
        `✅ ¡Ubicación recibida!\n📍 ${collectedData.address}\n\nContinuemos...`,
        storeId
      );
      
    } else if (messageText && messageText.trim().length >= 10) {
      // Es texto de dirección
      console.log(`📝 TEXT ADDRESS RECEIVED: ${messageText.trim()}`);
      
      collectedData.address = messageText.trim();
      collectedData.location_type = 'text';
      
      // Opcional: Intentar geocodificar la dirección de texto
      const geocoded = await geocodeAddress(messageText.trim());
      if (geocoded) {
        collectedData.latitude = geocoded.latitude;
        collectedData.longitude = geocoded.longitude;
        
        // ✅ NUEVO: Actualizar cliente con coordenadas geocodificadas
        try {
          await tenantStorage.updateCustomer(customer.id, {
            address: collectedData.address,
            latitude: geocoded.latitude,
            longitude: geocoded.longitude
          });
          console.log(`✅ Customer location geocoded and updated`);
        } catch (updateError) {
          console.log(`⚠️ Could not update geocoded location:`, updateError);
        }
      }
      
    } else {
      // Dirección inválida - usar sendLocationRequest
      await sendLocationRequest(customer.phone, storeId, tenantStorage);
      return;
    }
    
    // Continuar al siguiente paso
    await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
      currentStep: 'collect_contact',
      collectedData: JSON.stringify(collectedData),
      updatedAt: new Date()
    });
    
    await sendAutoResponseMessage(customer.phone, 'collect_contact', storeId, tenantStorage);
    
  } catch (error) {
    console.error('❌ Error handling address collection:', error);
    await sendWhatsAppMessageDirect(
      customer.phone,
      "❌ Error procesando la ubicación. Por favor intenta nuevamente.",
      storeId
    );
  }
}

// Función para geocodificar direcciones de texto (opcional)
async function geocodeAddress(address: string): Promise<{latitude: number, longitude: number} | null> {
  try {
    // Usando OpenStreetMap Nominatim (gratuito)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error geocoding address:', error);
    return null;
  }
}

// Función para calcular distancia entre dos puntos (útil para costos de envío)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en kilómetros
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Función para calcular costo de envío basado en ubicación
async function calculateDeliveryCost(
  customerLat: number, 
  customerLon: number, 
  storeId: number, 
  tenantStorage: any
): Promise<number> {
  try {
    // Obtener ubicación de la tienda (debes tener esto configurado)
    const storeLocation = await tenantStorage.getStoreLocation(storeId);
    
    if (!storeLocation) {
      return 100; // Costo base si no hay configuración
    }
    
    const distance = calculateDistance(
      customerLat, 
      customerLon,
      storeLocation.latitude,
      storeLocation.longitude
    );
    
    // Ejemplo de cálculo: $50 base + $20 por km
    const baseCost = 50;
    const costPerKm = 20;
    const totalCost = baseCost + (distance * costPerKm);
    
    return Math.round(totalCost);
    
  } catch (error) {
    console.error('❌ Error calculating delivery cost:', error);
    return 100; // Costo por defecto
  }
}

// Función mejorada para enviar solicitud de ubicación
async function sendLocationRequest(
  phone: string, 
  storeId: number, 
  tenantStorage: any
): Promise<void> {
  try {
    const message = `📍 *Necesitamos tu ubicación*

Para calcular el costo de entrega y coordinar la visita del técnico, por favor:

🗺️ *Opción 1:* Toca el botón 📎 → Ubicación → Enviar ubicación actual

📝 *Opción 2:* Escribe tu dirección completa

Ejemplo: "Calle Principal #123, Sector Los Prados, Santo Domingo"`;

    await sendWhatsAppMessageDirect(phone, message, storeId);
    
    // También puedes enviar un mensaje interactivo con botones
    const menuOptions = [
      { label: "📍 Compartir ubicación", value: "share_location", action: "request_location" },
      { label: "📝 Escribir dirección", value: "type_address", action: "type_address" }
    ];
    
    // Si tu sistema soporta botones interactivos:
    // await sendInteractiveMessage(phone, message, menuOptions, config);
    
  } catch (error) {
    console.error('❌ Error sending location request:', error);
  }
}

// ===== AGREGAR AL FINAL DEL ARCHIVO =====

async function handleOrderTracking(phoneNumber: string, storeMapping: any, tenantStorage: any) {
  try {
    const customer = await tenantStorage.getCustomerByPhone(phoneNumber);
    if (!customer) {
      await sendSimpleMessage(phoneNumber, "No encontramos tu información. ¿Podrías proporcionar tu nombre?", storeMapping);
      return;
    }

    // ✅ CORRECCIÓN: Usar getAllOrders y filtrar
    const allOrders = await tenantStorage.getAllOrders();
    const customerOrders = allOrders.filter(order => order.customerId === customer.id);
    const activeOrders = customerOrders.filter(order => 
      ['pending', 'confirmed', 'processing', 'shipped'].includes(order.status)
    );
    
    if (activeOrders.length === 0) {
      await sendSimpleMessage(phoneNumber, "No tienes pedidos en proceso en este momento.", storeMapping);
      return;
    }

    // ✅ CORRECCIÓN: Pasar parámetros correctos
    const menuOptions = await generateOrderTrackingMenu(customer.id, tenantStorage);
    const message = `📦 *Seguimiento de Pedidos*\n\n${customer.name}, aquí están tus pedidos en proceso:`;
    
    await sendInteractiveMessage(phoneNumber, message, JSON.parse(menuOptions), storeMapping);

  } catch (error) {
    console.error('Error en handleOrderTracking:', error);
    await sendSimpleMessage(phoneNumber, "Error obteniendo tus pedidos. Intenta de nuevo.", storeMapping);
  }
}

async function handleOrderSelection(selectedValue: string, phoneNumber: string, storeMapping: any, tenantStorage: any) {
  try {
    const orderId = selectedValue.replace('order_', '');
    const customer = await tenantStorage.getCustomerByPhone(phoneNumber);
    
    if (!customer) return;

    // ✅ CORRECCIÓN: Agregar tenantStorage como tercer parámetro
    const orderDetails = await getOrderDetails(orderId, customer.id, tenantStorage);
    
    if (!orderDetails) {
      await sendSimpleMessage(phoneNumber, "No se encontraron detalles del pedido.", storeMapping);
      return;
    }

    const formattedMessage = formatOrderDetailsMessage(orderDetails);
    const menuOptions = [
      { label: "📝 Agregar Nota", value: "add_note", action: "add_order_note" },
      { label: "✏️ Modificar Pedido", value: "modify_order", action: "modify_order" },
      { label: "📦 Ver Otros Pedidos", value: "track_orders", action: "show_order_tracking" },
      { label: "🏠 Menú Principal", value: "welcome", action: "welcome" }
    ];
    
    await sendInteractiveMessage(phoneNumber, formattedMessage, menuOptions, storeMapping);

  } catch (error) {
    console.error('Error en handleOrderSelection:', error);
  }
}


async function handleIntelligentWelcome(phoneNumber: string, tenantStorage: any, storeId: number) {
  const orderCheck = await checkCustomerOrders(phoneNumber, tenantStorage, storeId);
  
  if (orderCheck.hasOrders) {
    // Cliente con órdenes activas
    const orderCount = orderCheck.orders.length;
    const customerDisplayName = orderCheck.customerName || "Cliente";
    
    return {
      messageType: "welcome_with_orders",
      message: `¡Hola ${customerDisplayName}! 👋 Bienvenido de nuevo a *MAS QUE SALUD*

📦 Veo que tienes ${orderCount} pedido(s) en proceso.

¿Qué deseas hacer hoy?`,
      menuOptions: JSON.stringify([
        { label: "📦 Seguimiento de Pedidos", value: "track_orders", action: "show_order_tracking" },
        { label: "🛍️ Hacer Pedido Nuevo", value: "new_order", action: "show_products" },
        { label: "❓ Obtener Ayuda", value: "show_help", action: "show_help" }
      ])
    };
  } else {
    // Cliente nuevo o sin órdenes activas
    return {
      messageType: "welcome_new",
      message: `¡Hola! 👋 Bienvenido a *MAS QUE SALUD*

¿En qué podemos ayudarte hoy?`,
      menuOptions: JSON.stringify([
        { label: "🛍️ Ver Productos", value: "show_products", action: "show_products" },
        { label: "⚙️ Ver Servicios", value: "show_services", action: "show_services" },
        { label: "❓ Obtener Ayuda", value: "show_help", action: "show_help" }
      ])
    };
  }
}


async function generateOrderTrackingMenu(customerId: number, tenantStorage: any) {
  const allOrders = await tenantStorage.getAllOrders();
  const customerOrders = allOrders.filter(order => order.customerId === customerId);
  const activeOrders = customerOrders.filter(order => 
    ['pending', 'confirmed', 'processing', 'shipped'].includes(order.status)
  );

  const menuOptions = [];

  for (const order of activeOrders) {
    const statusEmoji = getStatusEmoji(order.status);
    const orderDate = new Date(order.createdAt).toLocaleDateString('es-DO');
    
    menuOptions.push({
      label: `${statusEmoji} Pedido #${order.orderNumber} - ${orderDate}`,
      value: `order_${order.id}`,
      action: "show_order_details"
    });
  }

  // Agregar opciones adicionales
  menuOptions.push(
    { label: "🛍️ Hacer Pedido Nuevo", value: "new_order", action: "show_products" },
    { label: "🏠 Menú Principal", value: "welcome", action: "welcome" }
  );

  return JSON.stringify(menuOptions);
}

async function getOrderDetails(orderId: string, customerId: number, tenantStorage: any) {
  try {
    const order = await tenantStorage.getOrderById(parseInt(orderId));
    if (!order || order.customerId !== customerId) {
      return null;
    }
    
    // ✅ CORRECCIÓN: Usar método existente
    const orderItems = await tenantStorage.getOrderItemsByOrderId(parseInt(orderId));
    return { ...order, items: orderItems };
  } catch (error) {
    console.error('Error obteniendo detalles de orden:', error);
    return null;
  }
}

function formatOrderDetailsMessage(orderDetails) {
  const statusEmoji = getStatusEmoji(orderDetails.status);
  const statusText = getStatusText(orderDetails.status);
  const orderDate = new Date(orderDetails.createdAt).toLocaleDateString('es-DO');
  
  let itemsText = '';
  if (orderDetails.items && orderDetails.items.length > 0) {
    itemsText = orderDetails.items.map(item => 
      `• ${item.name || 'Producto'} (Cantidad: ${item.quantity})`
    ).join('\n');
  } else {
    itemsText = '• Ver detalles en el sistema';
  }
  
  return `📋 *Detalles del Pedido #${orderDetails.orderNumber}*

👤 *Cliente:* ${orderDetails.customerName || 'Cliente'}
📅 *Fecha:* ${orderDate}
📍 *Estado:* ${statusText} ${statusEmoji}
💰 *Total:* $${parseFloat(orderDetails.totalAmount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}

🛍️ *Productos:*
${itemsText}

📝 *Notas:* ${orderDetails.notes || 'Sin notas adicionales'}

⏱️ *Tiempo estimado:* ${orderDetails.estimatedTime || 'Por confirmar'}

¿Qué deseas hacer con este pedido?`;
}

async function sendSimpleMessage(phoneNumber: string, messageText: string, storeMapping: any) {
  try {
    const storageFactory = await import('./storage/storage-factory.js');
    const masterStorage = storageFactory.StorageFactory.getInstance().getMasterStorage();
    const config = await masterStorage.getWhatsAppConfig(storeMapping.storeId);
    await sendWhatsAppMessage(phoneNumber, messageText, config);
  } catch (error) {
    console.error('Error enviando mensaje simple:', error);
  }
}

// Agregar todas las demás funciones del código que me pasaste...

export {
  
  processLocationMessage,
  handleCollectAddressStep,
  formatLocationAddress,
  geocodeAddress,
  calculateDistance,
  calculateDeliveryCost,
  sendLocationRequest,
  type WhatsAppLocation,
  type LocationData,
   
  sendInteractiveMessage,
  isWelcomeMessage,
  handleRegistrationFlow
};

export default safeWhatsAppLog;