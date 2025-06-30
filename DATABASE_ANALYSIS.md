# Análisis de Estructura de Base de Datos Multi-Tenant

## Estado Actual ❌ INCORRECTO

### Problema Identificado
Actualmente tenemos **UNA SOLA** base de datos con todas las tablas mezcladas:

**Base de Datos Única (DATABASE_URL):**
```
- assignment_rules          (DEBERÍA estar por tienda)
- auto_responses             (DEBERÍA estar por tienda)  
- conversations              (DEBERÍA estar por tienda)
- customer_history           (DEBERÍA estar por tienda)
- customer_registration_flows (DEBERÍA estar por tienda)
- customers                  (DEBERÍA estar por tienda)
- employee_profiles          (DEBERÍA estar por tienda)
- messages                   (DEBERÍA estar por tienda)
- notifications             (DEBERÍA estar por tienda)
- order_history             (DEBERÍA estar por tienda)
- order_items               (DEBERÍA estar por tienda)
- orders                    (DEBERÍA estar por tienda)
- product_categories        (DEBERÍA estar por tienda)
- products                  (DEBERÍA estar por tienda)
- shopping_cart             (DEBERÍA estar por tienda)
- store_settings            (DEBERÍA estar por tienda)
- system_audit_log          (✅ CORRECTO - es global)
- system_users              (✅ CORRECTO - es global)
- users                     (DEBERÍA estar por tienda)
- virtual_stores            (✅ CORRECTO - es global)
- whatsapp_logs             (DEBERÍA estar por tienda)
- whatsapp_settings         (DEBERÍA estar por tienda)
```

## Estructura Correcta Multi-Tenant ✅

### Base de Datos GLOBAL (Maestra)
**Tablas que DEBEN estar en la BD global:**
```
- virtual_stores            (Registro de todas las tiendas)
- system_users              (Usuarios del sistema: super_admin, store_admin, etc.)
- system_audit_log          (Auditoría global del sistema)
- global_settings           (Configuraciones globales de la plataforma)
- billing_subscriptions     (Facturación y suscripciones)
```

### Base de Datos POR TIENDA (Separadas)
**Cada tienda virtual debe tener su propia BD con:**
```
- users                     (Empleados/técnicos de esa tienda específica)
- customers                 (Clientes de esa tienda)
- products                  (Catálogo de esa tienda)
- orders                    (Pedidos de esa tienda)
- order_items               (Items de pedidos de esa tienda)
- conversations             (Conversaciones WhatsApp de esa tienda)
- messages                  (Mensajes de esa tienda)
- auto_responses            (Respuestas automáticas de esa tienda)
- store_settings            (Configuraciones específicas de esa tienda)
- whatsapp_settings         (Config WhatsApp de esa tienda)
- notifications             (Notificaciones de esa tienda)
- assignment_rules          (Reglas de asignación de esa tienda)
- customer_history          (Historial de clientes de esa tienda)
- shopping_cart             (Carritos de esa tienda)
```

## Problemas de Seguridad Actuales

1. **Filtrado por storeId**: Todas las queries requieren filtrar por `storeId` manualmente
2. **Riesgo de data leakage**: Un error de programación puede mostrar datos de una tienda a otra
3. **Escalabilidad**: Una sola BD para todas las tiendas limita el crecimiento
4. **Backup y recovery**: No se puede hacer backup individual por tienda
5. **Compliance**: Algunas regulaciones requieren separación física de datos

## Solución Requerida

1. **Migrar datos existentes** de la BD única a estructura multi-tenant
2. **Crear BD separadas** para cada tienda virtual existente
3. **Actualizar middleware** para dirigir queries a la BD correcta según el tenant
4. **Preservar BD global** solo para gestión del sistema

## Estado del Código Multi-Tenant

✅ **YA IMPLEMENTADO:**
- `multi-tenant-db.ts` con funciones de conexión por tienda
- Schema separado entre tablas globales y por tienda
- Middleware `tenantMiddleware()` 
- Funciones `getTenantDb()`, `createTenantDatabase()`

❌ **FALTA IMPLEMENTAR:**
- Migración de datos existentes
- Usar conexiones separadas en todos los endpoints
- Eliminar tablas por tienda de la BD global