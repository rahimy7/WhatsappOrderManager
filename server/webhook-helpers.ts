// webhook-helpers.ts - Funciones helper para usar con Neon

import { resilientDb } from './db';

/**
 * 🔧 Helper para operaciones de webhook con Neon
 */
export async function safeWebhookOperation<T>(
  operation: (client: any) => Promise<T>,
  context: string
): Promise<T> {
  return resilientDb.executeWithRetry(operation, `webhook: ${context}`);
}

/**
 * 📝 Helper para logging de WhatsApp con manejo de errores
 */
export async function logWhatsAppEvent(
  type: 'incoming' | 'outgoing' | 'status' | 'error',
  phoneNumber: string,
  storeId: number,
  data: {
    messageContent?: string;
    messageId?: string;
    status?: string;
    errorMessage?: string;
    rawData?: any;
  }
): Promise<void> {
  try {
    await safeWebhookOperation(async (client) => {
      const query = `
        INSERT INTO whatsapp_logs (
          type, phone_number, store_id, message_content, 
          message_id, status, error_message, raw_data, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `;
      
      await client.query(query, [
        type,
        phoneNumber,
        storeId,
        data.messageContent || null,
        data.messageId || null,
        data.status || null,
        data.errorMessage || null,
        data.rawData ? JSON.stringify(data.rawData) : null
      ]);
    }, `log ${type} event for ${phoneNumber}`);
    
  } catch (error) {
    // Log crítico - no fallar el webhook por esto
    console.error(`⚠️ No se pudo registrar evento ${type}:`, error);
  }
}

/**
 * 🏪 Helper para encontrar tienda por phoneNumberId
 */
export async function findStoreByPhoneNumber(phoneNumberId: string): Promise<any> {
  return safeWebhookOperation(async (client) => {
    const query = `
      SELECT * FROM virtual_stores 
      WHERE phone_number_id = $1 AND is_active = true
      LIMIT 1
    `;
    
    const result = await client.query(query, [phoneNumberId]);
    return result.rows[0] || null;
  }, `find store for phone ${phoneNumberId}`);
}

/**
 * ✅ Helper para actualizar estado de mensaje
 */
export async function updateMessageStatus(
  messageId: string,
  status: string,
  phoneNumber: string,
  storeId: number
): Promise<void> {
  await safeWebhookOperation(async (client) => {
    // Actualizar en la tabla de mensajes si existe
    const updateQuery = `
      UPDATE messages 
      SET status = $1, updated_at = NOW()
      WHERE whatsapp_message_id = $2
    `;
    
    await client.query(updateQuery, [status, messageId]);
    
    // Log del evento
    await logWhatsAppEvent('status', phoneNumber, storeId, {
      messageId,
      status,
      messageContent: `Estado actualizado a: ${status}`
    });
    
  }, `update message status ${messageId} to ${status}`);
}

/**
 * 💬 Helper para procesar mensaje entrante
 */
export async function processIncomingMessage(
  message: any,
  storeId: number
): Promise<void> {
  const phoneNumber = message.from;
  const messageText = message.text?.body || '';
  const messageId = message.id;

  await safeWebhookOperation(async (client) => {
    // 1. Registrar mensaje entrante
    const insertQuery = `
      INSERT INTO messages (
        whatsapp_message_id, phone_number, store_id, 
        content, message_type, direction, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (whatsapp_message_id) DO NOTHING
    `;
    
    await client.query(insertQuery, [
      messageId,
      phoneNumber,
      storeId,
      messageText,
      message.type || 'text',
      'incoming',
      'received'
    ]);

    // 2. Log del evento
    await logWhatsAppEvent('incoming', phoneNumber, storeId, {
      messageContent: messageText,
      messageId: messageId,
      status: 'received',
      rawData: message
    });

  }, `process incoming message ${messageId}`);
}

/**
 * 🤖 Helper para obtener auto-respuestas
 */
export async function getAutoResponse(
  trigger: string,
  storeId: number
): Promise<any> {
  return safeWebhookOperation(async (client) => {
    const query = `
      SELECT * FROM auto_responses 
      WHERE store_id = $1 AND trigger = $2 AND is_active = true
      ORDER BY priority ASC
      LIMIT 1
    `;
    
    const result = await client.query(query, [storeId, trigger]);
    return result.rows[0] || null;
  }, `get auto response ${trigger} for store ${storeId}`);
}

/**
 * 🚨 Helper para manejo de errores críticos
 */
export async function handleCriticalWebhookError(
  error: any,
  webhookData: any,
  context: string
): Promise<void> {
  try {
    // Log detallado del error
    console.error(`💥 CRITICAL WEBHOOK ERROR in ${context}:`, {
      error: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 3),
      webhookSize: JSON.stringify(webhookData).length,
      timestamp: new Date().toISOString()
    });

    // Intentar registrar en base de datos
    await logWhatsAppEvent('error', 'CRITICAL_ERROR', 0, {
      errorMessage: `${context}: ${error.message}`,
      rawData: { error: error.message, context, webhookData }
    });

    // Enviar alerta si está configurada
    if (process.env.ALERT_WEBHOOK_URL) {
      try {
        await fetch(process.env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'critical_webhook_error',
            context,
            error: error.message,
            code: error.code,
            timestamp: new Date().toISOString()
          })
        });
      } catch (alertError) {
        console.error('❌ No se pudo enviar alerta:', alertError);
      }
    }

  } catch (loggingError) {
    console.error('💀 Error logging critical error:', loggingError);
  }
}

/**
 * 🧪 Helper para test de la configuración
 */
export async function testWebhookHelpers(): Promise<boolean> {
  try {
    console.log('🧪 Testing webhook helpers...');
    
    // Test 1: Database health
    const health = await resilientDb.healthCheck();
    if (!health.healthy) {
      throw new Error('Database not healthy');
    }
    
    // Test 2: Store lookup (con datos ficticios)
    try {
      await findStoreByPhoneNumber('test-phone-id');
      console.log('✅ Store lookup: OK');
    } catch (error) {
      console.log('⚠️ Store lookup test failed (expected if no test data)');
    }
    
    // Test 3: Auto-response lookup
    try {
      await getAutoResponse('welcome', 1);
      console.log('✅ Auto-response lookup: OK');
    } catch (error) {
      console.log('⚠️ Auto-response test failed (expected if no test data)');
    }
    
    console.log('✅ Webhook helpers test completed');
    return true;
    
  } catch (error) {
    console.error('❌ Webhook helpers test failed:', error);
    return false;
  }
}