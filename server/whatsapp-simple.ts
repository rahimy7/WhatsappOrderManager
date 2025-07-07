// Multi-tenant WhatsApp processor with simplified routing
import { storage } from './storage.js';
import { createTenantStorage } from './multi-tenant-db.js';

// Function to find store by phoneNumberId across all tenant schemas
async function findStoreByPhoneNumberId(phoneNumberId: string) {
  try {
    // Get all virtual stores from global DB
    const stores = await storage.db.query(`
      SELECT id, name, schema_name, is_active 
      FROM virtual_stores 
      WHERE is_active = true
    `);
    
    // Search each tenant schema for matching phoneNumberId
    for (const store of stores.rows) {
      try {
        const result = await storage.db.query(`
          SELECT phone_number_id, access_token, is_active 
          FROM ${store.schema_name}.whatsapp_settings 
          WHERE phone_number_id = $1 AND is_active = true
          LIMIT 1
        `, [phoneNumberId]);
        
        if (result.rows.length > 0) {
          console.log(`🎯 MATCH FOUND - Store: ${store.name} (ID: ${store.id}) has phoneNumberId: ${phoneNumberId}`);
          return {
            storeId: store.id,
            storeName: store.name,
            schema: store.schema_name,
            phoneNumberId: result.rows[0].phone_number_id,
            accessToken: result.rows[0].access_token
          };
        }
      } catch (schemaError) {
        console.log(`⚠️ SCHEMA ERROR - Store ${store.name}: ${schemaError.message}`);
        continue;
      }
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
        const tenantStorage = await createTenantStorage(storage.db, storeMapping.storeId);
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

        // Step 7: Process auto-response based on message content
        try {
          // Check for auto-responses in tenant schema
          let autoResponse = null;
          const messageTextLower = messageText.toLowerCase().trim();
          
          // Look for exact trigger matches in tenant schema
          const autoResponses = await tenantStorage.getAllAutoResponses();
          console.log(`🔍 AUTO-RESPONSE DEBUG - Store ${storeMapping.storeId}: Found ${autoResponses.length} auto-responses`);
          
          autoResponse = autoResponses.find((resp: any) => 
            resp.isActive && resp.trigger.toLowerCase() === messageTextLower
          );
          
          // If no exact match, check for welcome trigger on any first message
          if (!autoResponse) {
            autoResponse = autoResponses.find((resp: any) => 
              resp.isActive && resp.trigger === 'welcome'
            );
          }

          let responseText = `¡Hola! Recibimos tu mensaje: "${messageText}". El sistema está funcionando correctamente.`;
          
          if (autoResponse) {
            console.log(`✅ AUTO-RESPONSE FOUND - Store ${storeMapping.storeId}: ${autoResponse.name} (ID: ${autoResponse.id})`);
            responseText = autoResponse.messageText || responseText;
          }

          // Send response using store's WhatsApp configuration
          const response = await fetch(`https://graph.facebook.com/v21.0/${storeMapping.phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${storeMapping.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: from,
              type: 'text',
              text: {
                body: responseText
              }
            })
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