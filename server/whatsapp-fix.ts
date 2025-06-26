// Temporary fix for WhatsApp configuration - will be integrated into routes.ts
import { storage } from "./storage";

export async function testWhatsAppConnection() {
  try {
    const config = await storage.getWhatsAppConfig();
    
    if (!config || !config.accessToken || !config.phoneNumberId) {
      return {
        connected: false,
        configured: false,
        message: "WhatsApp credentials not configured"
      };
    }

    // Test connection to WhatsApp Business API
    const response = await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}`, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      await storage.addWhatsAppLog({
        type: 'success',
        phoneNumber: null,
        messageContent: 'Conexión a WhatsApp Business API exitosa',
        status: 'connected',
        rawData: JSON.stringify({ status: 'connected', timestamp: new Date() })
      });

      return {
        connected: true,
        configured: true,
        message: "Connected to WhatsApp Business API"
      };
    } else {
      const error = await response.text();
      await storage.addWhatsAppLog({
        type: 'error',
        phoneNumber: null,
        messageContent: 'Error de conexión a WhatsApp Business API',
        status: 'error',
        errorMessage: error,
        rawData: JSON.stringify({ error, status: response.status })
      });

      return {
        connected: false,
        configured: true,
        message: `Connection failed: ${error}`
      };
    }
  } catch (error) {
    await storage.addWhatsAppLog({
      type: 'error',
      phoneNumber: null,
      messageContent: 'Error interno al probar conexión WhatsApp',
      status: 'error',
      errorMessage: error.message,
      rawData: JSON.stringify({ error: error.message })
    });

    return {
      connected: false,
      configured: false,
      message: `Error: ${error.message}`
    };
  }
}

export function getWebhookUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
  return domain ? `https://${domain}/webhook` : 'https://tu-dominio-replit.com/webhook';
}