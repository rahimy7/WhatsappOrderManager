// webhook/improved-handler.ts - CREAR ESTE ARCHIVO NUEVO

import { NeonResilientDatabase } from '../server/db';
import { getMasterStorage } from '../server/storage/index';

export class ImprovedWebhookHandler {
  private resilientDb: NeonResilientDatabase;
  private processingQueue: Map<string, Promise<void>> = new Map();

  constructor(resilientDb: NeonResilientDatabase) {
    this.resilientDb = resilientDb;
  }

  /**
   * 🚀 MÉTODO PRINCIPAL - Procesa webhook con manejo robusto de errores
   */
  async processWebhook(webhookData: any): Promise<void> {
    // 🔒 Generar ID único para evitar procesamiento duplicado
    const webhookId = this.generateWebhookId(webhookData);
    
    // ⚡ Si ya se está procesando este webhook, esperar
    if (this.processingQueue.has(webhookId)) {
      console.log(`⏳ Webhook ${webhookId} ya en procesamiento, esperando...`);
      await this.processingQueue.get(webhookId);
      return;
    }

    // 🚀 Crear promesa de procesamiento
    const processingPromise = this.safeProcessWebhook(webhookData, webhookId);
    this.processingQueue.set(webhookId, processingPromise);

    try {
      await processingPromise;
    } finally {
      // 🧹 Limpiar del queue
      this.processingQueue.delete(webhookId);
    }
  }

  /**
   * 🔒 Procesamiento interno del webhook con manejo de errores
   */
  private async safeProcessWebhook(webhookData: any, webhookId: string): Promise<void> {
    try {
      console.log(`📥 Procesando webhook ${webhookId}`);
      
      // 🔍 Validar estructura básica
      if (!this.isValidWebhookStructure(webhookData)) {
        throw new Error(`Estructura de webhook inválida: ${webhookId}`);
      }

      // 🏪 Encontrar tienda
      const storeMapping = await this.findStoreMapping(webhookData);
      if (!storeMapping) {
        throw new Error(`No se encontró tienda para webhook ${webhookId}`);
      }

      // 📊 Procesar según tipo de webhook
      const entry = webhookData.entry[0];
      const changes = entry.changes[0];
      const value = changes.value;

      // 📱 Procesar mensajes entrantes
      if (value.messages && Array.isArray(value.messages) && value.messages.length > 0) {
        console.log(`📱 Processing ${value.messages.length} incoming messages`);
        await this.processMessages(value.messages, storeMapping, webhookId);
      }

      // 📊 Procesar estados de mensaje
      if (value.statuses && Array.isArray(value.statuses) && value.statuses.length > 0) {
        console.log(`📊 Processing ${value.statuses.length} message statuses`);
        await this.processStatuses(value.statuses, storeMapping, webhookId);
      }

      console.log(`✅ Webhook ${webhookId} procesado exitosamente`);

    } catch (error: any) {
      console.error(`💥 Error procesando webhook ${webhookId}:`, error);
      
      // 📝 Registrar error en base de datos
      await this.logWebhookError(error, webhookData, webhookId);
      
      // 🔄 Decidir si reintentar o fallar
      if (this.isRetryableWebhookError(error)) {
        console.log(`🔄 Error recuperable en webhook ${webhookId}, pero no reintentando automáticamente`);
        // Nota: Removido auto-retry para evitar loops infinitos
      } else {
        console.error(`🚫 Error no recuperable en webhook ${webhookId}, abandonando`);
      }
      
      // Re-lanzar el error para que Express pueda manejarlo
      throw error;
    }
  }

  /**
   * 📱 Procesa mensajes entrantes con manejo robusto
   */
  private async processMessages(messages: any[], storeMapping: any, webhookId: string): Promise<void> {
    for (const message of messages) {
      try {
        console.log(`📱 Processing message ${message.id} from ${message.from}`);
        
        await this.resilientDb.executeWithRetry(
          async (client) => {
            // 🔄 USAR TU LÓGICA EXISTENTE - Importar y llamar a tu función actual
            const { processIncomingUserMessage } = await import('../server/whatsapp-simple.js');
            
            // Simular la estructura que espera tu función actual
            const mockWebhookData = {
              entry: [{
                changes: [{
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      phone_number_id: storeMapping.phoneNumberId,
                      display_phone_number: storeMapping.displayPhoneNumber
                    },
                    messages: [message]
                  }
                }]
              }]
            };
            
            // Llamar a tu lógica existente
            await processIncomingUserMessage(mockWebhookData, storeMapping);
          },
          `process message ${message.id} (webhook: ${webhookId})`
        );
        
        console.log(`✅ Message ${message.id} processed successfully`);
        
      } catch (error: any) {
        console.error(`❌ Error procesando mensaje ${message.id}:`, error);
        
        // Log del error específico del mensaje
        await this.logMessageError(error, message, storeMapping, webhookId);
        
        // Continuar con el siguiente mensaje en lugar de fallar todo
        continue;
      }
    }
  }

  /**
   * 📊 Procesa estados de mensaje con manejo robusto
   */
  private async processStatuses(statuses: any[], storeMapping: any, webhookId: string): Promise<void> {
    for (const status of statuses) {
      try {
        console.log(`📊 Processing status ${status.status} for message ${status.id}`);
        
        await this.resilientDb.executeWithRetry(
          async (client) => {
            // 🔄 USAR TU LÓGICA EXISTENTE
            const { processMessageStatusUpdate } = await import('../server/whatsapp-simple.js');
            
            // Llamar a tu función existente de procesamiento de estados
            await processMessageStatusUpdate(status, storeMapping);
          },
          `process status ${status.id} (webhook: ${webhookId})`
        );
        
        console.log(`✅ Status for message ${status.id} processed successfully`);
        
      } catch (error: any) {
        console.error(`❌ Error procesando estado ${status.id}:`, error);
        
        // Log del error específico del estado
        await this.logStatusError(error, status, storeMapping, webhookId);
        
        // Continuar con el siguiente estado
        continue;
      }
    }
  }

  /**
   * 🏪 Encuentra el mapeo de tienda para el webhook
   */
  private async findStoreMapping(webhookData: any): Promise<any> {
    const phoneNumberId = webhookData.entry[0].changes[0].value.metadata.phone_number_id;
    
    return await this.resilientDb.executeWithRetry(
      async (client) => {
        const query = `
          SELECT 
            id as storeId,
            name as storeName, 
            phone_number_id as phoneNumberId,
            display_phone_number as displayPhoneNumber,
            is_active as isActive
          FROM virtual_stores 
          WHERE phone_number_id = $1 AND is_active = true
          LIMIT 1
        `;
        
        const result = await client.query(query, [phoneNumberId]);
        return result.rows[0] || null;
      },
      `find store mapping for ${phoneNumberId}`
    );
  }

  /**
   * 📝 Registra errores de webhook en base de datos
   */
  private async logWebhookError(error: any, webhookData: any, webhookId: string): Promise<void> {
    try {
      await this.resilientDb.executeWithRetry(
        async (client) => {
          const query = `
            INSERT INTO whatsapp_logs (
              type, phone_number, store_id, message_content, 
              status, error_message, raw_data, timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          `;
          
          await client.query(query, [
            'error',
            'WEBHOOK_ERROR',
            0, // storeId por defecto
            `Webhook Error: ${webhookId}`,
            'failed',
            error.message,
            JSON.stringify({ 
              error: error.message, 
              code: error.code,
              webhookId,
              timestamp: new Date().toISOString()
            })
          ]);
        },
        `log webhook error ${webhookId}`
      );
    } catch (logError) {
      console.error(`⚠️ No se pudo registrar error de webhook ${webhookId}:`, logError);
    }
  }

  /**
   * 📱 Registra errores específicos de mensaje
   */
  private async logMessageError(error: any, message: any, storeMapping: any, webhookId: string): Promise<void> {
    try {
      const masterStorage = getMasterStorage();
      await masterStorage.addWhatsAppLog({
        type: 'error',
        phoneNumber: message.from || 'unknown',
        messageContent: `Message processing error: ${error.message}`,
        messageId: message.id,
        status: 'failed',
        errorMessage: `Code: ${error.code}, Message: ${error.message}`,
        rawData: JSON.stringify({ error: error.message, message, webhookId }),
        storeId: storeMapping?.storeId || 0
      });
    } catch (logError) {
      console.error(`⚠️ No se pudo registrar error de mensaje:`, logError);
    }
  }

  /**
   * 📊 Registra errores específicos de estado
   */
  private async logStatusError(error: any, status: any, storeMapping: any, webhookId: string): Promise<void> {
    try {
      const masterStorage = getMasterStorage();
      await masterStorage.addWhatsAppLog({
        type: 'error',
        phoneNumber: status.recipient_id || 'unknown',
        messageContent: `Status processing error: ${error.message}`,
        messageId: status.id,
        status: 'failed',
        errorMessage: `Code: ${error.code}, Message: ${error.message}`,
        rawData: JSON.stringify({ error: error.message, status, webhookId }),
        storeId: storeMapping?.storeId || 0
      });
    } catch (logError) {
      console.error(`⚠️ No se pudo registrar error de estado:`, logError);
    }
  }

  /**
   * 🔑 Genera ID único para webhook
   */
  private generateWebhookId(webhookData: any): string {
    const entry = webhookData.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    
    const phoneNumberId = value?.metadata?.phone_number_id || 'unknown';
    const timestamp = Date.now();
    const hasMessages = !!value?.messages?.length;
    const hasStatuses = !!value?.statuses?.length;
    
    return `${phoneNumberId}_${timestamp}_${hasMessages ? 'msg' : ''}${hasStatuses ? 'status' : ''}`;
  }

  /**
   * ✅ Valida estructura básica del webhook
   */
  private isValidWebhookStructure(webhookData: any): boolean {
    return !!(
      webhookData?.object === 'whatsapp_business_account' &&
      webhookData?.entry?.[0]?.changes?.[0]?.value
    );
  }

  /**
   * 🔄 Determina si un error de webhook es recuperable
   */
  private isRetryableWebhookError(error: any): boolean {
    const retryablePatterns = [
      /connection/i,
      /timeout/i,
      /temporary/i,
      /network/i,
      /pool/i,
      /57P01/i // Tu error específico de admin shutdown
    ];

    const errorMessage = error.message || '';
    const errorCode = error.code || '';

    return retryablePatterns.some(pattern => 
      pattern.test(errorMessage) || pattern.test(errorCode)
    );
  }

  
}