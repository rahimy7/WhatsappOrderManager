# Configuración de WhatsApp Business API

## Estado Actual
✅ Base de datos PostgreSQL configurada
✅ Token guardado en la base de datos
✅ Webhook URL generada automáticamente
✅ Sistema de logs funcionando
❌ Token requiere renovación o permisos adicionales

## Token Actual
```
EAAKHVoxT6IUBO0NfI9kvAENV7pGuhZAPyl2H1QUtyS1h9ADbzxamIQ04wq2OacRm79subgUHUwFkhJplUmHNA6huA6HtvhjFgJuVmP9kBbkQsacew8OtuOYtJZAOlSvdZCAeNhQ2VS5zuWi3rkBXGzX8TvqxgBa6oc16fMZAJjf7dUYHZB2U561Mz17s649L83Df1ms0HVsMe58aqwEjH1KXo1ZB9WZATtwwE9SvWdTO5DFVmZA5vIUyAGOE38vqwgZDZD
```

## Configuración Necesaria en Meta

### Paso 1: Webhook URL
Configura esta URL en Meta Developer Console:
```
https://26695527-d48e-437b-ae29-6205a2fc9d44-00-23ev7am5d34ji.picard.replit.dev/webhook
```

### Paso 2: Verify Token
Usa este token de verificación:
```
orderManager_webhook_2024
```

### Paso 3: Permisos Requeridos
El token debe tener estos permisos:
- `whatsapp_business_messaging`
- `whatsapp_business_management`
- `pages_messaging`

### Paso 4: Phone Number ID
Verificar que el Phone Number ID es correcto:
```
457588944081739
```

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