# Guía de Configuración

## Pasos de Instalación

### 1. Ejecutar Script de Corrección
chmod +x fix-all-conversations.js
node fix-all-conversations.js

### 2. Aplicar Migración SQL
1. Ir a la carpeta migrations/
2. Ejecutar el archivo SQL más reciente en tu base de datos
3. Verificar que las tablas se crearon correctamente

### 3. Reiniciar Servidor
yarn dev

### 4. Verificar Funcionalidad
1. Acceder a GET /api/debug/conversations
2. Enviar mensaje de WhatsApp de prueba
3. Verificar que aparezca en GET /api/conversations

## Configuración de WhatsApp

### Variables de Entorno Necesarias:
WEBHOOK_VERIFY_TOKEN=tu_token_de_verificacion
WHATSAPP_TOKEN=tu_token_de_whatsapp
DATABASE_URL=tu_url_de_base_de_datos

### Configuración de Webhook:
- URL: https://tu-dominio.com/api/webhook
- Método: POST
- Verificación: GET con token

## Estructura de Base de Datos

### Tablas Principales:
- conversations: Conversaciones entre clientes y tienda
- messages: Mensajes individuales
- customers: Información de clientes
- whatsapp_logs: Logs de eventos de WhatsApp

### Relaciones:
- conversations.customer_id → customers.id
- messages.conversation_id → conversations.id
