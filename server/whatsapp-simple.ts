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

        // Send a simple test response
        try {
          const response = await fetch(`https://graph.facebook.com/v21.0/667993026397854/messages`, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer EAAKHVoxT6IUBOZCBvpyAorwxPe1O6HXxTuh6xVZCODMQvdORgN6g9q4ujC1bV2stIx4CzgiWeSGaZBNproRbWUUrHcZADXyKxjOcvxNwiEV3SeZC6uP8Nun0fJBikTilZAH5EfGeGZAcuNThZCCwBIyybmk15imXP1Ly3P2YVnmj2cl3GSOviX5gXHZClaOVom0u8NakjR1Xm9gscFpmyHZBSkP9kCctFZC2xVQDp2vRTqF3s5BM8PD4cLMyJy44J39ZCx25',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: from,
              type: 'text',
              text: {
                body: `¡Hola! Recibimos tu mensaje: "${messageText}". El sistema está funcionando correctamente.`
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