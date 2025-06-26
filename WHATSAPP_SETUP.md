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

### PROBLEMA IDENTIFICADO: Token sin permisos para enviar mensajes
```
Error: "Object with ID '457588944081739' does not exist, cannot be loaded due to missing permissions"
Estado: El sistema RECIBE mensajes pero NO PUEDE enviar respuestas
```

### SOLUCIÓN: Configurar permisos en Meta Developer Console

#### Paso 1: Verificar el Token en Meta Developer Console
1. Ve a [Meta Developer Console](https://developers.facebook.com)
2. Selecciona tu aplicación de WhatsApp Business
3. Ve a **WhatsApp > Configuración**

#### Paso 2: Verificar el Número de Teléfono
1. En la sección "Números de teléfono"
2. Confirma que el Phone Number ID `457588944081739` esté activo
3. Verifica que esté vinculado a tu aplicación

#### Paso 3: Configurar Permisos del Token
Tu token necesita estos permisos específicos:
- `whatsapp_business_messaging` - Para enviar mensajes
- `whatsapp_business_management` - Para gestionar configuración
- `pages_messaging` - Para mensajería de páginas

#### Paso 4: Generar Token con Permisos Correctos
1. En "Configuración" > "Tokens de acceso"
2. Genera un nuevo token
3. Asegúrate de seleccionar TODOS los permisos necesarios
4. Copia el nuevo token

#### Paso 5: IMPORTANTE - Verificar Estado del Número de Teléfono
Tu Phone Number ID `457588944081739` puede estar:
- No verificado completamente
- Sin vinculación correcta a la aplicación
- Pendiente de aprobación por Meta

**Verificaciones necesarias:**
1. En Meta Developer Console > WhatsApp > Números de teléfono
2. El número debe mostrar estado "Verificado" y "Activo"
3. Si aparece "Pendiente" necesitas completar el proceso de verificación
4. Si no aparece en la lista, debes agregarlo y verificarlo

#### Paso 6: Configurar Business Account
1. Ve a WhatsApp Manager (business.facebook.com)
2. Verifica que tu cuenta de negocio esté activa
3. Asegúrate de que el número esté vinculado a la cuenta correcta

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

## Resumen del Problema

**CAUSA RAÍZ:** Tu token no tiene permisos para enviar mensajes a través de la API de WhatsApp Business.

**SÍNTOMAS:**
- ✅ El sistema recibe mensajes correctamente
- ❌ No puede enviar respuestas automáticas
- Error: "Object with ID does not exist, cannot be loaded due to missing permissions"

**SOLUCIÓN PASO A PASO:**

1. **Ir a Meta Developer Console** (developers.facebook.com)
2. **Verificar aplicación WhatsApp Business** está activa
3. **Generar nuevo token** con permisos completos:
   - whatsapp_business_messaging
   - whatsapp_business_management
   - pages_messaging
4. **Verificar número de teléfono** está activo y vinculado
5. **Actualizar token** en el sistema usando la interfaz web
6. **Probar envío** de mensaje

## Pasos Inmediatos

1. Ve a Meta Developer Console
2. Busca tu aplicación de WhatsApp
3. Ve a Configuración > Tokens de acceso
4. Genera un nuevo token con TODOS los permisos
5. Actualiza el token en la configuración del sistema
6. El sistema comenzará a responder automáticamente

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