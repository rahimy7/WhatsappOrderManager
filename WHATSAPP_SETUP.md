# Configuración de WhatsApp Business API

## Estado Actual
✅ Base de datos PostgreSQL configurada
✅ Token guardado en la base de datos
✅ Webhook URL generada automáticamente
✅ Sistema de logs funcionando
❌ Token requiere renovación o permisos adicionales

## Token Actual (Actualizado)
```
EAAKHVoxT6IUBO0IXMq0UxThW3ihGe8uic0pECUZAIyonXZBAnE6diBZAb2F4WSIE8Cv2ZBjLXZCKq9WbyBdOfgiZBR9ku6QOpJ4s3Q6wpautBkwLvCxnqMatHonGPEVdEEFsAb4neXdNVPHQEDhkuB71F9fl3EaTcj2RXECDVUMeCyYz9JI9mfJMnFpgYAgovuhHc1ND8ZAu5qe4oG3trtlxitnBdtknurcEVg2ITafihc7YWZBGZAEUXrMV0ZCzZAQ5wZDZD
```

## Configuración Necesaria en Meta

### IMPORTANTE: El token actual presenta errores de OAuth
```
Error: "Invalid OAuth access token - Cannot parse access token"
Error: "Object with ID '457588944081739' does not exist, cannot be loaded due to missing permissions"
```

### Paso 1: Verificar el Token
1. Ve a Meta Developer Console (developers.facebook.com)
2. Selecciona tu aplicación de WhatsApp Business
3. Ve a WhatsApp > Configuración
4. Genera un nuevo token de acceso temporal o permanente
5. Asegúrate de que el token tenga los permisos correctos

### Paso 2: Webhook URL
Configura esta URL en Meta Developer Console:
```
https://26695527-d48e-437b-ae29-6205a2fc9d44-00-23ev7am5d34ji.picard.replit.dev/webhook
```

### Paso 3: Verify Token
Usa este token de verificación:
```
orderManager_webhook_2024
```

### Paso 4: Permisos Requeridos
El token debe tener estos permisos:
- `whatsapp_business_messaging`
- `whatsapp_business_management`
- `pages_messaging`

### Paso 5: Phone Number ID
Verificar que el Phone Number ID es correcto:
```
457588944081739
```

### Paso 6: Configuración de Webhook
1. En Meta Developer Console, ve a Webhooks
2. Edita el webhook de WhatsApp
3. Añade la URL del webhook
4. Añade el verify token
5. Suscríbete a estos campos:
   - `messages`
   - `message_deliveries`
   - `message_reads`
   - `messaging_postbacks`

## Para Probar la Integración

1. Renovar el token en Meta Developer Console
2. Asegurar que tiene todos los permisos necesarios
3. Configurar el webhook con la URL y verify token proporcionados
4. Enviar mensaje de prueba desde WhatsApp

## Respuesta Automática Configurada

El sistema responderá automáticamente con este menú:
```
¡Hola! 👋 Bienvenido a OrderManager

🛍️ MENÚ PRINCIPAL

Escribe una de estas opciones:
• menu - Ver catálogo de productos
• pedido - Estado de tu orden
• ubicacion - Compartir tu ubicación
• ayuda - Obtener ayuda

¿En qué te puedo ayudar hoy?
```

## Logs del Sistema

Todos los eventos de WhatsApp se registran en la base de datos y puedes verlos en tiempo real en la interfaz de administración.