// whatsapp-simple-improved.ts
import { ResilientDatabase, safeWebhookOperation } from '../utils/db-resilient';

export class ImprovedWebhookHandler {
  private resilientDb: ResilientDatabase;
  private processingQueue: Map<string, Promise<void>> = new Map();

  constructor(resilientDb: ResilientDatabase) {
    this.resilientDb = resilientDb;
  }

  /**
   * Procesa webhook con manejo robusto de errores y prevención de duplicados
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
   * Procesamiento interno del webhook con manejo de errores
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

      if (value.messages) {
        await this.processMessages(value.messages, storeMapping, webhookId);
      }

      if (value.statuses) {
        await this.processStatuses(value.statuses, storeMapping, webhookId);
      }

      console.log(`✅ Webhook ${webhookId} procesado exitosamente`);

    } catch (error: any) {
      console.error(`💥 Error procesando webhook ${webhookId}:`, error);
      
      // 📝 Registrar error en base de datos
      await this.logWebhookError(error, webhookData, webhookId);
      
      // 🔄 Decidir si reintentare o fallar
      if (this.isRetryableWebhookError(error)) {
        console.log(`🔄 Reintentando webhook ${webhookId} en 5 segundos...`);
        setTimeout(() => this.processWebhook(webhookData), 5000);
      } else {
        console.error(`🚫 Error no recuperable en webhook ${webhookId}, abandonando`);
      }
    }
  }

  /**
   * Procesa mensajes con manejo robusto
   */
  private async processMessages(messages: any[], storeMapping: any, webhookId: string): Promise<void> {
    for (const message of messages) {
      try {
        await safeWebhookOperation(
          this.resilientDb,
          async (client) => {
            // Tu lógica de procesamiento de mensajes aquí
            await this.processUserMessage(message, storeMapping, client);
          },
          `process message ${message.id} (webhook: ${webhookId})`
        );
      } catch (error) {
        console.error(`❌ Error procesando mensaje ${message.id}:`, error);
        // Continuar con el siguiente mensaje
      }
    }
  }

  /**
   * Procesa estados de mensaje con manejo robusto
   */
  private async processStatuses(statuses: any[], storeMapping: any, webhookId: string): Promise<void> {
    for (const status of statuses) {
      try {
        await safeWebhookOperation(
          this.resilientDb,
          async (client) => {
            await this.updateMessageStatus(status, storeMapping, client);
          },
          `process status ${status.id} (webhook: ${webhookId})`
        );
      } catch (error) {
        console.error(`❌ Error procesando estado ${status.id}:`, error);
        // Continuar con el siguiente estado
      }
    }
  }

  /**
   * Registra errores de webhook en base de datos
   */
  private async logWebhookError(error: any, webhookData: any, webhookId: string): Promise<void> {
    try {
      await safeWebhookOperation(
        this.resilientDb,
        async (client) => {
          const query = `
            INSERT INTO whatsapp_logs (type, phone_number, store_id, message_content, status, error_message, raw_data, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          `;
          
          await client.query(query, [
            'error',
            'WEBHOOK_ERROR',
            0, // storeId por defecto si no se puede determinar
            `Webhook Error: ${webhookId}`,
            'failed',
            error.message,
            JSON.stringify({ error: error.message, webhookData })
          ]);
        },
        `log webhook error ${webhookId}`
      );
    } catch (logError) {
      console.error(`⚠️ No se pudo registrar error de webhook ${webhookId}:`, logError);
    }
  }

  /**
   * Genera ID único para webhook
   */
  private generateWebhookId(webhookData: any): string {
    const entry = webhookData.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    
    // Usar timestamp + phone_number_id + tipo de contenido
    const phoneNumberId = value?.metadata?.phone_number_id || 'unknown';
    const timestamp = Date.now();
    const hasMessages = !!value?.messages;
    const hasStatuses = !!value?.statuses;
    
    return `${phoneNumberId}_${timestamp}_${hasMessages ? 'msg' : ''}${hasStatuses ? 'status' : ''}`;
  }

  /**
   * Valida estructura básica del webhook
   */
  private isValidWebhookStructure(webhookData: any): boolean {
    return !!(
      webhookData?.object === 'whatsapp_business_account' &&
      webhookData?.entry?.[0]?.changes?.[0]?.value
    );
  }

  /**
   * Encuentra el mapeo de tienda para el webhook
   */
  private async findStoreMapping(webhookData: any): Promise<any> {
    const phoneNumberId = webhookData.entry[0].changes[0].value.metadata.phone_number_id;
    
    return await safeWebhookOperation(
      this.resilientDb,
      async (client) => {
        const result = await client.query(
          'SELECT * FROM virtual_stores WHERE phone_number_id = $1',
          [phoneNumberId]
        );
        return result.rows[0] || null;
      },
      `find store mapping for ${phoneNumberId}`
    );
  }

  /**
   * Determina si un error de webhook es recuperable
   */
  private isRetryableWebhookError(error: any): boolean {
    const retryablePatterns = [
      /connection/i,
      /timeout/i,
      /temporary/i,
      /network/i,
      /pool/i
    ];

    return retryablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.code)
    );
  }

  /**
   * Procesa mensaje de usuario (implementar tu lógica)
   */
  private async processUserMessage(message: any, storeMapping: any, client: any): Promise<void> {
    // Tu lógica existente aquí, pero usando el client pasado
    console.log(`📱 Procesando mensaje: ${message.text?.body}`);
  }

  /**
   * Actualiza estado de mensaje (implementar tu lógica)
   */
  private async updateMessageStatus(status: any, storeMapping: any, client: any): Promise<void> {
    // Tu lógica existente aquí, pero usando el client pasado
    console.log(`📊 Actualizando estado: ${status.status} para ${status.id}`);
  }
}