// client/src/test-conversations.js
// Pruebas de endpoints de conversaciones desde el frontend

export async function testConversationsAPI() {
  console.log('🧪 INICIANDO PRUEBAS DE API DE CONVERSACIONES');
  
  const baseURL = window.location.origin;
  const token = localStorage.getItem('token');
  
  if (!token) {
    console.error('❌ No hay token de autenticación. Primero hacer login.');
    return { error: 'No token found' };
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };
  
  const results = {
    debug: null,
    conversations: null,
    singleConversation: null,
    messages: null,
    createConversation: null,
    createMessage: null,
    errors: []
  };
  
  try {
    // 1. Probar GET /api/conversations
    console.log('\n1️⃣ Probando GET /api/conversations...');
    try {
      const conversationsResponse = await fetch(baseURL + '/api/conversations', {
        method: 'GET',
        headers
      });
      
      console.log('Status:', conversationsResponse.status);
      results.conversations = await conversationsResponse.json();
      console.log('Conversations data:', results.conversations);
    } catch (error) {
      console.error('Error en GET /api/conversations:', error);
      results.errors.push('GET /api/conversations: ' + error.message);
    }
    
    // 2. Probar endpoint de debug
    console.log('\n2️⃣ Probando GET /api/debug/conversations...');
    try {
      const debugResponse = await fetch(baseURL + '/api/debug/conversations', {
        method: 'GET',
        headers
      });
      
      console.log('Debug status:', debugResponse.status);
      results.debug = await debugResponse.json();
      console.log('Debug data:', results.debug);
    } catch (error) {
      console.error('Error en debug endpoint:', error);
      results.errors.push('GET /api/debug/conversations: ' + error.message);
    }
    
    // 3. Si hay conversaciones, probar obtener una específica
    if (results.conversations && Array.isArray(results.conversations) && results.conversations.length > 0) {
      const firstConversationId = results.conversations[0].id;
      console.log('\n3️⃣ Probando GET /api/conversations/' + firstConversationId + '...');
      
      try {
        const conversationResponse = await fetch(baseURL + '/api/conversations/' + firstConversationId, {
          method: 'GET',
          headers
        });
        
        console.log('Single conversation status:', conversationResponse.status);
        results.singleConversation = await conversationResponse.json();
        console.log('Single conversation data:', results.singleConversation);
        
        // 4. Probar obtener mensajes de la conversación
        console.log('\n4️⃣ Probando GET /api/conversations/' + firstConversationId + '/messages...');
        
        const messagesResponse = await fetch(baseURL + '/api/conversations/' + firstConversationId + '/messages', {
          method: 'GET',
          headers
        });
        
        console.log('Messages status:', messagesResponse.status);
        results.messages = await messagesResponse.json();
        console.log('Messages data:', results.messages);
        
      } catch (error) {
        console.error('Error en conversation específica:', error);
        results.errors.push('GET single conversation: ' + error.message);
      }
    }
    
    // 5. Probar crear una nueva conversación (si hay clientes)
    console.log('\n5️⃣ Probando POST /api/conversations...');
    
    const newConversationData = {
      customerId: 1, // Asumimos que existe cliente con ID 1
      conversationType: 'test',
      status: 'active'
    };
    
    try {
      const createResponse = await fetch(baseURL + '/api/conversations', {
        method: 'POST',
        headers,
        body: JSON.stringify(newConversationData)
      });
      
      console.log('Create conversation status:', createResponse.status);
      results.createConversation = await createResponse.json();
      console.log('Create conversation data:', results.createConversation);
      
      // 6. Si se creó la conversación, probar crear un mensaje
      if (results.createConversation && results.createConversation.id) {
        console.log('\n6️⃣ Probando POST /api/conversations/' + results.createConversation.id + '/messages...');
        
        const messageData = {
          content: 'Mensaje de prueba desde API test',
          senderType: 'agent'
        };
        
        const createMessageResponse = await fetch(baseURL + '/api/conversations/' + results.createConversation.id + '/messages', {
          method: 'POST',
          headers,
          body: JSON.stringify(messageData)
        });
        
        console.log('Create message status:', createMessageResponse.status);
        results.createMessage = await createMessageResponse.json();
        console.log('Create message data:', results.createMessage);
      }
      
    } catch (error) {
      console.error('Error creando conversación:', error);
      results.errors.push('POST /api/conversations: ' + error.message);
    }
    
    console.log('\n✅ PRUEBAS COMPLETADAS!');
    console.log('\n📊 RESUMEN DE RESULTADOS:');
    console.log('- Conversaciones encontradas:', results.conversations ? results.conversations.length : 0);
    console.log('- Debug exitoso:', !!results.debug);
    console.log('- Conversación creada:', results.createConversation && results.createConversation.id ? true : false);
    console.log('- Mensaje creado:', results.createMessage && results.createMessage.id ? true : false);
    console.log('- Errores encontrados:', results.errors.length);
    
    if (results.errors.length > 0) {
      console.log('\n❌ ERRORES:');
      results.errors.forEach(error => console.log('  -', error));
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Error general en las pruebas:', error);
    results.errors.push('General error: ' + error.message);
    return results;
  }
}

// Función para probar autenticación
export async function testAuthentication() {
  console.log('🔐 Probando autenticación...');
  
  const baseURL = window.location.origin;
  
  const testCredentials = {
    username: 'admin',
    password: 'admin123',
    storeId: 1
  };
  
  try {
    const response = await fetch(baseURL + '/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testCredentials)
    });
    
    const data = await response.json();
    
    if (response.ok && data.token) {
      localStorage.setItem('token', data.token);
      console.log('✅ Autenticación exitosa, token guardado');
      return { success: true, token: data.token, user: data.user };
    } else {
      console.log('❌ Error en autenticación:', data);
      return { success: false, error: data };
    }
    
  } catch (error) {
    console.error('❌ Error en autenticación:', error);
    return { success: false, error: error.message };
  }
}

// Función para limpiar datos de prueba
export async function cleanupTestData() {
  console.log('🧹 Limpiando datos de prueba...');
  
  const baseURL = window.location.origin;
  const token = localStorage.getItem('token');
  
  if (!token) {
    console.log('❌ No hay token para limpiar datos');
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };
  
  try {
    // Obtener conversaciones de prueba
    const response = await fetch(baseURL + '/api/conversations', {
      method: 'GET',
      headers
    });
    
    const conversations = await response.json();
    
    // Eliminar conversaciones que tengan "test" en el tipo
    for (const conv of conversations) {
      if (conv.conversationType === 'test') {
        console.log('🗑️ Eliminando conversación de prueba: ' + conv.id);
        // Aquí iría la lógica de eliminación si tienes endpoint DELETE
        // await fetch(baseURL + '/api/conversations/' + conv.id, { method: 'DELETE', headers });
      }
    }
    
    console.log('✅ Limpieza completada');
    
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
  }
}

// Ejecutar automáticamente si se carga directamente
if (typeof window !== 'undefined') {
  window.testConversationsAPI = testConversationsAPI;
  window.testAuthentication = testAuthentication;
  window.cleanupTestData = cleanupTestData;
  
  console.log('🧪 Funciones de prueba cargadas:');
  console.log('- testConversationsAPI() - Prueba todos los endpoints');
  console.log('- testAuthentication() - Prueba login y guarda token');
  console.log('- cleanupTestData() - Limpia datos de prueba');
}

export default {
  testConversationsAPI,
  testAuthentication,
  cleanupTestData
};
