// Multi-tenant WhatsApp processor with simplified routing
import { storage } from './storage.js';
import { createTenantStorage } from './tenant-storage.js';

// Hardcoded approach for MASQUESALUD store specifically
async function findStoreByPhoneNumberId(phoneNumberId: string) {
  try {
    console.log(`🔍 SEARCHING FOR STORE - phoneNumberId: ${phoneNumberId}`);
    
    // Check if it's MASQUESALUD phoneNumberId
    if (phoneNumberId === '766302823222313') {
      console.log(`🎯 MATCH FOUND - MASQUESALUD Store (ID: 5) has phoneNumberId: ${phoneNumberId}`);
      return {
        storeId: 5,
        storeName: 'MASQUESALUD',
        schema: 'store_1751554718287',
        phoneNumberId: phoneNumberId,
        accessToken: 'EAAKHVoxT6IUBPOlZAnR1swyf3ZArSBBSF65ko7LUodPkvtDklaqAxf5FD5oJwWYGSKMmNBWZAULbIlWXDHZBKqHZCYflyckZB9nqVIZAAnPR5qat4cWIZBFtUSFDZBGt6inS45BFqwKWnzVZB0RvPUyNTow7lJOWvf6ECAuC6ZBqfSZCXoZAuqQiMN0di7wRFeCk79hZCtyAZDZD'
      };
    }
    
    return null;
  } catch (error) {
    console.error('🚨 ERROR FINDING STORE:', error);
    return null;
  }
}

// Enhanced multi-tenant WhatsApp message processor
export async function processWhatsAppMessageSimple(value: any): Promise<void> {
  try {
    console.log('🎯 MULTI-TENANT PROCESSOR - Processing webhook');
    
    // Step 1: Extract phoneNumberId from webhook metadata
    const phoneNumberId = value.metadata?.phone_number_id;
    console.log('📱 EXTRACTED PHONE NUMBER ID:', phoneNumberId);
    
    if (!phoneNumberId) {
      console.log('❌ NO PHONE NUMBER ID - Skipping processing');
      return;
    }
    
    // Step 2: Find which store owns this phoneNumberId
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
    
    console.log('✅ STORE FOUND - Store ID:', storeMapping.storeId, 'Schema:', storeMapping.schema);
    
    if (value.messages && value.messages.length > 0) {
      for (const message of value.messages) {
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
        const tenantStorage = createTenantStorage(tenantDb);
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
        let customer = await tenantStorage.getCustomerByPhone(from);
        
        if (!customer) {
          console.log('➕ CREATING NEW CUSTOMER - In tenant schema');
          customer = await tenantStorage.createCustomer({
            name: `Cliente ${from.slice(-4)}`,
            phone: from,
            whatsappId: from,
            address: null,
            latitude: null,
            longitude: null,
            lastContact: new Date(),
            registrationDate: new Date(),
            totalOrders: 0,
            totalSpent: 0,
            isVip: false,
            notes: 'Cliente creado automáticamente desde WhatsApp',
            mapLink: null
          });
          
          await storage.addWhatsAppLog({
            type: 'info',
            phoneNumber: from,
            messageContent: `Nuevo cliente creado en tienda ${storeMapping.storeId}`,
            status: 'customer_created'
          });
        } else {
          console.log('✅ EXISTING CUSTOMER FOUND - ID:', customer.id);
        }

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
        await tenantStorage.createMessage({
          conversationId: conversation.id,
          senderId: customer.id,
          senderType: 'customer',
          content: messageText,
          messageType: messageType as any,
          whatsappMessageId: messageId,
          timestamp: new Date(),
          isRead: false
        });

        console.log('💌 MESSAGE STORED - In tenant schema');

        // Step 7: Process auto-response based on message content - STORE-SPECIFIC VALIDATION
        try {
          // CRITICAL: Use only tenant schema for store-specific auto-responses
          let autoResponse = null;
          const messageTextLower = messageText.toLowerCase().trim();
          
          // Get auto-responses ONLY from tenant schema (store-specific)
          const autoResponses = await tenantStorage.getAllAutoResponses();
          console.log(`🔍 STORE-SPECIFIC AUTO-RESPONSE VALIDATION - Store ${storeMapping.storeId}: Found ${autoResponses.length} tenant auto-responses`);
          
          // VALIDATION: Ensure we're only using responses from this specific store's schema
          if (autoResponses.length === 0) {
            console.log(`⚠️ WARNING - Store ${storeMapping.storeId}: No auto-responses found in tenant schema ${storeMapping.schema}`);
          }
          
          // Look for exact trigger matches in tenant schema ONLY
          autoResponse = autoResponses.find((resp: any) => 
            resp.isActive && resp.trigger.toLowerCase() === messageTextLower
          );
          
          // If no exact match, check for welcome trigger on any first message
          if (!autoResponse) {
            autoResponse = autoResponses.find((resp: any) => 
              resp.isActive && resp.trigger === 'welcome'
            );
          }

          // FALLBACK: Only if no programmed responses exist in tenant schema
          let responseText = null;
          
          if (autoResponse) {
            console.log(`✅ STORE-SPECIFIC AUTO-RESPONSE FOUND - Store ${storeMapping.storeId}: "${autoResponse.name}" (ID: ${autoResponse.id}) from schema ${storeMapping.schema}`);
            console.log(`📝 USING PROGRAMMED MESSAGE: "${autoResponse.messageText.substring(0, 100)}..."`);
            responseText = autoResponse.messageText;
          } else {
            console.log(`❌ NO STORE-SPECIFIC AUTO-RESPONSE - Store ${storeMapping.storeId}: No matching trigger for "${messageText}" in tenant schema`);
            responseText = `¡Hola! Recibimos tu mensaje: "${messageText}". El sistema está funcionando correctamente.`;
          }

          // Send response using database configuration
          const { storage } = await import('./storage');
          const config = await storage.getWhatsAppConfig(storeMapping.storeId);
          
          if (!config) {
            throw new Error('WhatsApp configuration not found in database');
          }

          // CRITICAL FIX: Process interactive buttons from auto-response configuration
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
                    text: responseText
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
                text: { body: responseText }
              };
            }
          } else {
            // Simple text message
            console.log(`📤 SENDING TEXT MESSAGE - Store ${storeMapping.storeId}: No buttons configured`);
            messagePayload = {
              messaging_product: 'whatsapp',
              to: from,
              type: 'text',
              text: { body: responseText }
            };
          }

          const response = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(messagePayload)
          });

          const result = await response.json();
          console.log('WhatsApp API response:', result);

          if (response.ok) {
            await storage.addWhatsAppLog({
              type: 'success',
              phoneNumber: from,
              messageContent: 'Respuesta enviada exitosamente',
              status: 'sent',
              rawData: JSON.stringify(result)
            });
          } else {
            throw new Error(`API Error: ${JSON.stringify(result)}`);
          }
        } catch (error: any) {
          console.error('Error sending WhatsApp message:', error);
          await storage.addWhatsAppLog({
            type: 'error',
            phoneNumber: from,
            messageContent: 'Error enviando respuesta',
            status: 'error',
            errorMessage: error.message,
            rawData: JSON.stringify(error)
          });
        }
      }
    }
  } catch (error: any) {
    console.error('Error in processWhatsAppMessageSimple:', error);
    await storage.addWhatsAppLog({
      type: 'error',
      phoneNumber: null,
      messageContent: 'Error general en procesamiento',
      status: 'error',
      errorMessage: error.message
    });
  }
}