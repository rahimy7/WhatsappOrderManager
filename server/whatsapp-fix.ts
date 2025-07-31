import { getMasterStorage } from "./storage/index";


export async function testWhatsAppConnection(storeId?: number) {
  try {
    const masterStorage = getMasterStorage();
    
    // Get WhatsApp config - you need to provide a storeId
    if (!storeId) {
      throw new Error('Store ID is required to test WhatsApp connection');
    }
    
    const config = await masterStorage.getWhatsAppConfig(storeId);
    
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
      await masterStorage.addWhatsAppLog({
        type: 'success',
        phoneNumber: null,
        messageContent: 'Conexión a WhatsApp Business API exitosa',
        status: 'connected',
        storeId: storeId,
        rawData: JSON.stringify({ status: 'connected', timestamp: new Date() })
      });

      return {
        connected: true,
        configured: true,
        message: "Connected to WhatsApp Business API"
      };
    } else {
      const error = await response.text();
      await masterStorage.addWhatsAppLog({
        type: 'error',
        phoneNumber: null,
        messageContent: 'Error de conexión a WhatsApp Business API',
        status: 'error',
        errorMessage: error,
        storeId: storeId,
        rawData: JSON.stringify({ error, status: response.status })
      });

      return {
        connected: false,
        configured: true,
        message: `Connection failed: ${error}`
      };
    }
  } catch (error) {
    const masterStorage = getMasterStorage();
    await masterStorage.addWhatsAppLog({
      type: 'error',
      phoneNumber: null,
      messageContent: 'Error interno al probar conexión WhatsApp',
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      storeId: storeId || 0,
      rawData: JSON.stringify({ error: error instanceof Error ? error.message : error })
    });

    return {
      connected: false,
      configured: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export function getWebhookUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
  return domain ? `https://${domain}/webhook` : 'https://tu-dominio-replit.com/webhook';
}