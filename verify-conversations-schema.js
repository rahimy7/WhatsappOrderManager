// verify-conversations-schema.js
// Script para verificar y corregir la estructura de la base de datos para conversaciones

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const SERVER_PATH = path.join(PROJECT_ROOT, 'server');

function verifyConversationsSchema() {
  console.log('🔍 VERIFICANDO ESQUEMA DE CONVERSACIONES\n');
  
  try {
    // 1. Verificar schema en db/index.ts
    verifyDatabaseSchema();
    
    // 2. Verificar métodos en tenant-storage.ts
    verifyTenantStorageMethods();
    
    // 3. Crear migración si es necesario
    createConversationsMigration();
    
    console.log('\n🎉 VERIFICACIÓN COMPLETADA!');
    
  } catch (error) {
    console.error('❌ Error verificando esquema:', error.message);
  }
}

function verifyDatabaseSchema() {
  const schemaPath = path.join(SERVER_PATH, 'db', 'index.ts');
  
  if (!fs.existsSync(schemaPath)) {
    console.log('⚠️ db/index.ts no encontrado');
    return;
  }
  
  console.log('📝 Verificando esquema de base de datos...');
  
  let content = fs.readFileSync(schemaPath, 'utf8');
  
  // Verificar que existan las tablas necesarias
  const hasConversations = content.includes('export const conversations');
  const hasMessages = content.includes('export const messages');
  const hasCustomers = content.includes('export const customers');
  
  console.log('   📋 Estado de las tablas:');
  console.log(`   ${hasConversations ? '✅' : '❌'} conversations`);
  console.log(`   ${hasMessages ? '✅' : '❌'} messages`);
  console.log(`   ${hasCustomers ? '✅' : '❌'} customers`);
  
  if (!hasConversations || !hasMessages) {
    console.log('\n⚠️ Faltan tablas importantes. Agregando esquemas...');
    
    if (!hasConversations) {
      addConversationsTable(content, schemaPath);
    }
    
    if (!hasMessages) {
      addMessagesTable(content, schemaPath);
    }
  }
  
  // Verificar relaciones
  const hasConversationRelations = content.includes('conversationId') && content.includes('customerId');
  console.log(`   ${hasConversationRelations ? '✅' : '⚠️'} Relaciones entre tablas`);
  
  console.log('   ✅ Esquema verificado');
}

function addConversationsTable(content, schemaPath) {
  const conversationsSchema = `
// Tabla de conversaciones
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull(),
  conversationType: text('conversation_type').default('initial'),
  status: text('status').default('active'), // active, closed, pending
  lastMessageAt: timestamp('last_message_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
`;

  // Insertar después de la tabla de customers si existe
  const customerTableIndex = content.indexOf('export const customers');
  if (customerTableIndex !== -1) {
    const nextExportIndex = content.indexOf('\nexport const', customerTableIndex + 1);
    if (nextExportIndex !== -1) {
      content = content.slice(0, nextExportIndex) + 
                conversationsSchema + 
                content.slice(nextExportIndex);
    } else {
      content += conversationsSchema;
    }
  } else {
    content += conversationsSchema;
  }
  
  fs.writeFileSync(schemaPath, content);
  console.log('   ✅ Tabla conversations agregada');
}

function addMessagesTable(content, schemaPath) {
  const messagesSchema = `
// Tabla de mensajes
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  senderId: integer('sender_id'), // ID del usuario/agente o null para cliente
  senderType: text('sender_type').notNull(), // 'customer' | 'agent'
  content: text('content').notNull(),
  messageType: text('message_type').default('text'), // text, image, audio, etc.
  whatsappMessageId: text('whatsapp_message_id'), // ID del mensaje de WhatsApp
  isRead: boolean('is_read').default(false),
  sentAt: timestamp('sent_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});
`;

  // Insertar después de la tabla de conversations
  const conversationTableIndex = content.indexOf('export const conversations');
  if (conversationTableIndex !== -1) {
    const nextExportIndex = content.indexOf('\nexport const', conversationTableIndex + 1);
    if (nextExportIndex !== -1) {
      content = content.slice(0, nextExportIndex) + 
                messagesSchema + 
                content.slice(nextExportIndex);
    } else {
      content += messagesSchema;
    }
  } else {
    content += messagesSchema;
  }
  
  fs.writeFileSync(schemaPath, content);
  console.log('   ✅ Tabla messages agregada');
}

function verifyTenantStorageMethods() {
  const storagePath = path.join(SERVER_PATH, 'storage', 'tenant-storage.ts');
  
  if (!fs.existsSync(storagePath)) {
    console.log('⚠️ tenant-storage.ts no encontrado');
    return;
  }
  
  console.log('📝 Verificando métodos de storage...');
  
  let content = fs.readFileSync(storagePath, 'utf8');
  
  // Verificar métodos necesarios
  const methods = [
    'getAllConversations',
    'getConversationById',
    'createConversation',
    'updateConversation',
    'getMessagesByConversation',
    'createMessage',
    'getAllMessages'
  ];
  
  console.log('   📋 Estado de los métodos:');
  const missingMethods = [];
  
  methods.forEach(method => {
    const hasMethod = content.includes(`async ${method}(`) || content.includes(`${method}(`);
    console.log(`   ${hasMethod ? '✅' : '❌'} ${method}`);
    if (!hasMethod) {
      missingMethods.push(method);
    }
  });
  
  if (missingMethods.length > 0) {
    console.log('\n⚠️ Faltan métodos importantes. Estos deben implementarse:');
    missingMethods.forEach(method => {
      console.log(`   - ${method}`);
    });
    
    // Crear template para métodos faltantes
    createMissingMethodsTemplate(missingMethods);
  }
  
  console.log('   ✅ Métodos verificados');
}

function createMissingMethodsTemplate(missingMethods) {
  const templatePath = path.join(PROJECT_ROOT, 'missing-conversation-methods.ts');
  
  let template = `// missing-conversation-methods.ts
// Template para métodos faltantes en tenant-storage.ts
// Copiar e integrar en tenant-storage.ts

`;

  if (missingMethods.includes('getAllConversations')) {
    template += `
async getAllConversations() {
  try {
    const conversationsData = await tenantDb
      .select({
        id: schema.conversations.id,
        customerId: schema.conversations.customerId,
        conversationType: schema.conversations.conversationType,
        status: schema.conversations.status,
        lastMessageAt: schema.conversations.lastMessageAt,
        createdAt: schema.conversations.createdAt,
        updatedAt: schema.conversations.updatedAt,
        // Datos del cliente
        customerName: schema.customers.name,
        customerPhone: schema.customers.phone,
        customerWhatsappId: schema.customers.whatsappId,
      })
      .from(schema.conversations)
      .leftJoin(schema.customers, eq(schema.conversations.customerId, schema.customers.id))
      .orderBy(desc(schema.conversations.lastMessageAt));

    return conversationsData;
  } catch (error) {
    console.error('Error getting all conversations:', error);
    return [];
  }
},
`;
  }

  if (missingMethods.includes('getConversationById')) {
    template += `
async getConversationById(id: number) {
  try {
    const [conversation] = await tenantDb
      .select({
        id: schema.conversations.id,
        customerId: schema.conversations.customerId,
        conversationType: schema.conversations.conversationType,
        status: schema.conversations.status,
        lastMessageAt: schema.conversations.lastMessageAt,
        createdAt: schema.conversations.createdAt,
        updatedAt: schema.conversations.updatedAt,
        // Datos del cliente
        customerName: schema.customers.name,
        customerPhone: schema.customers.phone,
        customerWhatsappId: schema.customers.whatsappId,
      })
      .from(schema.conversations)
      .leftJoin(schema.customers, eq(schema.conversations.customerId, schema.customers.id))
      .where(eq(schema.conversations.id, id));

    return conversation || null;
  } catch (error) {
    console.error('Error getting conversation by id:', error);
    return null;
  }
},
`;
  }

  if (missingMethods.includes('createConversation')) {
    template += `
async createConversation(conversationData: any) {
  try {
    const [conversation] = await tenantDb.insert(schema.conversations)
      .values({
        customerId: conversationData.customerId,
        conversationType: conversationData.conversationType || 'initial',
        status: conversationData.status || 'active',
        createdAt: new Date(),
        lastMessageAt: new Date()
      })
      .returning();
    
    console.log('✅ Conversation created:', conversation.id);
    return conversation;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
},
`;
  }

  if (missingMethods.includes('updateConversation')) {
    template += `
async updateConversation(id: number, updates: any) {
  try {
    const [conversation] = await tenantDb.update(schema.conversations)
      .set({ 
        ...updates, 
        updatedAt: new Date() 
      })
      .where(eq(schema.conversations.id, id))
      .returning();
    
    return conversation;
  } catch (error) {
    console.error('Error updating conversation:', error);
    throw error;
  }
},
`;
  }

  template += `
// Agregar estos métodos al final de la clase TenantStorage en tenant-storage.ts
`;

  fs.writeFileSync(templatePath, template);
  console.log(`   ✅ Template creado: ${templatePath}`);
}

function createConversationsMigration() {
  const migrationsPath = path.join(SERVER_PATH, 'migrations');
  
  if (!fs.existsSync(migrationsPath)) {
    fs.mkdirSync(migrationsPath, { recursive: true });
  }
  
  console.log('📝 Creando migración para conversaciones...');
  
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  const migrationFile = path.join(migrationsPath, `${timestamp}_create_conversations_tables.sql`);
  
  const migrationSQL = `-- Migración para crear tablas de conversaciones
-- Ejecutar en la base de datos de cada tienda

-- Tabla de conversaciones
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  conversation_type TEXT DEFAULT 'initial',
  status TEXT DEFAULT 'active',
  last_message_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER,
  sender_type TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  whatsapp_message_id TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);

-- Comentarios
COMMENT ON TABLE conversations IS 'Conversaciones entre clientes y la tienda';
COMMENT ON TABLE messages IS 'Mensajes individuales dentro de las conversaciones';

-- Datos de ejemplo para pruebas (opcional)
-- INSERT INTO conversations (customer_id, conversation_type, status) 
-- VALUES (1, 'initial', 'active') 
-- ON CONFLICT DO NOTHING;
`;

  fs.writeFileSync(migrationFile, migrationSQL);
  console.log(`   ✅ Migración creada: ${migrationFile}`);
  
  console.log('\n   📋 Para aplicar la migración:');
  console.log('   1. Conectar a la base de datos de cada tienda');
  console.log(`   2. Ejecutar el archivo: ${migrationFile}`);
  console.log('   3. Verificar que las tablas se crearon correctamente');
}

// Ejecutar la verificación
verifyConversationsSchema();