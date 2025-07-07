// Multi-tenant WhatsApp processor with simplified routing
import { storage } from './storage.js';
import { createTenantStorage } from './tenant-storage.js';

// Multi-tenant phone number ID mapping for both stores
async function findStoreByPhoneNumberId(phoneNumberId: string) {
  try {
    console.log(`🔍 SEARCHING FOR STORE - phoneNumberId: ${phoneNumberId}`);
    
    // Check if it's MASQUESALUD phoneNumberId
    if (phoneNumberId === '690329620832620') {
      console.log(`🎯 MATCH FOUND - MASQUESALUD Store (ID: 5) has phoneNumberId: ${phoneNumberId}`);
      return {
        storeId: 5,
        storeName: 'MASQUESALUD',
        schema: 'store_1751554718287',
        phoneNumberId: phoneNumberId,
        accessToken: 'EAAKHVoxT6IUBPDCXf3uokdOCFlyGVwWd5l0jAPX5w4NBqmHmKal9AZBgyfAxT6r9EQjRL3o5vD6wKHlAfiI8eK4tCBP7x6FV4KydN2XxWZBPSe9DwWyBjIqwbuvyalv3HBbAyzjiBPiaJPxylS8x8yTUgrqbmfdHj9L8Cxq03VKZBC7EUD3eLZCL1M6iYbB20tCXqUG8zLjgLW8j3KGZB9Rs8C7Dc2bHBlMeQOCHDVsqOXSRme6jvvhvq9FAbkgZDZD'
      };
    }
    
    // Check if it's RVR SERVICE phoneNumberId
    if (phoneNumberId === '667993026397854') {
      console.log(`🎯 MATCH FOUND - RVR SERVICE Store (ID: 4) has phoneNumberId: ${phoneNumberId}`);
      return {
        storeId: 4,
        storeName: 'RVR SERVICE',
        schema: 'store_1751248005649',
        phoneNumberId: phoneNumberId,
        accessToken: 'EAAKHVoxT6IUBPDCXf3uokdOCFlyGVwWd5l0jAPX5w4NBqmHmKal9AZBgyfAxT6r9EQjRL3o5vD6wKHlAfiI8eK4tCBP7x6FV4KydN2XxWZBPSe9DwWyBjIqwbuvyalv3HBbAyzjiBPiaJPxylS8x8yTUgrqbmfdHj9L8Cxq03VKZBC7EUD3eLZCL1M6iYbB20tCXqUG8zLjgLW8j3KGZB9Rs8C7Dc2bHBlMeQOCHDVsqOXSRme6jvvhvq9FAbkgZDZD'
      };
    }
    
    // Check for legacy/test phone number ID (backward compatibility)
    if (phoneNumberId === '766302823222313') {
      console.log(`🎯 LEGACY MATCH - Using old phoneNumberId ${phoneNumberId}, mapping to MASQUESALUD Store (ID: 5)`);
      return {
        storeId: 5,
        storeName: 'MASQUESALUD',
        schema: 'store_1751554718287',
        phoneNumberId: '690329620832620', // Use current production phone number ID
        accessToken: 'EAAKHVoxT6IUBPDCXf3uokdOCFlyGVwWd5l0jAPX5w4NBqmHmKal9AZBgyfAxT6r9EQjRL3o5vD6wKHlAfiI8eK4tCBP7x6FV4KydN2XxWZBPSe9DwWyBjIqwbuvyalv3HBbAyzjiBPiaJPxylS8x8yTUgrqbmfdHj9L8Cxq03VKZBC7EUD3eLZCL1M6iYbB20tCXqUG8zLjgLW8j3KGZB9Rs8C7Dc2bHBlMeQOCHDVsqOXSRme6jvvhvq9FAbkgZDZD'
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

        // Step 7A: PRIORITY - Check for active registration flows
        const registrationFlow = await tenantStorage.getRegistrationFlowByCustomerId(customer.id);
        
        if (registrationFlow && registrationFlow.currentStep) {
          console.log(`🔄 ACTIVE REGISTRATION FLOW DETECTED - Customer: ${customer.id}, Step: ${registrationFlow.currentStep}`);
          
          // Check if this is an interactive button response
          let finalMessage = messageText;
          if (messageType === 'interactive') {
            // Extract button value from interactive message
            const interactiveData = value.messages[0].interactive;
            if (interactiveData?.button_reply?.id) {
              finalMessage = interactiveData.button_reply.id;
              console.log(`🔘 INTERACTIVE BUTTON PRESSED: ${finalMessage}`);
            }
          }
          
          await handleRegistrationFlow(customer, finalMessage, registrationFlow, storeMapping.storeId, tenantStorage);
          return; // Stop processing here - flow handled
        }

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

          await processWebCatalogOrderSimple(customer, from, messageText, storeMapping.storeId, storeMapping.phoneNumberId, tenantStorage);
          return; // Stop processing here - order handled
        }

        // Step 8: Process auto-response based on message content - STORE-SPECIFIC VALIDATION
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
          
          // CRITICAL: Handle button interactions by checking actions
          if (!autoResponse) {
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
                  // Ignore JSON parse errors
                }
              }
            }
          }
          
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

// Function to detect if a message is a structured order from web catalog
async function isOrderMessage(text: string): Promise<boolean> {
  const orderIndicators = [
    '🛍️ *NUEVO PEDIDO',
    'NUEVO PEDIDO',
    'Cantidad:',
    'Precio unitario:',
    'Subtotal:',
    '*TOTAL:',
    'confirma tu pedido'
  ];
  
  const indicatorCount = orderIndicators.reduce((count, indicator) => {
    return count + (text.includes(indicator) ? 1 : 0);
  }, 0);
  
  return indicatorCount >= 3; // At least 3 indicators to be considered an order
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
    const { storage } = await import('./storage.js');
    
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

    // Send confirmation message
    let confirmationMessage = `✅ *PEDIDO RECIBIDO*\n\n`;
    confirmationMessage += `📋 *Número:* ${orderNumber}\n`;
    confirmationMessage += `👤 *Cliente:* ${customer.name}\n\n`;
    confirmationMessage += `🛍️ *Productos:*\n`;
    
    orderItems.forEach((item, index) => {
      confirmationMessage += `${index + 1}. ${item.name}\n`;
      confirmationMessage += `   Cantidad: ${item.quantity}\n`;
      confirmationMessage += `   Precio: $${item.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n\n`;
    });
    
    confirmationMessage += `💰 *Total: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}*\n\n`;
    confirmationMessage += `📞 Nuestro equipo te contactará pronto para confirmar los detalles de entrega.\n\n`;
    confirmationMessage += `¡Gracias por tu pedido! 🎯`;

    await sendWhatsAppMessageDirect(phoneNumber, confirmationMessage, storeId);

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
    // Step 1: Iniciar flujo de registro para recopilar datos del cliente
    await tenantStorage.createOrUpdateRegistrationFlow({
      customerId: customer.id,
      flowType: 'order_completion',
      currentStep: 'collect_name',
      orderId: order.id,
      collectedData: JSON.stringify({
        orderNumber: orderNumber,
        totalAmount: total
      }),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
    });

    // Step 2: Enviar solicitud de nombre usando respuesta automática
    await sendAutoResponseMessage(phoneNumber, 'collect_name', storeId, tenantStorage);

  } catch (error: any) {
    console.error('Error processing web catalog order:', error);
    const { storage } = await import('./storage.js');
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
    const { storage } = await import('./storage.js');
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

/**
 * Envía un mensaje de respuesta automática basado en el trigger
 */
async function sendAutoResponseMessage(phoneNumber: string, trigger: string, storeId: number, tenantStorage: any) {
  try {
    console.log(`🔄 SENDING AUTO RESPONSE - Trigger: ${trigger}, Phone: ${phoneNumber}`);
    
    // Buscar respuesta automática por trigger
    const autoResponse = await tenantStorage.getAutoResponseByTrigger(trigger);
    if (!autoResponse) {
      console.log(`❌ NO AUTO RESPONSE FOUND - Trigger: ${trigger}`);
      return false;
    }

    console.log(`✅ AUTO RESPONSE FOUND - Message: ${autoResponse.message}`);

    // Enviar mensaje principal
    await sendWhatsAppMessageDirect(phoneNumber, autoResponse.message, storeId);

    // Si tiene botones interactivos, enviarlos también
    if (autoResponse.isInteractive && autoResponse.interactiveData) {
      try {
        const interactiveData = JSON.parse(autoResponse.interactiveData);
        if (interactiveData.buttons && interactiveData.buttons.length > 0) {
          // Construir mensaje interactivo
          const { storage } = await import('./storage.js');
          const config = await storage.getWhatsAppConfig(storeId);
          
          if (config) {
            const interactiveMessage = {
              messaging_product: "whatsapp",
              to: phoneNumber,
              type: "interactive",
              interactive: {
                type: "button",
                body: { text: autoResponse.message },
                action: {
                  buttons: interactiveData.buttons.map((button: any, index: number) => ({
                    type: "reply",
                    reply: {
                      id: button.id || `btn_${index}`,
                      title: button.title.substring(0, 20) // WhatsApp limit
                    }
                  }))
                }
              }
            };

            const response = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(interactiveMessage)
            });
            
            const responseData = await response.json();
            console.log('✅ INTERACTIVE MESSAGE SENT:', responseData);
          }
        }
      } catch (parseError) {
        console.log('⚠️ Error parsing interactive data, sending text only');
      }
    }

    return true;
  } catch (error) {
    console.error('❌ ERROR SENDING AUTO RESPONSE:', error);
    return false;
  }
}

/**
 * Maneja el flujo de registro para recopilar datos del cliente
 */
async function handleRegistrationFlow(customer: any, messageText: string, flow: any, storeId: number, tenantStorage: any) {
  try {
    console.log(`📝 PROCESSING REGISTRATION FLOW - Step: ${flow.currentStep}, Customer: ${customer.id}`);
    
    const collectedData = flow.collectedData ? JSON.parse(flow.collectedData) : {};
    const currentStep = flow.currentStep;
    
    switch (currentStep) {
      case 'collect_name':
        // Validar nombre (mínimo 3 caracteres)
        if (messageText.trim().length >= 3) {
          collectedData.customerName = messageText.trim();
          
          // Actualizar nombre del cliente en la base de datos
          await tenantStorage.updateCustomer(customer.id, { name: messageText.trim() });
          
          console.log(`✅ NAME COLLECTED: ${messageText.trim()}`);
          
          // Avanzar al siguiente paso
          await tenantStorage.updateRegistrationFlowStep(
            customer.id, 
            'collect_address', 
            JSON.stringify(collectedData)
          );
          
          // Enviar solicitud de dirección
          await sendAutoResponseMessage(customer.phone, 'collect_address', storeId, tenantStorage);
        } else {
          console.log(`❌ INVALID NAME: ${messageText} (too short)`);
          await sendWhatsAppMessageDirect(customer.phone, 
            "Por favor proporciona tu nombre completo (mínimo 3 caracteres).", storeId);
        }
        break;
        
      case 'collect_address':
        collectedData.address = messageText.trim();
        
        console.log(`✅ ADDRESS COLLECTED: ${messageText.trim()}`);
        
        // Actualizar dirección del cliente
        await tenantStorage.updateCustomer(customer.id, { address: messageText.trim() });
        
        // Avanzar al siguiente paso
        await tenantStorage.updateRegistrationFlowStep(
          customer.id, 
          'collect_contact', 
          JSON.stringify(collectedData)
        );
        
        // Enviar solicitud de confirmación de número
        await sendAutoResponseMessage(customer.phone, 'collect_contact', storeId, tenantStorage);
        break;
        
      case 'collect_contact':
        // Manejar botones interactivos para contacto
        if (messageText === 'use_current') {
          collectedData.contactPhone = customer.phone; // Usar el número de WhatsApp actual
          console.log(`✅ CONTACT CONFIRMED (WhatsApp): ${customer.phone}`);
        } else if (messageText === 'use_other') {
          // Solicitar otro número
          await sendWhatsAppMessageDirect(customer.phone, 
            "📞 Por favor escribe el número de contacto que prefieres usar (10 dígitos):", storeId);
          
          // Cambiar paso para recopilar el número específico
          await tenantStorage.updateRegistrationFlowStep(
            customer.id, 
            'collect_custom_phone', 
            JSON.stringify(collectedData)
          );
          return;
        } else {
          // Si es texto directo, asumir que es confirmación del número actual
          collectedData.contactPhone = customer.phone;
          console.log(`✅ CONTACT CONFIRMED (default): ${customer.phone}`);
        }
        
        // Avanzar al siguiente paso
        await tenantStorage.updateRegistrationFlowStep(
          customer.id, 
          'collect_payment', 
          JSON.stringify(collectedData)
        );
        
        // Enviar opciones de pago
        await sendAutoResponseMessage(customer.phone, 'collect_payment', storeId, tenantStorage);
        break;

      case 'collect_custom_phone':
        // Validar número de teléfono (10 dígitos)
        const phoneRegex = /^\d{10}$/;
        const cleanPhone = messageText.replace(/\D/g, '');
        
        if (phoneRegex.test(cleanPhone)) {
          collectedData.contactPhone = cleanPhone;
          console.log(`✅ CUSTOM CONTACT SET: ${cleanPhone}`);
          
          // Avanzar al siguiente paso
          await tenantStorage.updateRegistrationFlowStep(
            customer.id, 
            'collect_payment', 
            JSON.stringify(collectedData)
          );
          
          // Enviar opciones de pago
          await sendAutoResponseMessage(customer.phone, 'collect_payment', storeId, tenantStorage);
        } else {
          console.log(`❌ INVALID PHONE: ${messageText}`);
          await sendWhatsAppMessageDirect(customer.phone, 
            "Por favor proporciona un número válido de 10 dígitos.", storeId);
        }
        break;
        
      case 'collect_payment':
        // Manejar botones interactivos para método de pago
        let paymentMethodText = messageText;
        
        if (messageText === 'payment_card') {
          paymentMethodText = 'Tarjeta de Crédito/Débito';
        } else if (messageText === 'payment_transfer') {
          paymentMethodText = 'Transferencia Bancaria';
        } else if (messageText === 'payment_cash') {
          paymentMethodText = 'Efectivo en entrega';
        }
        
        collectedData.paymentMethod = paymentMethodText;
        
        console.log(`✅ PAYMENT METHOD SELECTED: ${paymentMethodText}`);
        
        // Avanzar al paso final
        await tenantStorage.updateRegistrationFlowStep(
          customer.id, 
          'collect_notes', 
          JSON.stringify(collectedData)
        );
        
        // Enviar solicitud de notas adicionales
        await sendAutoResponseMessage(customer.phone, 'collect_notes', storeId, tenantStorage);
        break;
        
      case 'collect_notes':
        collectedData.notes = messageText.trim();
        
        console.log(`✅ NOTES COLLECTED: ${messageText.trim()}`);
        
        // Finalizar el flujo
        await completeOrderProcess(customer, flow, collectedData, storeId, tenantStorage);
        break;
        
      default:
        console.log(`❌ UNKNOWN STEP: ${currentStep}`);
        // No enviar mensaje de error al cliente - solo logging interno
    }
    
  } catch (error) {
    console.error('❌ ERROR IN REGISTRATION FLOW:', error);
    // No enviar mensaje de error al cliente - solo logging interno
  }
}

/**
 * Completa el proceso de pedido con todos los datos recopilados
 */
async function completeOrderProcess(customer: any, flow: any, collectedData: any, storeId: number, tenantStorage: any) {
  try {
    console.log(`🎯 COMPLETING ORDER PROCESS - Order ID: ${flow.orderId}`);
    
    // Actualizar la orden con la información recopilada
    const orderNotes = `
    🎯 INFORMACIÓN DEL CLIENTE:
    📋 Nombre: ${collectedData.customerName || 'No proporcionado'}
    📍 Dirección: ${collectedData.address || 'No proporcionada'}
    📞 Contacto: ${collectedData.contactPhone || customer.phone}
    💳 Método de pago: ${collectedData.paymentMethod || 'No especificado'}
    📝 Notas adicionales: ${collectedData.notes || 'Ninguna'}
    
    ⏰ Datos recopilados: ${new Date().toLocaleString('es-MX')}
    `;
    
    // Actualizar estado de la orden
    await tenantStorage.updateOrder(flow.orderId, {
      status: 'confirmed',
      notes: orderNotes
    });
    
    // Enviar confirmación final usando respuesta automática
    await sendAutoResponseMessage(customer.phone, 'order_confirmation', storeId, tenantStorage);
    
    // Eliminar el flujo de registro
    await tenantStorage.deleteRegistrationFlow(customer.id);
    
    console.log(`✅ ORDER PROCESS COMPLETED - Order ${flow.orderId} confirmed`);
    
  } catch (error) {
    console.error('❌ ERROR COMPLETING ORDER:', error);
    await sendWhatsAppMessageDirect(customer.phone, 
      "Hubo un error al confirmar tu pedido. Nuestro equipo se pondrá en contacto contigo.", storeId);
  }
}