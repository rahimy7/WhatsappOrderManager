# API de Conversaciones - Documentación

## Endpoints Disponibles

### 1. GET /api/conversations
**Descripción:** Obtiene todas las conversaciones de la tienda
**Autenticación:** Requerida
**Respuesta:** Array de conversaciones

### 2. GET /api/conversations/:id
**Descripción:** Obtiene una conversación específica con sus mensajes
**Autenticación:** Requerida
**Parámetros:** id (número)

### 3. POST /api/conversations
**Descripción:** Crea una nueva conversación
**Autenticación:** Requerida

### 4. PUT /api/conversations/:id
**Descripción:** Actualiza una conversación
**Autenticación:** Requerida

### 5. GET /api/conversations/:id/messages
**Descripción:** Obtiene todos los mensajes de una conversación
**Autenticación:** Requerida

### 6. POST /api/conversations/:id/messages
**Descripción:** Crea un nuevo mensaje en una conversación
**Autenticación:** Requerida

### 7. GET /api/debug/conversations
**Descripción:** Endpoint de debug para verificar estado del sistema
**Autenticación:** Requerida

## Estados de Conversación
- active: Conversación activa
- closed: Conversación cerrada
- pending: Esperando respuesta

## Tipos de Conversación
- initial: Primera interacción
- order: Relacionada a pedidos
- support: Soporte técnico
- inquiry: Consulta general

## Códigos de Error
- 400: Datos inválidos
- 401: No autenticado
- 403: Sin permisos
- 404: Conversación no encontrada
- 500: Error interno del servidor
