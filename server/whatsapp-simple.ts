// Multi-tenant WhatsApp processor with simplified routing
import { storage } from './storage_bk.js';
import { createTenantStorage } from './tenant-storage.js';
import { createTenantStorageForStore } from './tenant-storage.js';
import { IntelligentWelcomeService, OrderTrackingService } from './order-tracking';



interface CollectedData {
  customerName?: string;
  address?: string;
  contactNumber?: string;
  paymentMethod?: string;
  notes?: string;
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
// 🔧 FIX: Corregir función checkCustomerOrders
async function checkCustomerOrders(phoneNumber: string, tenantStorage: any, storeId: number) {
  try {
    // Obtener cliente por número de teléfono
    const customer = await tenantStorage.getCustomerByPhone(phoneNumber);
    if (!customer) {
      console.log(`👤 CUSTOMER NOT FOUND - Phone: ${phoneNumber}`);
      return { hasOrders: false };
    }

    console.log(`👤 CUSTOMER FOUND - ID: ${customer.id}, Name: ${customer.name}`);

    // ✅ CORREGIDO: Crear instancia de OrderTrackingService
    const { ConversationContextService } = await import('./conversation-context.js');
    const contextService = new ConversationContextService(tenantStorage, storeId);
    const orderTrackingService = new OrderTrackingService(tenantStorage, contextService, storeId);
    
    // Llamar método de instancia
    const activeOrders = await orderTrackingService.getCustomerActiveOrders(customer.id);

    console.log(`📦 ACTIVE ORDERS FOUND: ${activeOrders?.length || 0}`);

    return {
      hasOrders: activeOrders && activeOrders.length > 0,
      orders: activeOrders || [],
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

export async function processWhatsAppMessage(webhookData: any) {
  try {
    console.log('📨 WEBHOOK DATA RECEIVED:', JSON.stringify(webhookData, null, 2));
    
    const entry = webhookData.entry?.[0];
    if (!entry) {
      console.log('❌ NO ENTRY FOUND in webhook data');
      return;
    }

    const changes = entry.changes?.[0];
    if (!changes || changes.field !== 'messages') {
      console.log('❌ NO MESSAGE CHANGES FOUND');
      return;
    }

    const value = changes.value;
    if (!value.messages || !value.metadata) {
      console.log('❌ NO MESSAGES OR METADATA FOUND');
      return;
    }

    const phoneNumberId = value.metadata.phone_number_id;
    const message = value.messages[0];  // ✅ OBTENER MENSAJE COMPLETO
    const customerPhone = message.from;
    const messageText = message.text?.body || '';

    console.log(`📱 MESSAGE RECEIVED - From: ${customerPhone}, PhoneNumberId: ${phoneNumberId}, Text: "${messageText}"`);

    // 🔍 BUSCAR TIENDA DINÁMICAMENTE
    const storeMapping = await findStoreByPhoneNumberId(phoneNumberId);
    
    if (!storeMapping) {
      console.log(`❌ STORE NOT FOUND - No store configured for phoneNumberId: ${phoneNumberId}`);
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: customerPhone,
        messageContent: `Mensaje recibido para phoneNumberId no configurado: ${phoneNumberId}`,
        status: 'failed',
        rawData: JSON.stringify({ phoneNumberId, customerPhone, messageText })
      });
      return;
    }

    console.log(`✅ PROCESSING MESSAGE - Store: ${storeMapping.storeName} (ID: ${storeMapping.storeId})`);

    // 🔄 CREAR STORAGE ESPECÍFICO DE LA TIENDA
    const tenantStorage = await createTenantStorageForStore(storeMapping.storeId);

    // 👤 PROCESAR CLIENTE
    let customer = await tenantStorage.getCustomerByPhone(customerPhone);
    
    if (!customer) {
      console.log(`👤 CREATING NEW CUSTOMER - Phone: ${customerPhone}`);
      
      customer = await tenantStorage.createCustomer({
        name: `Cliente ${customerPhone.slice(-4)}`,
        phone: customerPhone,
        storeId: storeMapping.storeId,
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
    }

    // 📝 REGISTRAR LOG EN BASE DE DATOS
    await storage.addWhatsAppLog({
      type: 'incoming',
      phoneNumber: customerPhone,
      messageContent: messageText,
      messageId: message.id,
      status: 'received',
      rawData: JSON.stringify(webhookData)
    });

    // ✅ VERIFICAR FLUJO DE REGISTRO ACTIVO PRIMERO
    const registrationFlow = await tenantStorage.getRegistrationFlowByPhoneNumber(customerPhone);
    
    if (registrationFlow && !registrationFlow.isCompleted) {
      console.log(`🔄 ACTIVE REGISTRATION FLOW DETECTED - Step: ${registrationFlow.currentStep}`);
      
      // ✅ CORRECCIÓN: Pasar datos completos del mensaje
      await handleRegistrationFlow(
        customer,
        messageText,
        message,                    // ✅ PASAR MENSAJE COMPLETO
        registrationFlow,
        storeMapping.storeId,
        tenantStorage
      );
      
      return; // No procesar auto-respuestas si está en flujo de registro
    }

    // 🔄 PROCESAR AUTO-RESPUESTA
    await processAutoResponse(messageText, customerPhone, storeMapping.storeId, tenantStorage);

    console.log(`✅ MESSAGE PROCESSED SUCCESSFULLY - Store: ${storeMapping.storeName}`);

  } catch (error) {
    console.error('❌ ERROR PROCESSING WHATSAPP MESSAGE:', error);
  }
}

async function processAutoResponse(messageText: string, phoneNumber: string, storeId: number, tenantStorage: any) {
  try {
    console.log(`🤖 PROCESSING AUTO-RESPONSE - Store ID: ${storeId}, Message: "${messageText}"`);

    // 1. ✅ CORRECCIÓN: Usar getAllAutoResponses() en lugar de getAutoResponses()
    const autoResponses = await tenantStorage.getAllAutoResponses();
    
    if (!autoResponses || autoResponses.length === 0) {
      console.log(`❌ NO AUTO-RESPONSES CONFIGURED - Store ${storeId}: No responses found in tenant database`);
      return;
    }

    console.log(`📋 AUTO-RESPONSES FOUND - Store ${storeId}: ${autoResponses.length} responses available`);

    // 2. Buscar respuesta apropiada
    const messageTextLower = messageText.toLowerCase().trim();
    let autoResponse = null;

    // Buscar respuesta específica por trigger
    autoResponse = autoResponses.find((resp: any) => {
      if (!resp.isActive) return false;
      
      const triggers = resp.triggers ? resp.triggers.split(',').map((t: string) => t.trim().toLowerCase()) : [resp.trigger?.toLowerCase()];
      return triggers.some((trigger: string) => messageTextLower.includes(trigger));
    });

    // Si no hay coincidencia específica, buscar por patrones de saludo
    if (!autoResponse) {
      const greetingPatterns = ['hola', 'hello', 'hi', 'buenos dias', 'buenas tardes', 'menu', 'menú'];
      const isGreeting = greetingPatterns.some(pattern => messageTextLower.includes(pattern));
      
      if (isGreeting) {
        autoResponse = autoResponses.find((resp: any) => 
          resp.isActive && resp.trigger === 'welcome'
        );
        console.log(`👋 GREETING DETECTED - Using welcome auto-response`);
      }
    }
    
    // Si aún no hay coincidencia, usar welcome como predeterminado
    if (!autoResponse) {
      autoResponse = autoResponses.find((resp: any) => 
        resp.isActive && resp.trigger === 'welcome'
      );
      console.log(`🔄 NO SPECIFIC MATCH - Using default welcome auto-response`);
    }

    // 3. Enviar respuesta si se encontró
    if (!autoResponse) {
      console.log(`❌ NO AUTO-RESPONSE CONFIGURED - Store ${storeId}: No matching responses in tenant database`);
      return;
    }

    console.log(`✅ AUTO-RESPONSE FOUND - Store ${storeId}: "${autoResponse.name}" (ID: ${autoResponse.id})`);
    console.log(`📝 USING CONFIGURED MESSAGE: "${autoResponse.messageText.substring(0, 100)}..."`);

    // 4. Obtener configuración de WhatsApp desde la base de datos global
    const { storage } = await import('./storage_bk.js');
    const globalWhatsAppConfig = await storage.getWhatsAppConfig(storeId);
    
    if (!globalWhatsAppConfig) {
      console.log(`❌ NO WHATSAPP CONFIG FOUND - Store ${storeId}: Please configure WhatsApp API in global settings`);
      throw new Error('WhatsApp configuration not found in global database. Please configure WhatsApp API in store settings.');
    }

    // 5. Preparar el payload del mensaje
    let messagePayload;
    
    if (autoResponse.menuOptions) {
      const menuButtons = autoResponse.menuOptions.split(',').map((option: string, index: number) => ({
        type: 'reply',
        reply: {
          id: `option_${index}`,
          title: option.trim()
        }
      }));

      if (menuButtons.length > 0) {
        messagePayload = {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: autoResponse.messageText },
            action: { buttons: menuButtons }
          }
        };
      } else {
        messagePayload = {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: { body: autoResponse.messageText }
        };
      }
    } else {
      messagePayload = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: autoResponse.messageText }
      };
    }

    // 6. Enviar mensaje a través de WhatsApp API
    console.log('📤 SENDING MESSAGE WITH GLOBAL CONFIG - Store', storeId, 'phoneNumberId:', globalWhatsAppConfig.phoneNumberId);
    
    const response = await fetch(`https://graph.facebook.com/v22.0/${globalWhatsAppConfig.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${globalWhatsAppConfig.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    const result = await response.json();
    console.log('📤 WhatsApp API Response:', result);

    if (response.ok) {
      console.log(`✅ AUTO-RESPONSE SENT SUCCESSFULLY - Store ${storeId}`);
      await storage.addWhatsAppLog({
        type: 'outgoing',
        phoneNumber: phoneNumber,
        messageContent: `Auto-response sent: ${autoResponse.name}`,
        status: 'sent',
        storeId: storeId,
        rawData: JSON.stringify(result)
      });
    } else {
      console.error(`❌ WHATSAPP API ERROR - Store ${storeId}:`, result);
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: phoneNumber,
        messageContent: `Failed to send auto-response: ${autoResponse.name}`,
        status: 'failed',
        storeId: storeId,
        errorMessage: JSON.stringify(result),
        rawData: JSON.stringify(messagePayload)
      });
      throw new Error(`WhatsApp API Error: ${JSON.stringify(result)}`);
    }

  } catch (error) {
    console.error('❌ ERROR PROCESSING AUTO-RESPONSE:', error);
    
    // Log del error
    const { storage } = await import('./storage_bk.js');
    await storage.addWhatsAppLog({
      type: 'error',
      phoneNumber: phoneNumber,
      messageContent: `Error processing auto-response: ${messageText}`,
      status: 'failed',
      storeId: storeId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      rawData: JSON.stringify({ messageText, error: error instanceof Error ? error.stack : error })
    });
    
    throw error;
  }
}

async function sendWhatsAppMessage(phoneNumber: string, message: string, config: any): Promise<boolean> {
  try {
    console.log(`📤 SENDING WHATSAPP MESSAGE - To: ${phoneNumber}, Using phoneNumberId: ${config.phoneNumberId}`);

    const url = `https://graph.facebook.com/v22.0/${config.phoneNumberId}/messages`;
    
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
      console.error(response, config.accessToken)
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
    const { storage } = await import('./storage_bk.js');
    const globalConfig = await storage.getWhatsAppConfig();
    
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
    
    const { storage } = await import('./storage_bk.js');
    await storage.addWhatsAppLog({
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
// FUNCIÓN AUXILIAR: sendWhatsAppMessageDirect
// ======================================



async function handleRegistrationFlow(
  customer: Customer,
  messageText: string,
  messageData: any,
  registrationFlow: RegistrationFlow,
  storeId: number,
  tenantStorage: any
): Promise<void> {
  try {
    const currentStep = registrationFlow.currentStep;
    
    // ✅ CORRECCIÓN: Manejo seguro de collectedData con tipos
       let collectedData: CollectedData = {};
    try {
      if (registrationFlow.collectedData && typeof registrationFlow.collectedData === 'string') {
        collectedData = JSON.parse(registrationFlow.collectedData) as CollectedData;
      } else if (registrationFlow.collectedData && typeof registrationFlow.collectedData === 'object') {
        collectedData = registrationFlow.collectedData as CollectedData;
      }
    } catch (parseError) {
      console.log(`⚠️ INVALID JSON in collectedData, starting fresh:`, parseError);
      collectedData = {};
    }
    
    console.log(`🔄 PROCESSING REGISTRATION STEP: ${currentStep} for Customer: ${customer.id}`);

    switch (currentStep) {
      case 'collect_name':
        // Validar nombre (mínimo 2 caracteres, solo letras y espacios)
        const namePattern = /^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,50}$/;
        if (!namePattern.test(messageText.trim())) {
          await sendWhatsAppMessageDirect(
            customer.phone,
            "❌ Por favor ingresa un nombre válido (solo letras, mínimo 2 caracteres):",
            storeId
          );
          return;
        }
        
        // Actualizar datos del cliente y flujo
        await tenantStorage.updateCustomer(customer.id, { name: messageText.trim() });
        collectedData.customerName = messageText.trim();
        
        // Avanzar al siguiente paso
        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'collect_address',
          collectedData: JSON.stringify(collectedData),
          updatedAt: new Date()
        });
        
        await sendAutoResponseMessage(customer.phone, 'collect_address', storeId, tenantStorage);
        break;

        case 'collect_address':
        // 🔥 USAR LA NUEVA FUNCIÓN para manejar ubicaciones
        await handleCollectAddressStep(
          customer,
          messageData, // Datos completos del mensaje
          messageText,
          registrationFlow,
          collectedData,
          storeId,
          tenantStorage
        );
        break;

      case 'collect_contact':
        // Manejar botones o entrada de texto
        const msgLower = messageText.toLowerCase();
        
        if (msgLower.includes('usar este') || msgLower.includes('use_whatsapp') || msgLower === 'usar este número') {
          collectedData.contactNumber = customer.phone;
        } else if (msgLower.includes('otro') || msgLower.includes('other_number') || msgLower === 'otro número') {
          await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
            currentStep: 'collect_other_number',
            collectedData: JSON.stringify(collectedData),
            updatedAt: new Date()
          });
          
          await sendAutoResponseMessage(customer.phone, 'collect_other_number', storeId, tenantStorage);
          return;
        } else {
          // Entrada directa de número
          const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
          if (!phoneRegex.test(messageText.trim())) {
            await sendWhatsAppMessageDirect(
              customer.phone,
              "❌ Número inválido. Formato ejemplo: 809-123-4567",
              storeId
            );
            return;
          }
          collectedData.contactNumber = messageText.trim();
        }
        
        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'collect_payment',
          collectedData: JSON.stringify(collectedData),
          updatedAt: new Date()
        });
        
        await sendAutoResponseMessage(customer.phone, 'collect_payment', storeId, tenantStorage);
        break;

      case 'collect_other_number':
        const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
        if (!phoneRegex.test(messageText.trim())) {
          await sendWhatsAppMessageDirect(
            customer.phone,
            "❌ Número inválido. Formato ejemplo: 809-123-4567",
            storeId
          );
          return;
        }
        
        collectedData.contactNumber = messageText.trim();
        
        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'collect_payment',
          collectedData: JSON.stringify(collectedData),
          updatedAt: new Date()
        });
        
        await sendAutoResponseMessage(customer.phone, 'collect_payment', storeId, tenantStorage);
        break;

      case 'collect_payment':
        // Manejar selección de método de pago
        let paymentMethod = '';
        const msgPaymentLower = messageText.toLowerCase();
        
        if (msgPaymentLower.includes('tarjeta') || msgPaymentLower.includes('card') || msgPaymentLower.includes('crédito') || msgPaymentLower.includes('débito')) {
          paymentMethod = 'Tarjeta de Crédito/Débito';
        } else if (msgPaymentLower.includes('transferencia') || msgPaymentLower.includes('transfer') || msgPaymentLower.includes('bancaria')) {
          paymentMethod = 'Transferencia Bancaria';
        } else if (msgPaymentLower.includes('efectivo') || msgPaymentLower.includes('cash') || msgPaymentLower.includes('contra entrega')) {
          paymentMethod = 'Efectivo (Contra Entrega)';
        } else {
          await sendAutoResponseMessage(customer.phone, 'collect_payment', storeId, tenantStorage);
          return;
        }
        
        collectedData.paymentMethod = paymentMethod;
        
        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'collect_notes',
          collectedData: JSON.stringify(collectedData),
          updatedAt: new Date()
        });
        
        await sendAutoResponseMessage(customer.phone, 'collect_notes', storeId, tenantStorage);
        break;

// ✅ CORRECCIÓN 1: Case 'collect_notes' - Mejorar obtención de nombres de productos
case 'collect_notes':
  console.log(`\n🔍 ===== DEBUG COLLECT_NOTES =====`);
  console.log(`📝 Registration Flow:`, JSON.stringify(registrationFlow, null, 2));
  console.log(`📦 Order ID from flow:`, registrationFlow.orderId);
  console.log(`📋 Order Number from flow:`, registrationFlow.orderNumber);
  console.log(`👤 Customer:`, JSON.stringify(customer, null, 2));
  console.log(`📋 Collected Data:`, JSON.stringify(collectedData, null, 2));

  // Guardar notas (opcional)
  if (messageText.toLowerCase() !== 'no_notes' && 
      messageText.toLowerCase() !== 'continuar' && 
      messageText.toLowerCase() !== 'continuar sin notas' &&
      messageText !== 'continue_no_notes' &&
      messageText !== 'no_notes' &&
      messageText.trim().length > 0) {
    collectedData.notes = messageText.trim();
  } else {
    collectedData.notes = 'Sin notas adicionales';
  }
  
  // Actualizar datos antes de mostrar confirmación
  await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
    currentStep: 'confirm_order',
    collectedData: JSON.stringify(collectedData),
    updatedAt: new Date()
  });

  // ✅ MEJORA: Obtener datos completos del pedido para la confirmación
  let orderDetails = '';
  let totalAmount = '0.00';
  let displayOrderNumber = '';
  
  const orderReference = registrationFlow.orderNumber || registrationFlow.orderId;
  
  if (orderReference) {
    try {
      let order = null;
      
      if (registrationFlow.orderId) {
        order = await tenantStorage.getOrderById(registrationFlow.orderId);
      } else if (registrationFlow.orderNumber) {
        const allOrders = await tenantStorage.getAllOrders();
        order = allOrders.find(o => o.orderNumber === registrationFlow.orderNumber);
      }
      
      console.log(`🔍 ORDER RETRIEVED:`, order);
      
      if (order) {
        totalAmount = order.totalAmount || '0.00';
        displayOrderNumber = order.orderNumber || `ORD-${order.id}`;
        
        // ✅ CORRECCIÓN: Obtener items del pedido con nombres completos
        const orderItems = await tenantStorage.getOrderItemsByOrderId(order.id);
        console.log(`📦 ORDER ITEMS:`, orderItems);
        
        if (orderItems && orderItems.length > 0) {
          orderDetails = `📦 *Pedido:* ${displayOrderNumber}\n🛍️ *Productos:* ${orderItems.length} artículo(s)\n`;
          
          // ✅ CORRECCIÓN: Mejorar la obtención del nombre del producto
          for (const item of orderItems) {
            // Priorizar productName, luego name, luego buscar en products table
            let itemName = item.productName || item.name;
            
            // ✅ NUEVO: Si no tiene nombre, buscar en la tabla de productos
            if (!itemName || itemName === 'Producto') {
              try {
                if (item.productId) {
                  const product = await tenantStorage.getProductById(item.productId);
                  if (product) {
                    itemName = product.name || product.title || 'Producto sin nombre';
                  }
                }
              } catch (productError) {
                console.log(`⚠️ Error obteniendo producto ${item.productId}:`, productError);
              }
            }
            
            // ✅ FALLBACK: Si aún no tiene nombre, usar un genérico descriptivo
            if (!itemName || itemName === 'Producto') {
              itemName = `Producto #${item.id || 'N/A'}`;
            }
            
            const quantity = item.quantity || 1;
            const unitPrice = item.unitPrice || item.price || '0.00';
            
            orderDetails += `• ${itemName} (Cantidad: ${quantity})\n`;
            if (unitPrice !== '0.00') {
              orderDetails += `  💰 Precio: $${parseFloat(unitPrice).toLocaleString('es-DO', { minimumFractionDigits: 2 })}\n`;
            }
          }
        } else {
          orderDetails = `📦 *Pedido:* ${displayOrderNumber}\n🛍️ *Productos:* Ver detalles en el sistema\n`;
        }
      } else {
        console.log(`⚠️ ORDER NOT FOUND - Reference: ${orderReference}`);
        orderDetails = `📦 *Pedido:* ${orderReference}\n🛍️ *Productos:* Detalles no disponibles\n`;
      }
    } catch (orderError) {
      console.error('❌ Error obteniendo detalles del pedido:', orderError);
      orderDetails = `📦 *Pedido:* Error al cargar detalles\n`;
    }
  } else {
    console.log(`⚠️ NO ORDER REFERENCE FOUND IN REGISTRATION FLOW`);
    orderDetails = `📦 *Pedido:* Referencia no disponible\n`;
  }
  
  console.log(`📋 FINAL ORDER DETAILS: ${orderDetails}`);
  console.log(`💰 FINAL TOTAL AMOUNT: ${totalAmount}`);
  console.log(`📋 DISPLAY ORDER NUMBER: ${displayOrderNumber}`);

  // Crear mensaje de confirmación completo
  const confirmationMessage = `✅ *Confirmación de Pedido*

¡Perfecto! Aquí está el resumen completo de tu pedido:

👤 *Cliente:* ${collectedData.customerName || customer.name}
📞 *Contacto:* ${collectedData.contactNumber || customer.phone}
📍 *Dirección:* ${collectedData.address || 'No especificada'}
💳 *Pago:* ${collectedData.paymentMethod || 'No especificado'}
📝 *Notas:* ${collectedData.notes || 'Sin notas adicionales'}

${orderDetails}
💰 *Total Final: $${parseFloat(totalAmount || '0').toLocaleString('es-DO', { minimumFractionDigits: 2 })}*

¿Confirmas tu pedido?`;

  // Enviar mensaje de confirmación personalizado con botones
  const confirmResponse = await tenantStorage.getAutoResponsesByTrigger('confirm_order');
  if (confirmResponse && confirmResponse.length > 0) {
    let menuOptions = null;
    try {
      if (confirmResponse[0].menuOptions && typeof confirmResponse[0].menuOptions === 'string') {
        menuOptions = JSON.parse(confirmResponse[0].menuOptions);
      } else if (confirmResponse[0].menuOptions) {
        menuOptions = confirmResponse[0].menuOptions;
      }
    } catch (parseError) {
      console.log(`⚠️ INVALID MENU OPTIONS JSON:`, parseError);
    }

    const storageFactory = await import('./storage/storage-factory.js');
    const masterStorage = storageFactory.StorageFactory.getInstance().getMasterStorage();  
    const config = await masterStorage.getWhatsAppConfig(storeId);

    if (menuOptions && Array.isArray(menuOptions) && menuOptions.length > 0) {
      await sendInteractiveMessage(customer.phone, confirmationMessage, menuOptions, config);
    } else {
      await sendWhatsAppMessageDirect(customer.phone, confirmationMessage, storeId);
    }
  } else {
    await sendWhatsAppMessageDirect(customer.phone, confirmationMessage, storeId);
  }
  break;

case 'confirm_order':
  console.log(`\n🎯 ===== CONFIRM ORDER STEP =====`);
  console.log(`📝 Message received: "${messageText}"`);
  console.log(`📝 Message lower: "${messageText.toLowerCase()}"`);
  console.log(`📦 Registration Flow:`, {
    orderId: registrationFlow.orderId,
    orderNumber: registrationFlow.orderNumber,
    currentStep: registrationFlow.currentStep
  });
  
  // ✅ MEJORADO: Detectar acción del usuario
  const userAction = detectUserAction(messageText);
  console.log(`🎯 Detected user action: ${userAction}`);
  
  switch (userAction) {
    case 'confirm':
      console.log(`✅ USER WANTS TO CONFIRM ORDER`);
      
      const orderIdToFinalize = registrationFlow.orderId;
      const orderNumberForLogs = registrationFlow.orderNumber || `ID-${orderIdToFinalize}`;
      
      console.log(`🎯 CONFIRMING ORDER - ID: ${orderIdToFinalize}, Number: ${orderNumberForLogs}`);
      
      if (orderIdToFinalize) {
        await finalizeOrderWithData(
          orderIdToFinalize,
          collectedData,
          customer,
          storeId,
          tenantStorage
        );
      } else {
        console.log(`⚠️ NO ORDER ID FOUND IN REGISTRATION FLOW`);
        const displayReference = registrationFlow.orderNumber || 'tu pedido';
        await sendWhatsAppMessageDirect(
          customer.phone,
          `✅ Datos de ${displayReference} registrados correctamente. Nuestro equipo te contactará pronto.`,
          storeId
        );
      }
      
      // Marcar flujo como completado y eliminarlo
      await tenantStorage.deleteRegistrationFlowByPhone(customer.phone);
      break;

    case 'modify':
      console.log(`✏️ USER WANTS TO MODIFY ORDER DATA`);
      
      // ✅ CORRECCIÓN: Preservar orderId y orderNumber al resetear
      await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
        currentStep: 'collect_name',
        collectedData: JSON.stringify({}), // ✅ Resetear solo datos recolectados
        orderId: registrationFlow.orderId,        // ✅ PRESERVAR orderId
        orderNumber: registrationFlow.orderNumber, // ✅ PRESERVAR orderNumber
        updatedAt: new Date()
      });
      
      await sendWhatsAppMessageDirect(
        customer.phone,
        `✏️ *Modificando Pedido*\n\nVamos a recopilar tus datos nuevamente.\n\nComenzemos con tu nombre:`,
        storeId
      );
      
      // Enviar mensaje para recopilar nombre
      await sendAutoResponseMessage(customer.phone, 'collect_name', storeId, tenantStorage);
      break;

    case 'cancel':
      console.log(`❌ USER WANTS TO CANCEL ORDER`);
      
      const orderReference = registrationFlow.orderNumber || registrationFlow.orderId || 'desconocido';
      console.log(`❌ ORDER CANCELLED BY USER - Reference: ${orderReference}`);
      
      // Log de cancelación
      const storageFactory = await import('./storage/storage-factory.js');
      const masterStorage = storageFactory.StorageFactory.getInstance().getMasterStorage();
      await masterStorage.addWhatsAppLog({
        type: 'info',
        phoneNumber: customer.phone,
        messageContent: `Pedido ${orderReference} cancelado por el usuario durante confirmación`,
        status: 'cancelled',
        storeId: storeId,
        rawData: JSON.stringify({ 
          orderId: registrationFlow.orderId,
          orderNumber: registrationFlow.orderNumber,
          collectedData 
        })
      });
      
      // Cancelar flujo y volver al menú
      await tenantStorage.deleteRegistrationFlowByPhone(customer.phone);
      
      await sendWhatsAppMessageDirect(
        customer.phone,
        `❌ *Pedido Cancelado*\n\nTu pedido ${orderReference} ha sido cancelado.\n\n¿Podemos ayudarte con algo más?`,
        storeId
      );
      
      // Enviar menú principal
      await sendAutoResponseMessage(customer.phone, 'welcome', storeId, tenantStorage);
      break;

    default:
      console.log(`❓ UNKNOWN ACTION - Resending confirmation`);
      // Reenviar mensaje de confirmación si no se entiende la respuesta
      await sendAutoResponseMessage(
          customer.phone, 
  'confirm_order', 
  storeId, 
  tenantStorage,
  {
    orderDetails: orderDetails,
    totalAmount: totalAmount,
    orderNumber: displayOrderNumber
  }
);
      break;
  }
  break;
      default:
        console.log(`⚠️ UNKNOWN REGISTRATION STEP: ${currentStep}`);
        await tenantStorage.deleteRegistrationFlowByPhone(customer.phone);
        await sendAutoResponseMessage(customer.phone, 'welcome', storeId, tenantStorage);
        break;
    }

  } catch (error: any) {
    console.error('Error in handleRegistrationFlow:', error);
    
    // ✅ CORRECCIÓN: Usar método correcto para eliminar flujo
    try {
      await tenantStorage.deleteRegistrationFlowByPhone(customer.phone);
    } catch (deleteError) {
      console.error('Error deleting registration flow:', deleteError);
    }
    
    await sendWhatsAppMessageDirect(
      customer.phone,
      "❌ Ha ocurrido un error. Por favor, inicia el proceso nuevamente escribiendo 'menu'.",
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

export async function processWhatsAppMessageSimple(value: any): Promise<void> {
  try {
    console.log('🎯 MULTI-TENANT PROCESSOR - Processing webhook');
    console.log('📦 WEBHOOK PAYLOAD:', JSON.stringify(value, null, 2));
    
    // Step 1: Extract phoneNumberId from webhook metadata
    const phoneNumberId = value.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    console.log('📱 EXTRACTED PHONE NUMBER ID:', phoneNumberId);
    
    if (!phoneNumberId) {
      console.log('❌ NO PHONE NUMBER ID - Skipping processing');
      return;
    }

    // Step 2: Find store by phoneNumberId
    const storeMapping = await findStoreByPhoneNumberId(phoneNumberId);
    if (!storeMapping) {
      console.log(`❌ STORE NOT FOUND - No store configured for phoneNumberId: ${phoneNumberId}`);
      return;
    }

    console.log(`✅ STORE FOUND - Store ID: ${storeMapping.storeId} Store Name: ${storeMapping.storeName}`);

    // Step 3: Get webhook data
    const webhookValue = value.entry?.[0]?.changes?.[0]?.value;
    if (!webhookValue) {
      console.log('❌ NO WEBHOOK VALUE FOUND');
      return;
    }

    // Step 4: Create tenant storage for this store
    const tenantStorage = await createTenantStorageForStore(storeMapping.storeId);

    // ========================================
    // HANDLE DIFFERENT WEBHOOK TYPES
    // ========================================

    // 📩 PROCESS NEW MESSAGES
    const messages = webhookValue.messages;
    if (messages?.length > 0) {
      console.log(`📩 PROCESSING ${messages.length} MESSAGE(S)`);
      
      for (const message of messages) {
        await processIncomingMessage(message, storeMapping, tenantStorage);
      }
    } else {
      console.log('ℹ️ NO MESSAGES IN WEBHOOK');
    }

    // 📊 PROCESS MESSAGE STATUSES (read, delivered, sent, failed)
    const statuses = webhookValue.statuses;
    if (statuses?.length > 0) {
      console.log(`📊 PROCESSING ${statuses.length} STATUS UPDATE(S)`);
      
      for (const status of statuses) {
        await processMessageStatus(status, storeMapping, tenantStorage);
      }
    } else {
      console.log('ℹ️ NO STATUSES IN WEBHOOK');
    }

    // 🔔 PROCESS ERRORS (if any)
    const errors = webhookValue.errors;
    if (errors?.length > 0) {
      console.log(`❌ PROCESSING ${errors.length} ERROR(S)`);
      
      for (const error of errors) {
        await processWebhookError(error, storeMapping, tenantStorage);
      }
    }

    console.log(`✅ WEBHOOK PROCESSED SUCCESSFULLY - Store: ${storeMapping.storeName}`);

  } catch (error: any) {
    console.error('❌ ERROR PROCESSING WHATSAPP WEBHOOK:', error);
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
async function processIncomingMessage(
  message: any,
  storeMapping: any,
  tenantStorage: any
): Promise<void> {
  try {
    const from = message.from;
    const messageId = message.id; // ✅ Variable definida correctamente aquí
    const messageType = message.type;
    const timestamp = message.timestamp;
    
    let messageText = '';
    let buttonId = '';

    // Extract message content based on type
    switch (messageType) {
      case 'text':
        messageText = message.text?.body || '';
        break;
      case 'interactive':
        if (message.interactive?.type === 'button_reply') {
          buttonId = message.interactive.button_reply.id;
          messageText = buttonId;
        }
        break;
      case 'location':
        messageText = '[Ubicación compartida]';
        break;
      case 'image':
        messageText = message.image?.caption || '[Imagen]';
        break;
      case 'document':
        messageText = message.document?.caption || '[Documento]';
        break;
      case 'audio':
        messageText = '[Mensaje de voz]';
        break;
      default:
        messageText = `[${messageType}]`;
        break;
    }

    // Verificar si es un mensaje de bienvenida
    if (isWelcomeMessage(messageText)) {
      const response = await handleIntelligentWelcome(from, tenantStorage, storeMapping.storeId);
      
      if (response.messageType === 'welcome_with_orders') {
        await sendInteractiveMessage(from, response.message, JSON.parse(response.menuOptions), storeMapping);
      } else {
        await sendInteractiveMessage(from, response.message, JSON.parse(response.menuOptions), storeMapping);
      }
      return;
    }
    
    // Manejar seguimiento de órdenes
    if (messageText === 'track_orders' || messageText.includes('seguimiento')) {
      await handleOrderTracking(from, storeMapping, tenantStorage);
      return;
    }
    
    // Manejar selección de orden específica
    if (messageText.startsWith('order_')) {
      await handleOrderSelection(messageText, from, storeMapping, tenantStorage);
      return;
    }

    console.log(`📥 PROCESSING MESSAGE - From: ${from}, Type: ${messageType}, Content: "${messageText}"`);

    // Get or create customer
    let customer = await tenantStorage.getCustomerByPhone(from);
    if (!customer) {
      console.log(`👤 CREATING NEW CUSTOMER - Phone: ${from}`);
      
      customer = await tenantStorage.createCustomer({
        name: `Cliente ${from.slice(-4)}`,
        phone: from,
        storeId: storeMapping.storeId,
        whatsappId: from,
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

    // ✅ FIX: Log incoming message - messageId está en ámbito aquí
    const { storage } = await import('./storage_bk.js');
    await storage.addWhatsAppLog({
      type: 'incoming',
      phoneNumber: from,
      messageContent: messageText,
      messageId: messageId, // ✅ messageId está definido y disponible aquí
      status: 'received',
      rawData: JSON.stringify(message),
      storeId: storeMapping.storeId
    });

    // Check for active registration flow
    const registrationFlow = await tenantStorage.getRegistrationFlowByPhoneNumber(from);
    
    if (registrationFlow && !registrationFlow.isCompleted) {
      console.log(`🔄 ACTIVE REGISTRATION FLOW DETECTED - Step: ${registrationFlow.currentStep}`);
      
      await handleRegistrationFlow(
        customer,
        messageText,
        message,
        registrationFlow,
        storeMapping.storeId,
        tenantStorage
      );
      
      return;
    }

    // Process configured auto-responses
    await processConfiguredAutoResponse(messageText, from, customer, tenantStorage, storeMapping);

    console.log(`✅ MESSAGE PROCESSED - From: ${from}`);

  } catch (error: any) {
    console.error('❌ ERROR PROCESSING INCOMING MESSAGE:', error);
  }
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

    console.log(`📊 STATUS UPDATE - MessageID: ${messageId}, Status: ${statusType}, Recipient: ${recipientId}`);

    // Update message status in database
    const { storage } = await import('./storage_bk.js');
    await storage.addWhatsAppLog({
      type: 'status',
      phoneNumber: recipientId,
      messageContent: `Estado actualizado: ${statusType}`,
      messageId: messageId,
      status: statusType,
      rawData: JSON.stringify(status),
      storeId: storeMapping.storeId
    });

    // Handle specific status types
    switch (statusType) {
      case 'read':
        console.log(`✅ MESSAGE READ - MessageID: ${messageId} by ${recipientId}`);
        // Mark message as read in conversation
        await markMessageAsReadInConversation(messageId, recipientId, tenantStorage);
        break;
      
      case 'delivered':
        console.log(`📬 MESSAGE DELIVERED - MessageID: ${messageId} to ${recipientId}`);
        break;
      
      case 'failed':
        console.log(`❌ MESSAGE FAILED - MessageID: ${messageId} to ${recipientId}`);
        const errorCode = status.errors?.[0]?.code;
        const errorTitle = status.errors?.[0]?.title;
        console.log(`💥 DELIVERY ERROR - Code: ${errorCode}, Title: ${errorTitle}`);
        break;
      
      case 'sent':
        console.log(`📤 MESSAGE SENT - MessageID: ${messageId} to ${recipientId}`);
        break;
    }

  } catch (error: any) {
    console.error('❌ ERROR PROCESSING MESSAGE STATUS:', error);
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
    const { storage } = await import('./storage_bk.js');
    await storage.addWhatsAppLog({
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
    
    // Buscar configuración directamente en la base de datos
    const config = await storage.getWhatsAppConfigByPhoneNumberId(phoneNumberId);
    
    if (!config) {
      console.log('❌ NO STORE CONFIGURED - phoneNumberId not found in database:', phoneNumberId);
      return null;
    }
    
    console.log(`🎯 PHONE NUMBER MATCH - Store ID: ${config.storeId}`);
    
    // Obtener información de la tienda
    const allStores = await storage.getAllVirtualStores();
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

async function sendAutoResponseMessage(
  phoneNumber: string,
  trigger: string,
  storeId: number,
  tenantStorage: any,
  variables?: Record<string, string>
): Promise<void> {
  try {
    console.log(`📤 SENDING AUTO RESPONSE WITH VARIABLES - Trigger: ${trigger}, Variables:`, variables);
    
    const autoResponses = await tenantStorage.getAutoResponsesByTrigger(trigger);

    if (!autoResponses || autoResponses.length === 0) {
      console.log(`❌ NO AUTO-RESPONSE FOUND FOR TRIGGER: ${trigger}`);
      
      // Fallback específico para confirm_order
      if (trigger === 'confirm_order') {
        const fallbackMessage = `✅ *Confirma tu Pedido*

${variables?.orderDetails || 'Revisa los datos de tu pedido.'}

¿Los datos están correctos?

Responde:
• "Confirmar" para proceder
• "Modificar" para cambiar datos  
• "Cancelar" para anular`;

        await sendWhatsAppMessageDirect(phoneNumber, fallbackMessage, storeId);
        return;
      }
      
      // Fallback para otros triggers
      await sendWhatsAppMessageDirect(phoneNumber, "¡Hola! ¿En qué podemos ayudarte?", storeId);
      return;
    }
    
    const autoResponse = autoResponses[0];
    let messageText = autoResponse.messageText;
    
    // ✅ REEMPLAZAR VARIABLES en el mensaje
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        messageText = messageText.replace(new RegExp(placeholder, 'g'), value);
      }
    }
    
    console.log(`📝 Final message after variable replacement:`, messageText.substring(0, 100) + '...');
    
    // Obtener config global
    const storageFactory = await import('./storage/storage-factory.js');
    const masterStorage = storageFactory.StorageFactory.getInstance().getMasterStorage();
    const config = await masterStorage.getWhatsAppConfig(storeId);

    // Procesar botones si existen
    let menuOptions = null;
    try {
      if (autoResponse.menuOptions && typeof autoResponse.menuOptions === 'string') {
        menuOptions = JSON.parse(autoResponse.menuOptions);
      } else if (autoResponse.menuOptions) {
        menuOptions = autoResponse.menuOptions;
      }
    } catch (parseError) {
      console.log(`⚠️ INVALID MENU OPTIONS JSON:`, parseError);
    }

    if (menuOptions && Array.isArray(menuOptions) && menuOptions.length > 0) {
      await sendInteractiveMessage(phoneNumber, messageText, menuOptions, config);
    } else {
      await sendWhatsAppMessageDirect(phoneNumber, messageText, storeId);
    }
    
    console.log(`✅ AUTO RESPONSE SENT WITH VARIABLES - Trigger: ${trigger}`);
    
  } catch (error: any) {
    console.error('Error sending auto response message with variables:', error);
    await sendWhatsAppMessageDirect(
      phoneNumber,
      "Ha ocurrido un error. ¿Podrías intentar nuevamente?",
      storeId
    );
  }
}


// ========================================
// FUNCIONES FALTANTES PARA whatsapp-simple.ts
// ========================================

// ✅ FUNCIÓN 1: sendInteractiveMessage
async function sendInteractiveMessage(phoneNumber: string, messageText: string, menuOptions: any[], config: any): Promise<void> {
  try {
    console.log(`📤 SENDING INTERACTIVE MESSAGE - To: ${phoneNumber}, Buttons: ${menuOptions.length}`);

    const url = `https://graph.facebook.com/v22.0/${config.phoneNumberId}/messages`;
    
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
        'Authorization': `Bearer ${config.accessToken}`,
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

    const activeOrders = await tenantStorage.getActiveOrdersByCustomer(customer.id);
    
    if (activeOrders.length === 0) {
      await sendSimpleMessage(phoneNumber, "No tienes pedidos en proceso en este momento.", storeMapping);
      return;
    }

    // Generar menú dinámico de órdenes
    const menuOptions = await generateOrderTrackingMenu(customer.id);
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


// Función auxiliar para generar menú de órdenes
function generateOrderTrackingMenu(activeOrders) {
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

async function getOrderDetails(orderId, customerId, tenantStorage) {
  try {
    const order = await tenantStorage.getOrderById(orderId);
    if (!order || order.customerId !== customerId) {
      return null;
    }
    
    const orderItems = await tenantStorage.getOrderItems(orderId);
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
  type LocationData
};
