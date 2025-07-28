// Multi-tenant WhatsApp processor with simplified routing
import { storage } from './storage_bk.js';
import { createTenantStorage } from './tenant-storage.js';
import { createTenantStorageForStore } from './tenant-storage.js';

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
      customer = await tenantStorage.createCustomer({
        name: `Cliente ${customerPhone.slice(-4)}`,
        phone: customerPhone,
        email: '',
        address: ''
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
// New function to process configured auto-responses
async function processConfiguredAutoResponse(messageText: string, from: string, customer: any, tenantStorage: any, storeMapping: any) {
  console.log(`🎯 PROCESSING CONFIGURED AUTO-RESPONSE - Store ${storeMapping.storeId}`);
  
  // CRITICAL: Use only tenant schema for store-specific auto-responses
  let autoResponse = null;
  const messageTextLower = messageText.toLowerCase().trim();
  
  // Get auto-responses ONLY from tenant schema (store-specific)
  const autoResponses = await tenantStorage.getAllAutoResponses();
  console.log(`🔍 STORE-SPECIFIC AUTO-RESPONSE VALIDATION - Store ${storeMapping.storeId}: Found ${autoResponses.length} tenant auto-responses`);
  
  // VALIDATION: Ensure we're only using responses from this specific store's schema
  if (autoResponses.length === 0) {
    console.log(`⚠️ WARNING - Store ${storeMapping.storeId}: No auto-responses found in tenant schema ${storeMapping.schema}`);
    throw new Error('No auto-responses configured for this store');
  }
  
  // Step 1: Look for exact trigger matches in tenant schema ONLY
  autoResponse = autoResponses.find((resp: any) => 
    resp.isActive && resp.trigger.toLowerCase() === messageTextLower
  );
  
  // Step 2: Handle button interactions by checking actions
  if (!autoResponse) {
    console.log(`🔘 CHECKING BUTTON INTERACTIONS - Message: "${messageTextLower}"`);
    // Check if message matches button actions from menu_options
    for (const resp of autoResponses) {
      if (resp.isActive && resp.menuOptions) {
        try {
          const menuOptions = JSON.parse(resp.menuOptions);
          const matchingOption = menuOptions.find((option: any) => 
            option.action === messageTextLower || option.value === messageTextLower
          );
          if (matchingOption) {
            // Find the auto-response for this action
            const actionResponse = autoResponses.find((actionResp: any) => 
              actionResp.isActive && actionResp.trigger === matchingOption.action
            );
            if (actionResponse) {
              autoResponse = actionResponse;
              console.log(`🔘 BUTTON ACTION DETECTED - Matching "${messageTextLower}" to trigger "${matchingOption.action}"`);
              break;
            }
          }
        } catch (e) {
          console.log(`⚠️ JSON PARSE ERROR for response ${resp.id}:`, e.message);
        }
      }
    }
  }
  
  // Step 3: If no exact match, check common greeting patterns and map to welcome
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
  
  // Step 4: If still no match, use welcome as default
  if (!autoResponse) {
    autoResponse = autoResponses.find((resp: any) => 
      resp.isActive && resp.trigger === 'welcome'
    );
    console.log(`🔄 NO SPECIFIC MATCH - Using default welcome auto-response`);
  }

  // Step 5: If auto-response found, send it
  if (!autoResponse) {
    console.log(`❌ NO AUTO-RESPONSE CONFIGURED - Store ${storeMapping.storeId}: No matching responses in tenant schema`);
    throw new Error('No auto-responses configured for this store');
  }

  console.log(`✅ AUTO-RESPONSE FOUND - Store ${storeMapping.storeId}: "${autoResponse.name}" (ID: ${autoResponse.id})`);
  console.log(`📝 USING CONFIGURED MESSAGE: "${autoResponse.messageText.substring(0, 100)}..."`);

  // Step 6: Get WhatsApp configuration from global database (centralized configurations)
  const { storage } = await import('./storage_bk.js');
  const globalWhatsAppConfig = await storage.getWhatsAppConfig(storeMapping.storeId);
  
  if (!globalWhatsAppConfig) {
    console.log(`❌ NO WHATSAPP CONFIG FOUND - Store ${storeMapping.storeId}: Please configure WhatsApp API in global settings`);
    throw new Error('WhatsApp configuration not found in global database. Please configure WhatsApp API in store settings.');
  }
  
  console.log(`✅ GLOBAL WHATSAPP CONFIG LOADED - Store ${storeMapping.storeId}: phoneNumberId ${globalWhatsAppConfig.phoneNumberId}`);

  // Step 7: Process interactive buttons from auto-response configuration
  let messagePayload;
  
  // Check both camelCase (menuOptions) and snake_case (menu_options) field names
  const menuOptionsData = autoResponse?.menuOptions || autoResponse?.menu_options;
  const menuTypeData = autoResponse?.menuType || autoResponse?.menu_type;
  
  if (autoResponse && menuOptionsData && menuTypeData === 'buttons') {
    try {
      const menuOptions = JSON.parse(menuOptionsData);
      console.log(`🔘 INTERACTIVE BUTTONS DETECTED - Store ${storeMapping.storeId}: ${menuOptions.length} buttons configured`);
      
      // WhatsApp interactive message with buttons
      messagePayload = {
        messaging_product: 'whatsapp',
        to: from,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: autoResponse.messageText
          },
          action: {
            buttons: menuOptions.slice(0, 3).map((option: any, index: number) => ({
              type: 'reply',
              reply: {
                id: option.action || option.value || `btn_${index}`,
                title: option.label.substring(0, 20) // WhatsApp button title limit
              }
            }))
          }
        }
      };
      console.log(`📤 SENDING INTERACTIVE MESSAGE - Store ${storeMapping.storeId}: ${menuOptions.length} buttons`);
    } catch (error) {
      console.log(`⚠️ BUTTON PARSING ERROR - Store ${storeMapping.storeId}: ${error.message}, falling back to text`);
      messagePayload = {
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: autoResponse.messageText }
      };
    }
  } else {
    // Simple text message
    console.log(`📤 SENDING TEXT MESSAGE - Store ${storeMapping.storeId}: No buttons configured`);
    messagePayload = {
      messaging_product: 'whatsapp',
      to: from,
      type: 'text',
      text: { body: autoResponse.messageText }
    };
  }

  // Step 8: Send the message via WhatsApp API using global configuration
  console.log('📤 SENDING MESSAGE WITH GLOBAL CONFIG - Store', storeMapping.storeId, 'phoneNumberId:', globalWhatsAppConfig.phoneNumberId);
  
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
    console.log(`✅ AUTO-RESPONSE SENT SUCCESSFULLY - Store ${storeMapping.storeId}`);
    await storage.addWhatsAppLog({
      type: 'success',
      phoneNumber: from,
      messageContent: `Auto-response sent: ${autoResponse.name}`,
      status: 'sent',
      rawData: JSON.stringify(result)
    });
  } else {
    throw new Error(`WhatsApp API Error: ${JSON.stringify(result)}`);
  }
}

// Function to send auto-response messages with variable substitution
async function sendAutoResponseMessage(
  phoneNumber: string, 
  trigger: string, 
  storeId: number, 
  tenantStorage: any, 
  variables: Record<string, string> = {}
): Promise<void> {
  try {
    // Get auto-response from tenant database
    const autoResponses = await tenantStorage.getAllAutoResponses();
    const autoResponse = autoResponses.find((r: any) => r.trigger === trigger && r.isActive);
    
    if (!autoResponse) {
      console.log(`⚠️ NO AUTO-RESPONSE FOUND - Store ${storeId}: trigger "${trigger}"`);
      return;
    }

    // Replace variables in message text
    let messageText = autoResponse.messageText;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      messageText = messageText.replace(new RegExp(placeholder, 'g'), value);
    }

    // Get WhatsApp configuration for the specific store
    const { storage } = await import('./storage_bk.js');
    const config = await storage.getWhatsAppConfig(storeId);
    if (!config) {
      throw new Error(`WhatsApp config not found for store ${storeId}`);
    }

    // Prepare message payload
    let messagePayload: any = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: { body: messageText }
    };

    // Add interactive buttons if configured
    if (autoResponse.menuOptions) {
      try {
        const menuOptions = JSON.parse(autoResponse.menuOptions);
        if (Array.isArray(menuOptions) && menuOptions.length > 0) {
          messagePayload = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: messageText },
              action: {
                buttons: menuOptions.slice(0, 3).map((option: any, index: number) => ({
                  type: 'reply',
                  reply: {
                    id: option.action || option.value || `btn_${index}`,
                    title: option.label.substring(0, 20)
                  }
                }))
              }
            }
          };
        }
      } catch (error) {
        console.log(`⚠️ BUTTON PARSING ERROR in sendAutoResponseMessage: ${error.message}`);
      }
    }

    // Send message
    const response = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    const result = await response.json();
    console.log(`📤 AUTO-RESPONSE "${trigger}" SENT - Store ${storeId}:`, result);

    if (!response.ok) {
      throw new Error(`WhatsApp API Error: ${JSON.stringify(result)}`);
    }

  } catch (error: any) {
    console.error(`Error sending auto-response "${trigger}":`, error);
    const { storage } = await import('./storage_bk.js');
    await storage.addWhatsAppLog({
      type: 'error',
      phoneNumber: phoneNumber,
      messageContent: `Error enviando respuesta automática "${trigger}"`,
      status: 'error',
      errorMessage: error.message
    });
  }
}

// Function to handle registration flow for data collection
async function handleRegistrationFlow(
  customer: any,
  messageText: string,
  registrationFlow: any,
  storeId: number,
  tenantStorage: any
): Promise<void> {
  try {
    const currentStep = registrationFlow.currentStep;
    const collectedData = JSON.parse(registrationFlow.collectedData || '{}');
    
    console.log(`🔄 PROCESSING REGISTRATION STEP: ${currentStep} for Customer: ${customer.id}`);

    switch (currentStep) {
      case 'collect_name':
        // Validate name (minimum 3 characters)
        if (messageText.trim().length < 3) {
          await sendAutoResponseMessage(customer.phoneNumber, 'collect_name', storeId, tenantStorage);
          return;
        }
        
        // Update customer name
        await tenantStorage.updateCustomer(customer.id, { name: messageText.trim() });
        collectedData.customerName = messageText.trim();
        
        // Advance to address collection
        await tenantStorage.createOrUpdateRegistrationFlow({
          customerId: customer.id,
          flowType: registrationFlow.flowType,
          currentStep: 'collect_address',
          orderId: registrationFlow.orderId,
          collectedData: JSON.stringify(collectedData),
          expiresAt: registrationFlow.expiresAt
        });
        
        await sendAutoResponseMessage(customer.phoneNumber, 'collect_address', storeId, tenantStorage);
        break;

      case 'collect_address':
        // Save address
        collectedData.address = messageText.trim();
        
        // Advance to contact collection
        await tenantStorage.createOrUpdateRegistrationFlow({
          customerId: customer.id,
          flowType: registrationFlow.flowType,
          currentStep: 'collect_contact',
          orderId: registrationFlow.orderId,
          collectedData: JSON.stringify(collectedData),
          expiresAt: registrationFlow.expiresAt
        });
        
        await sendAutoResponseMessage(customer.phoneNumber, 'collect_contact', storeId, tenantStorage);
        break;

      case 'collect_contact':
        // Handle contact selection (button or text)
        if (messageText === 'use_current') {
          collectedData.contactNumber = customer.phoneNumber;
        } else if (messageText === 'use_other') {
          // Change step to get custom number
          await tenantStorage.createOrUpdateRegistrationFlow({
            customerId: customer.id,
            flowType: registrationFlow.flowType,
            currentStep: 'collect_custom_contact',
            orderId: registrationFlow.orderId,
            collectedData: JSON.stringify(collectedData),
            expiresAt: registrationFlow.expiresAt
          });
          
          await sendWhatsAppMessageDirect(customer.phoneNumber, 
            "📞 Por favor escribe tu número de contacto (10 dígitos):", storeId);
          return;
        } else {
          // Direct phone number input
          const phoneRegex = /^\d{10}$/;
          if (!phoneRegex.test(messageText.replace(/\D/g, ''))) {
            await sendWhatsAppMessageDirect(customer.phoneNumber, 
              "❌ Número inválido. Debe tener 10 dígitos. Intenta de nuevo:", storeId);
            return;
          }
          collectedData.contactNumber = messageText.trim();
        }
        
        // Advance to payment method
        await tenantStorage.createOrUpdateRegistrationFlow({
          customerId: customer.id,
          flowType: registrationFlow.flowType,
          currentStep: 'collect_payment',
          orderId: registrationFlow.orderId,
          collectedData: JSON.stringify(collectedData),
          expiresAt: registrationFlow.expiresAt
        });
        
        await sendAutoResponseMessage(customer.phoneNumber, 'collect_payment', storeId, tenantStorage);
        break;

      case 'collect_custom_contact':
        // Validate and save custom contact number
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(messageText.replace(/\D/g, ''))) {
          await sendWhatsAppMessageDirect(customer.phoneNumber, 
            "❌ Número inválido. Debe tener 10 dígitos. Intenta de nuevo:", storeId);
          return;
        }
        
        collectedData.contactNumber = messageText.trim();
        
        // Advance to payment method
        await tenantStorage.createOrUpdateRegistrationFlow({
          customerId: customer.id,
          flowType: registrationFlow.flowType,
          currentStep: 'collect_payment',
          orderId: registrationFlow.orderId,
          collectedData: JSON.stringify(collectedData),
          expiresAt: registrationFlow.expiresAt
        });
        
        await sendAutoResponseMessage(customer.phoneNumber, 'collect_payment', storeId, tenantStorage);
        break;

      case 'collect_payment':
        // Handle payment method selection
        let paymentMethod = '';
        if (messageText === 'payment_card') {
          paymentMethod = 'Tarjeta de Crédito/Débito';
        } else if (messageText === 'payment_transfer') {
          paymentMethod = 'Transferencia Bancaria';
        } else if (messageText === 'payment_cash') {
          paymentMethod = 'Efectivo';
        } else {
          await sendAutoResponseMessage(customer.phoneNumber, 'collect_payment', storeId, tenantStorage);
          return;
        }
        
        collectedData.paymentMethod = paymentMethod;
        
        // Advance to notes collection
        await tenantStorage.createOrUpdateRegistrationFlow({
          customerId: customer.id,
          flowType: registrationFlow.flowType,
          currentStep: 'collect_notes',
          orderId: registrationFlow.orderId,
          collectedData: JSON.stringify(collectedData),
          expiresAt: registrationFlow.expiresAt
        });
        
        await sendAutoResponseMessage(customer.phoneNumber, 'collect_notes', storeId, tenantStorage);
        break;

      case 'collect_notes':
        // Save notes (optional)
        if (messageText.toLowerCase() !== 'continuar' && messageText.trim().length > 0) {
          collectedData.notes = messageText.trim();
        }
        
        // Finalize order with collected data
        await finalizeOrderWithData(registrationFlow.orderId, collectedData, customer, storeId, tenantStorage);
        
        // Clear registration flow
        await tenantStorage.deleteRegistrationFlow(customer.id);
        break;

      default:
        console.log(`⚠️ UNKNOWN REGISTRATION STEP: ${currentStep}`);
        await tenantStorage.deleteRegistrationFlow(customer.id);
        break;
    }

  } catch (error: any) {
    console.error('Error in handleRegistrationFlow:', error);
    await tenantStorage.deleteRegistrationFlow(customer.id);
  }
}

// Function to finalize order with collected data
async function finalizeOrderWithData(
  orderId: number,
  collectedData: any,
  customer: any,
  storeId: number,
  tenantStorage: any
): Promise<void> {
  try {
    // Update order with collected data
    const orderNotes = `
Cliente: ${collectedData.customerName || customer.name}
Dirección: ${collectedData.address || 'No proporcionada'}
Contacto: ${collectedData.contactNumber || customer.phoneNumber}
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
📞 Contacto: ${collectedData.contactNumber || customer.phoneNumber}
💳 Pago: ${collectedData.paymentMethod || 'No especificado'}
${collectedData.notes ? `📝 Notas: ${collectedData.notes}` : ''}

🎯 Tu pedido ha sido confirmado. Nuestro equipo se pondrá en contacto contigo pronto para coordinar la entrega.

¡Gracias por tu confianza! 🙏`;

    await sendWhatsAppMessageDirect(customer.phoneNumber, confirmationMessage, storeId);
    
    console.log(`✅ ORDER FINALIZED - Order ID: ${orderId}, Customer: ${customer.id}`);
    
  } catch (error: any) {
    console.error('Error finalizing order:', error);
  }
}

export async function processWhatsAppMessageSimple(value: any): Promise<void> {
  try {
    console.log('🎯 MULTI-TENANT PROCESSOR - Processing webhook');
    console.log('📦 WEBHOOK PAYLOAD:', JSON.stringify(value, null, 2));
    
    // Step 1: Extract phoneNumberId from webhook metadata (correct structure)
    const phoneNumberId = value.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    console.log('📱 EXTRACTED PHONE NUMBER ID:', phoneNumberId);
    
    if (!phoneNumberId) {
      console.log('❌ NO PHONE NUMBER ID - Skipping processing');
      console.log('🔍 DEBUGGING - Available data structure:');
      console.log('Entry length:', value.entry?.length);
      console.log('Changes length:', value.entry?.[0]?.changes?.length);
      console.log('Value exists:', !!value.entry?.[0]?.changes?.[0]?.value);
      console.log('Metadata exists:', !!value.entry?.[0]?.changes?.[0]?.value?.metadata);
      console.log('Full metadata:', JSON.stringify(value.entry?.[0]?.changes?.[0]?.value?.metadata));
      return;
    }
    
    // Step 2: Find which store owns this phoneNumberId - USANDO FUNCIÓN DINÁMICA
    const storeMapping = await findStoreByPhoneNumberId(phoneNumberId);
    
    if (!storeMapping) {
      console.log('❌ STORE NOT FOUND - No store configured for phoneNumberId:', phoneNumberId);
      await storage.addWhatsAppLog({
        type: 'warning',
        phoneNumber: 'system',
        messageContent: `No se encontró tienda para el número ${phoneNumberId}`,
        status: 'failed'
      });
      return;
    }
    
    console.log('✅ STORE FOUND - Store ID:', storeMapping.storeId, 'Store Name:', storeMapping.storeName);
    
    // Step 3: Extract messages from the correct webhook structure
    const messages = value.entry?.[0]?.changes?.[0]?.value?.messages;
    
    if (messages && messages.length > 0) {
      for (const message of messages) {
        const from = message.from;
        const messageId = message.id;
        const messageType = message.type;
        
        let messageText = '';
        if (messageType === 'text') {
          messageText = message.text.body;
        } else if (messageType === 'location') {
          const location = message.location;
          messageText = location.name || location.address || 
            `Ubicación GPS: ${location.latitude}, ${location.longitude}`;
        } else if (messageType === 'interactive') {
          if (message.interactive.type === 'button_reply') {
            messageText = message.interactive.button_reply.id;
          }
        } else {
          messageText = `[${messageType}] Mensaje no soportado`;
        }

        console.log(`Message from ${from}: ${messageText}`);

        // Step 3: Create tenant storage for the identified store  
        const { getTenantDb } = await import('./multi-tenant-db.js');
        const tenantDb = await getTenantDb(storeMapping.storeId);
        console.log('🔍 TENANT DB OBJECT:', typeof tenantDb, tenantDb ? 'exists' : 'null');
        const tenantStorage = createTenantStorage(tenantDb, storeMapping.storeId);
        console.log('🏪 TENANT STORAGE CREATED - For store:', storeMapping.storeId);

        // Log the incoming message in global logs
        await storage.addWhatsAppLog({
          type: 'info',
          phoneNumber: from,
          messageContent: `Mensaje recibido en tienda ${storeMapping.storeName}: ${messageText}`,
          messageId: messageId,
          status: 'received',
          rawData: JSON.stringify(message)
        });

        // Step 4: Get or create customer in tenant schema
      // 🔧 VERSIÓN MEJORADA - Manejo seguro de clientes con protección contra duplicados

let customer = await tenantStorage.getCustomerByPhone(from);

if (!customer) {
  console.log('➕ CREATING NEW CUSTOMER - In tenant schema');
  
  try {
    // 🔄 VERIFICACIÓN ADICIONAL ANTES DE CREAR (evita race conditions)
    customer = await tenantStorage.getCustomerByPhone(from);
    
    if (customer) {
      console.log('✅ CUSTOMER FOUND ON RETRY - Using existing customer:', customer.id);
    } else {
      // ✨ CREAR CLIENTE CON MANEJO DE ERRORES ROBUSTO
      customer = await tenantStorage.createCustomer({
        name: `Cliente ${from.slice(-4)}`,
        phone: from, // ⚠️ Asegúrate que sea "phone" y no "phoneNumber" según tu esquema
        whatsappId: from,
        address: null,
        latitude: null,
        longitude: null,
        lastContact: new Date(),
        registrationDate: new Date(),
        totalOrders: 0,
        totalSpent: "0.00", // ⚠️ String, no number según tu esquema
        isVip: false,
        notes: 'Cliente creado automáticamente desde WhatsApp',
        mapLink: null
      });
      
      console.log('✅ NEW CUSTOMER CREATED - ID:', customer.id);
      
      await storage.addWhatsAppLog({
        type: 'info',
        phoneNumber: from,
        messageContent: `Nuevo cliente creado en tienda ${storeMapping.storeId}`,
        status: 'customer_created'
      });
    }
    
  } catch (error: any) {
    console.error('❌ ERROR CREATING CUSTOMER:', error);
    
    // 🚨 MANEJO ESPECÍFICO DE ERRORES DE CLAVE DUPLICADA
    if (error.message?.includes('duplicate key') || 
        error.message?.includes('unique constraint') || 
        error.code === '23505') {
      
      console.log('🔄 DUPLICATE KEY ERROR - Attempting to fetch existing customer');
      
      // Intentar obtener el cliente existente
      customer = await tenantStorage.getCustomerByPhone(from);
      
      if (customer) {
        console.log('✅ EXISTING CUSTOMER RETRIEVED - ID:', customer.id);
        
        // Actualizar lastContact del cliente existente
        await tenantStorage.updateCustomer(customer.id, {
          lastContact: new Date()
        });
        
      } else {
        console.error('❌ FATAL: Could not create or retrieve customer');
        throw new Error(`Failed to create or retrieve customer for phone: ${from}`);
      }
    } else {
      // Re-lanzar el error si no es de duplicación
      throw error;
    }
  }
} else {
  console.log('✅ EXISTING CUSTOMER FOUND - ID:', customer.id);
  
  // 🔄 ACTUALIZAR ÚLTIMO CONTACTO DEL CLIENTE EXISTENTE
  try {
    await tenantStorage.updateCustomer(customer.id, {
      lastContact: new Date()
    });
  } catch (updateError) {
    console.error('⚠️ WARNING: Could not update customer lastContact:', updateError);
    // No es crítico, continúa el procesamiento
  }
}

// ✅ VERIFICACIÓN FINAL
if (!customer) {
  throw new Error('Customer processing failed - no customer available');
}

console.log(`👤 CUSTOMER READY - ID: ${customer.id}, Phone: ${customer.phone}`);

        // Step 5: Get or create conversation in tenant schema
        let conversation = await tenantStorage.getConversationByCustomerPhone(from);
        
        if (!conversation) {
          conversation = await tenantStorage.createConversation({
            customerId: customer.id,
            orderId: null,
            status: 'active',
            lastMessageAt: new Date(),
            conversationType: 'initial'
          });
          
          console.log('📞 NEW CONVERSATION CREATED - ID:', conversation.id);
        } else {
          console.log('📞 EXISTING CONVERSATION - ID:', conversation.id);
        }

        // Step 6: Create message in tenant schema
       // ✅ CÓDIGO CORREGIDO para whatsapp-simple.ts
await tenantStorage.createMessage({
  conversationId: conversation.id,
  senderId: customer.id,
  senderType: 'customer',
  content: messageText,
  messageType: messageType || 'text',
  whatsappMessageId: messageId,
  isRead: false
  // Elimina 'timestamp' - se usa 'sentAt' automáticamente
});

        console.log('💌 MESSAGE STORED - In tenant schema');

        // Step 7A: PRIORITY - Check for active registration flows
        console.log('⚠️ Registration flow checks temporarily disabled - Processing as normal auto-response');

        // Step 7B: PRIORITY - Check if message is a structured order from web catalog
        const isOrder = await isOrderMessage(messageText);
        
        if (isOrder) {
          await storage.addWhatsAppLog({
            type: 'info',
            phoneNumber: from,
            messageContent: 'Mensaje de pedido detectado desde catálogo web - PRIMERA CONVERSACIÓN',
            status: 'processing',
            rawData: JSON.stringify({ 
              customerId: customer.id,
              messageLength: messageText.length,
              storeId: storeMapping.storeId
            })
          });

          // ✅ CORREGIDO: Pasar phoneNumberId en lugar de storeMapping.phoneNumberId
          await processWebCatalogOrderSimple(customer, from, messageText, storeMapping.storeId, phoneNumberId, tenantStorage);
          return; // Stop processing here - order handled
        }

        // Step 8: Process message using configured auto-responses - STORE-SPECIFIC VALIDATION
        try {
          await processConfiguredAutoResponse(messageText, from, customer, tenantStorage, storeMapping);
        } catch (error) {
          console.error('❌ ERROR PROCESSING AUTO-RESPONSE:', error);
          
          // ✅ CORREGIDO: Obtener configuración desde base de datos en lugar de storeMapping.whatsappConfig
          console.log('🔧 GETTING WHATSAPP CONFIG FROM DATABASE - Store ID:', storeMapping.storeId);
          
          try {
            const whatsappConfig = await storage.getWhatsAppConfig(storeMapping.storeId);
            
            if (!whatsappConfig) {
              console.error('❌ NO WHATSAPP CONFIG FOUND - Store ID:', storeMapping.storeId);
              await storage.addWhatsAppLog({
                type: 'error',
                phoneNumber: from,
                messageContent: `No se encontró configuración de WhatsApp para la tienda ${storeMapping.storeId}`,
                status: 'failed',
                errorMessage: 'Missing WhatsApp configuration'
              });
              return;
            }

            console.log('✅ WHATSAPP CONFIG FOUND - Sending fallback message');
            
            const fallbackPayload = {
              messaging_product: 'whatsapp',
              to: from,
              type: 'text',
              text: {
                body: `¡Hola! Recibimos tu mensaje: "${messageText}". El sistema está funcionando correctamente.`
              }
            };

            const response = await fetch(`https://graph.facebook.com/v21.0/${whatsappConfig.phoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${whatsappConfig.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(fallbackPayload),
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('❌ FALLBACK MESSAGE FAILED:', errorText);
              
              await storage.addWhatsAppLog({
                type: 'error',
                phoneNumber: from,
                messageContent: 'Error enviando mensaje de fallback',
                status: 'failed',
                errorMessage: errorText
              });
            } else {
              console.log('✅ FALLBACK MESSAGE SENT SUCCESSFULLY');
              
              await storage.addWhatsAppLog({
                type: 'outgoing',
                phoneNumber: from,
                messageContent: fallbackPayload.text.body,
                status: 'sent',
                rawData: JSON.stringify(fallbackPayload)
              });
            }
            
          } catch (configError) {
            console.error('❌ ERROR GETTING WHATSAPP CONFIG:', configError);
            
            await storage.addWhatsAppLog({
              type: 'error',
              phoneNumber: from,
              messageContent: 'Error crítico obteniendo configuración de WhatsApp',
              status: 'failed',
              errorMessage: configError instanceof Error ? configError.message : 'Unknown config error'
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('🚨 CRITICAL ERROR IN WHATSAPP PROCESSOR:', error);
    
    // Log error crítico
    await storage.addWhatsAppLog({
      type: 'error',
      phoneNumber: 'system',
      messageContent: 'Error crítico en el procesador de WhatsApp',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      rawData: JSON.stringify({ 
        error: error instanceof Error ? error.stack : error,
        webhookPayload: value 
      })
    });
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

// Simplified order processing for tenant storage
async function processWebCatalogOrderSimple(customer: any, phoneNumber: string, orderText: string, storeId: number, phoneNumberId: string, tenantStorage: any) {
  try {
    const { storage } = await import('./storage_bk.js');
    
    await storage.addWhatsAppLog({
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

    // Create order in tenant system
    const orderNumber = `ORD-${Date.now()}`;
    const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Create order in tenant schema
    const order = await tenantStorage.createOrder({
      orderNumber: orderNumber,
      customerId: customer.id,
      totalAmount: total.toString(),
      status: 'pending',
      notes: `Pedido generado automáticamente desde catálogo web.\nTotal: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create order items in tenant schema - find or create products first
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
            const productBTUValue = productBTU[1].toLowerCase().replace('k', '000');
            const itemBTUValue = itemBTU[1].toLowerCase().replace('k', '000');
            
            if (productBTUValue === itemBTUValue && 
                (productName.includes('aire') || productName.includes('split') || productName.includes('acondicionado')) &&
                (itemName.includes('aire') || itemName.includes('acondicionado'))) {
              return true;
            }
          }
          
          return false;
        });
        
        if (existingProduct) {
          productId = existingProduct.id;
          
          await storage.addWhatsAppLog({
            type: 'debug',
            phoneNumber: phoneNumber,
            messageContent: `Producto encontrado: "${item.name}" → "${existingProduct.name}" (ID: ${productId})`,
            status: 'processing'
          });
        } else {
          // Create new product
          const newProduct = await tenantStorage.createProduct({
            name: item.name,
            price: item.price.toString(),
            category: 'product', // Default category for web catalog items
            description: `Producto creado automáticamente desde pedido web: ${item.name}`,
            status: 'active',
            availability: 'in_stock',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          productId = newProduct.id;
          
          await storage.addWhatsAppLog({
            type: 'info',
            phoneNumber: phoneNumber,
            messageContent: `Nuevo producto creado: "${item.name}" (ID: ${productId})`,
            status: 'processing'
          });
        }
      }

      await tenantStorage.createOrderItem({
        orderId: order.id,
        productId: productId,
        quantity: item.quantity,
        unitPrice: item.price.toString(),
        totalPrice: (item.price * item.quantity).toString()
      });
    }

    // Send configured auto-response for order received
    await sendAutoResponseMessage(phoneNumber, 'order_received', storeId, tenantStorage, {
      customerName: customer.name,
      orderItems: orderItems.map((item, index) => 
        `${index + 1}. ${item.name} (Cantidad: ${item.quantity})`
      ).join('\n'),
      subtotal: total.toLocaleString('es-MX', { minimumFractionDigits: 2 }),
      deliveryCost: '0.00', // Will be calculated later with address
      totalAmount: total.toLocaleString('es-MX', { minimumFractionDigits: 2 })
    });

    await storage.addWhatsAppLog({
      type: 'success',
      phoneNumber: phoneNumber,
      messageContent: `Pedido ${orderNumber} creado exitosamente con ${orderItems.length} productos`,
      status: 'completed',
      rawData: JSON.stringify({ 
        orderId: order.id,
        orderNumber: orderNumber,
        total: total,
        itemsCount: orderItems.length
      })
    });

    // INICIAR FLUJO DE RECOLECCIÓN DE DATOS DEL CLIENTE
    // Temporarily disabled due to SQL syntax errors
    console.log('⚠️ Registration flow creation temporarily disabled - Sending simple confirmation');

    // Step 2: Send simple confirmation instead
    await sendAutoResponseMessage(phoneNumber, 'order_received', storeId, tenantStorage, {
      customerName: customer.name || 'Cliente',
      subtotal: `$${total.toLocaleString('es-MX')}`,
      deliveryCost: '$0',
      totalAmount: `$${total.toLocaleString('es-MX')}`,
      estimatedTime: '2-3 días hábiles'
    });

  } catch (error: any) {
    console.error('Error processing web catalog order:', error);
    const { storage } = await import('./storage_bk.js');
    await storage.addWhatsAppLog({
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

// Direct WhatsApp message sending
async function sendWhatsAppMessageDirect(phoneNumber: string, message: string, storeId: number) {
  try {
    const { storage } = await import('./storage_bk.js');
    const config = await storage.getWhatsAppConfig(storeId);
    
    if (!config) {
      throw new Error('WhatsApp configuration not found');
    }

    const messagePayload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: { body: message }
    };

    const response = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    const result = await response.json();
    console.log('WhatsApp message sent:', result);

    return response.ok;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}
