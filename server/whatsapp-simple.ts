// Multi-tenant WhatsApp processor with simplified routing
import { storage } from './storage_bk.js';
import { createTenantStorage } from './tenant-storage.js';
import { createTenantStorageForStore } from './tenant-storage.js';


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

// Smart store lookup with response authorization verification


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
    const message = value.messages[0];
    const customerPhone = message.from;
    const messageText = message.text?.body || '';

    console.log(`📱 MESSAGE RECEIVED - From: ${customerPhone}, PhoneNumberId: ${phoneNumberId}, Text: "${messageText}"`);

    // 🔍 BUSCAR TIENDA DINÁMICAMENTE (SIN HARDCODING)
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
      
      // ✅ CORRECCIÓN: Usar los campos correctos
      customer = await tenantStorage.createCustomer({
        name: `Cliente ${customerPhone.slice(-4)}`,
        phone: customerPhone,           // ✅ CORRECTO: "phone" no "phoneNumber"
        storeId: storeMapping.storeId,  // ✅ AGREGAR: storeId requerido
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
    
    const response = await fetch(`https://graph.facebook.com/v21.0/${globalWhatsAppConfig.phoneNumberId}/messages`, {
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

    const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;
    
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
  
  // ✅ NUEVO: VERIFICAR SI ES UN PEDIDO PRIMERO
  const isOrder = await isOrderMessage(messageText);
  
  if (isOrder) {
    console.log(`🛍️ ORDER DETECTED - Processing catalog order`);
    await processWebCatalogOrderSimple(
      customer, 
      from, 
      messageText, 
      storeMapping.storeId, 
      storeMapping.phoneNumberId, 
      tenantStorage
    );
    return; // ✅ IMPORTANTE: Salir aquí para no procesar auto-respuestas
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
    console.log(`📝 CURRENT COLLECTED DATA:`, collectedData);

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
        // Validar dirección (mínimo 10 caracteres)
        if (messageText.trim().length < 10) {
          await sendWhatsAppMessageDirect(
            customer.phone,
            "❌ Por favor proporciona una dirección más detallada (mínimo 10 caracteres):",
            storeId
          );
          return;
        }
        
        collectedData.address = messageText.trim();
        
        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'collect_contact',
          collectedData: JSON.stringify(collectedData),
          updatedAt: new Date()
        });
        
        await sendAutoResponseMessage(customer.phone, 'collect_contact', storeId, tenantStorage);
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

      case 'collect_notes':
        // Guardar notas (opcional)
        if (messageText.toLowerCase() !== 'no_notes' && 
            messageText.toLowerCase() !== 'continuar' && 
            messageText.toLowerCase() !== 'continuar sin notas' &&
            messageText.trim().length > 0) {
          collectedData.notes = messageText.trim();
        } else {
          collectedData.notes = 'Sin notas adicionales';
        }
        
        // Mostrar confirmación final
        await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
          currentStep: 'confirm_order',
          collectedData: JSON.stringify(collectedData),
          updatedAt: new Date()
        });
        
        // Preparar mensaje de confirmación con variables
        try {
          const confirmResponse = await tenantStorage.getAutoResponsesByTrigger('confirm_order');
          if (confirmResponse && confirmResponse.length > 0) {
            let confirmMessage = confirmResponse[0].messageText;
            
            // Reemplazar variables en el mensaje
            confirmMessage = confirmMessage
              .replace(/{customerName}/g, collectedData.customerName || customer.name)
              .replace(/{contactNumber}/g, collectedData.contactNumber || customer.phone)
              .replace(/{address}/g, collectedData.address || 'No proporcionada')
              .replace(/{paymentMethod}/g, collectedData.paymentMethod || 'No especificado')
              .replace(/{notes}/g, collectedData.notes || 'Ninguna')
              .replace(/{orderSummary}/g, 'Resumen del pedido')
              .replace(/{totalAmount}/g, '0.00');
            
            await sendWhatsAppMessageDirect(customer.phone, confirmMessage, storeId);
          }
        } catch (confirmError) {
          console.error('Error sending confirmation message:', confirmError);
          // Enviar mensaje básico como fallback
          await sendWhatsAppMessageDirect(
            customer.phone,
            "✅ Datos recopilados correctamente. ¿Confirmas tu pedido? Responde 'confirmar' para continuar.",
            storeId
          );
        }
        break;

      case 'confirm_order':
        if (messageText.toLowerCase().includes('confirmar') || 
            messageText.toLowerCase().includes('final_confirm') ||
            messageText.toLowerCase().includes('✅')) {
          
          // Finalizar pedido
          if (registrationFlow.orderId) {
            await finalizeOrderWithData(
              registrationFlow.orderId,
              collectedData,
              customer,
              storeId,
              tenantStorage
            );
          }
          
          // Marcar flujo como completado y eliminarlo
          await tenantStorage.deleteRegistrationFlowByPhone(customer.phone);
          
        } else if (messageText.toLowerCase().includes('modificar') || 
                   messageText.toLowerCase().includes('edit_data')) {
          
          // Volver al inicio del flujo
          await tenantStorage.updateRegistrationFlowByPhone(customer.phone, {
            currentStep: 'collect_name',
            collectedData: JSON.stringify({}),
            updatedAt: new Date()
          });
          
          await sendAutoResponseMessage(customer.phone, 'collect_name', storeId, tenantStorage);
          
        } else if (messageText.toLowerCase().includes('cancelar') || 
                   messageText.toLowerCase().includes('cancel')) {
          
          // Cancelar flujo
          await tenantStorage.deleteRegistrationFlowByPhone(customer.phone);
          await sendAutoResponseMessage(customer.phone, 'welcome', storeId, tenantStorage);
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

// ========================================
// FUNCIÓN AUXILIAR CORREGIDA CON TIPOS
// ========================================

async function finalizeOrderWithData(
  orderId: number,
  collectedData: CollectedData,
  customer: Customer,
  storeId: number,
  tenantStorage: any
): Promise<void> {
  try {
    // Update order with collected data
    const orderNotes = `
Cliente: ${collectedData.customerName || customer.name}
Dirección: ${collectedData.address || 'No proporcionada'}
Contacto: ${collectedData.contactNumber || customer.phone}
Método de Pago: ${collectedData.paymentMethod || 'No especificado'}
Notas: ${collectedData.notes || 'Ninguna'}
    `.trim();
    
    await tenantStorage.updateOrder(orderId, {
      status: 'confirmed',
      notes: orderNotes
    });
    
    // Send final confirmation message
    const confirmationMessage = `✅ *PEDIDO CONFIRMADO*

📋 *Datos Recopilados:*
👤 Cliente: ${collectedData.customerName || customer.name}
📍 Dirección: ${collectedData.address || 'No proporcionada'}
📞 Contacto: ${collectedData.contactNumber || customer.phone}
💳 Pago: ${collectedData.paymentMethod || 'No especificado'}
${collectedData.notes ? `📝 Notas: ${collectedData.notes}` : ''}

🎯 Tu pedido ha sido confirmado. Nuestro equipo se pondrá en contacto contigo pronto para coordinar la entrega.

¡Gracias por tu confianza! 🙏`;

    await sendWhatsAppMessageDirect(customer.phone, confirmationMessage, storeId);
    
    console.log(`✅ ORDER FINALIZED - Order ID: ${orderId}, Customer: ${customer.id}`);
    
  } catch (error: any) {
    console.error('Error finalizing order:', error);
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

async function processIncomingMessage(
  message: any,
  storeMapping: any,
  tenantStorage: any
): Promise<void> {
  try {
    const from = message.from;
    const messageId = message.id;
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
          messageText = buttonId; // Use button ID as message text for processing
        }
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

    console.log(`📥 PROCESSING MESSAGE - From: ${from}, Type: ${messageType}, Content: "${messageText}"`);

    // Get or create customer
   let customer = await tenantStorage.getCustomerByPhone(from);
    if (!customer) {
      console.log(`👤 CREATING NEW CUSTOMER - Phone: ${from}`);
      
      // ✅ CORRECCIÓN: Usar los campos correctos según el esquema
      customer = await tenantStorage.createCustomer({
        name: `Cliente ${from.slice(-4)}`,
        phone: from,                    // ✅ CORRECTO: "phone" no "phoneNumber"
        storeId: storeMapping.storeId,  // ✅ AGREGAR: storeId requerido
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

    // Log incoming message
    const { storage } = await import('./storage_bk.js');
    await storage.addWhatsAppLog({
      type: 'incoming',
      phoneNumber: from,
      messageContent: messageText,
      messageId: messageId,
      status: 'received',
      rawData: JSON.stringify(message),
      storeId: storeMapping.storeId
    });

    // ✅ CHECK FOR ACTIVE REGISTRATION FLOW FIRST
    const registrationFlow = await tenantStorage.getRegistrationFlowByPhoneNumber(from);
    
    if (registrationFlow && !registrationFlow.isCompleted) {
      console.log(`🔄 ACTIVE REGISTRATION FLOW DETECTED - Step: ${registrationFlow.currentStep}`);
      
      // Process the registration flow
      await handleRegistrationFlow(
        customer,
        messageText,
        registrationFlow,
        storeMapping.storeId,
        tenantStorage
      );
      
      return; // Don't process auto-responses if in registration flow
    }

    // Process configured auto-responses
    await processConfiguredAutoResponse(messageText, from, customer, tenantStorage, storeMapping);

    console.log(`✅ MESSAGE PROCESSED - From: ${from}`);

  } catch (error: any) {
    console.error('❌ ERROR PROCESSING INCOMING MESSAGE:', error);
  }
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
    
    // ✅ CORRECCIÓN: Usar master storage para logs (no storage_bk)
    const storageFactory = await import('./storage/storage-factory.js');
    const masterStorage = storageFactory.StorageFactory.getInstance().getMasterStorage();
    
    await masterStorage.addWhatsAppLog({
      type: 'info',
      phoneNumber: phoneNumber,
      messageContent: 'Iniciando procesamiento de pedido desde catálogo web (SIMPLE)',
      status: 'processing',
      rawData: JSON.stringify({ 
        customerId: customer.id,
        messageLength: orderText.length,
        storeId: storeId
      })
    });

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

    // ✅ SOLUCIÓN: Crear productos primero y preparar items para createOrder
    const processedItems = [];
    
    for (const item of orderItems) {
      let productId = item.productId;
      
      // If no productId, try to find product by name or create new one
      if (!productId) {
        const existingProducts = await tenantStorage.getAllProducts();
        
        // Enhanced product matching logic
        const existingProduct = existingProducts.find(p => {
          const productName = p.name.toLowerCase();
          const itemName = item.name.toLowerCase();
          
          // Direct name matching
          if (productName.includes(itemName) || itemName.includes(productName)) {
            return true;
          }
          
          // BTU matching for air conditioners
          const productBTU = productName.match(/(\d+k?)\s*btu/i);
          const itemBTU = itemName.match(/(\d+k?)\s*btu/i);
          
          if (productBTU && itemBTU) {
            return productBTU[1].toLowerCase() === itemBTU[1].toLowerCase();
          }
          
          return false;
        });
        
        if (existingProduct) {
          productId = existingProduct.id;
          console.log(`✅ PRODUCT MATCHED - "${item.name}" -> "${existingProduct.name}" (ID: ${productId})`);
        } else {
          // Create new product if not found
          const newProduct = await tenantStorage.createProduct({
            name: item.name,
            price: item.price.toString(),
            description: `Producto creado automáticamente desde pedido web: ${item.name}`,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          productId = newProduct.id;
          console.log(`➕ NEW PRODUCT CREATED - "${item.name}" (ID: ${productId})`);
        }
      }
      
      // ✅ PREPARAR ITEM PARA createOrder (no createOrderItem separado)
      processedItems.push({
        product_id: Number(productId),
        quantity: Number(item.quantity),
        unit_price: String(item.price), // <-- asegúrate que sea string
        total_price: String(item.price * item.quantity), // <-- asegúrate que sea string
        store_id: Number(storeId)
      });
    }

    // ✅ CREAR ORDEN CON ITEMS AL MISMO TIEMPO
    const orderData = {
      orderNumber: orderNumber,
      customerId: customer.id,
      totalAmount: total.toString(),
      status: 'pending',
      notes: `Pedido generado automáticamente desde catálogo web.\nTotal: ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // ✅ USAR createOrder con orden + items juntos
    const order = await tenantStorage.createOrder(orderData, processedItems);

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
    
    // Crear flujo de registro para recopilar datos del cliente
    await tenantStorage.createOrUpdateRegistrationFlow({
      customerId: customer.id,
      phoneNumber: phoneNumber,
      currentStep: 'collect_name',
      flowType: 'order_data_collection',
      orderId: order.id,
      collectedData: JSON.stringify({}),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      isCompleted: false
    });
    
    // Enviar primer mensaje del flujo (solicitar nombre)
    await sendAutoResponseMessage(phoneNumber, 'collect_name', storeId, tenantStorage);
    
    console.log(`✅ REGISTRATION FLOW STARTED - Customer will be prompted for data collection`);

    // Log del éxito
    await masterStorage.addWhatsAppLog({
      type: 'success',
      phoneNumber: phoneNumber,
      messageContent: `Pedido ${orderNumber} creado exitosamente con ${orderItems.length} productos. Flujo de recolección iniciado.`,
      status: 'completed',
      rawData: JSON.stringify({ 
        orderId: order.id,
        orderNumber: orderNumber,
        total: total,
        itemsCount: orderItems.length,
        registrationFlowStarted: true
      })
    });

  } catch (error: any) {
    console.error('Error processing web catalog order:', error);
    
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
async function isOrderMessage(text: string): Promise<boolean> {
  return text.startsWith('🛍️ *NUEVO PEDIDO*');
}

// Function to parse order items from catalog message
function parseOrderFromMessage(orderText: string): Array<{name: string, quantity: number, price: number, productId?: number}> {
  const items: Array<{name: string, quantity: number, price: number, productId?: number}> = [];
  
  try {
    const lines = orderText.split('\n');
    let currentItem: any = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this line starts a new product (number followed by period)
      if (/^\d+\.\s/.test(trimmedLine)) {
        // Save previous item if exists
        if (currentItem && currentItem.name && currentItem.quantity && currentItem.price) {
          items.push(currentItem);
        }
        
        // Start new item
        currentItem = {
          name: trimmedLine.replace(/^\d+\.\s/, ''),
          quantity: 0,
          price: 0
        };
      }
      // Check for quantity line
      else if (trimmedLine.startsWith('Cantidad:') && currentItem) {
        const quantity = parseInt(trimmedLine.replace('Cantidad:', '').trim());
        if (!isNaN(quantity)) {
          currentItem.quantity = quantity;
        }
      }
      // Check for unit price line
      else if (trimmedLine.startsWith('Precio unitario:') && currentItem) {
        const priceMatch = trimmedLine.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (!isNaN(price)) {
            currentItem.price = price;
          }
        }
      }
    }
    
    // Don't forget the last item
    if (currentItem && currentItem.name && currentItem.quantity && currentItem.price) {
      items.push(currentItem);
    }
    
  } catch (error) {
    console.error('Error parsing order message:', error);
  }
  
  return items;
}

async function sendWhatsAppMessageDirect(phoneNumber: string, message: string, storeId: number): Promise<void> {
  try {
    // ✅ USAR MASTER STORAGE PARA OBTENER CONFIG
    const storageFactory = await import('./storage/storage-factory.js');
    const masterStorage = storageFactory.StorageFactory.getInstance().getMasterStorage();
    const config = await masterStorage.getWhatsAppConfig(storeId);
    
    if (!config || !config.accessToken || !config.phoneNumberId) {
      console.error('❌ WhatsApp config not found or incomplete');
      return;
    }

    const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;
    
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

// Función para enviar mensaje de auto-respuesta
async function sendAutoResponseMessage(
  phoneNumber: string,
  trigger: string,
  storeId: number,
  tenantStorage: any,
  variables?: Record<string, string>
): Promise<void> {
  try {
    console.log(`📤 SENDING AUTO RESPONSE - Trigger: ${trigger}, Phone: ${phoneNumber}`);
    
    // Obtener respuesta automática por trigger
    const autoResponses = await tenantStorage.getAutoResponsesByTrigger(trigger);
    
    if (!autoResponses || autoResponses.length === 0) {
      console.log(`⚠️ NO AUTO RESPONSE FOUND - Trigger: ${trigger}`);
      
      // Fallback messages para pasos críticos
      let fallbackMessage = '';
      switch (trigger) {
        case 'collect_name':
          fallbackMessage = "📝 Para continuar con tu pedido, necesitamos algunos datos.\n\n👤 Por favor, proporciona tu nombre completo:";
          break;
        case 'collect_address':
          fallbackMessage = "📍 Ahora necesitamos tu dirección de entrega.\n\nPor favor escribe tu dirección completa:";
          break;
        case 'collect_contact':
          fallbackMessage = "📞 ¿Cuál es tu número de contacto preferido?\n\n(Puede ser el mismo de WhatsApp o uno diferente):";
          break;
        case 'collect_payment':
          fallbackMessage = "💳 ¿Cómo prefieres pagar?\n\nOpciones: Efectivo, Transferencia, Tarjeta";
          break;
        case 'collect_notes':
          fallbackMessage = "📝 ¿Tienes alguna nota especial o comentario adicional?\n\n(Si no tienes ninguno, escribe 'ninguno')";
          break;
        case 'confirm_order':
          fallbackMessage = "✅ Por favor, confirma los siguientes datos:\n\n¿Todo está correcto? Responde 'confirmar' para finalizar tu pedido.";
          break;
        default:
          fallbackMessage = "¡Hola! ¿En qué podemos ayudarte?";
      }
      
      await sendWhatsAppMessageDirect(phoneNumber, fallbackMessage, storeId);
      return;
    }
    
    const autoResponse = autoResponses[0];
    let messageText = autoResponse.messageText;
    
    // Reemplazar variables si se proporcionan
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        messageText = messageText.replace(new RegExp(`{${key}}`, 'g'), value);
      }
    }
    
    // Enviar mensaje
    await sendWhatsAppMessageDirect(phoneNumber, messageText, storeId);
    
    console.log(`✅ AUTO RESPONSE SENT - Trigger: ${trigger}, Message length: ${messageText.length}`);
    
  } catch (error: any) {
    console.error('Error sending auto response message:', error);
    
    // Enviar mensaje básico como último recurso
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

    const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}/messages`;
    
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


