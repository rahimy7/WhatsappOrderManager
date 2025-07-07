// Temporary simplified WhatsApp processor
import { storage } from './storage.js';

// Simple working WhatsApp message processor
export async function processWhatsAppMessageSimple(value: any): Promise<void> {
  try {
    console.log('Processing WhatsApp message:', JSON.stringify(value, null, 2));
    
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

        // Log the incoming message
        await storage.addWhatsAppLog({
          type: 'info',
          phoneNumber: from,
          messageContent: `Mensaje recibido: ${messageText}`,
          messageId: messageId,
          status: 'received',
          rawData: JSON.stringify(message)
        });

        // Process auto-response based on message content
        try {
          // Get WhatsApp config from database
          const config = await storage.getWhatsAppConfig();
          if (!config) {
            throw new Error('No WhatsApp configuration found');
          }

          // Check for auto-responses based on message trigger
          let autoResponse = null;
          const messageTextLower = messageText.toLowerCase().trim();
          
          // Look for exact trigger matches
          const autoResponses = await storage.getAllAutoResponses();
          console.log(`🔍 AUTO-RESPONSE DEBUG - Store ${storeId}: Found ${autoResponses.length} auto-responses`);
          
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
            console.log(`✅ AUTO-RESPONSE FOUND - Store ${storeId}: ${autoResponse.name} (ID: ${autoResponse.id})`);
            console.log(`📝 MESSAGE PREVIEW - Store ${storeId}: ${autoResponse.messageText.substring(0, 50)}...`);
            responseText = autoResponse.messageText || responseText;
          }

          const response = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.accessToken}`,
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