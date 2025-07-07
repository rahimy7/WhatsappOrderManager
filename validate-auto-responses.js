/**
 * Test script para validar que cada webhook use las respuestas automáticas
 * específicas de la tienda propietaria del número de WhatsApp
 */

// Configuraciones de las tiendas para testing
const storeConfigs = [
  {
    name: "MASQUESALUD",
    storeId: 5,
    phoneNumberId: "690329620832620",
    testPhoneNumber: "525579096161",
    expectedWelcomeMessage: "¡Hola! 👋 Bienvenido a *MASQUESALUD* - Tu salud es nuestra prioridad."
  },
  {
    name: "RVR SERVICE", 
    storeId: 4,
    phoneNumberId: "667993026397854",
    testPhoneNumber: "525587654321",
    expectedWelcomeMessage: "¡Hola! 👋 Bienvenido a *RVR SERVICE* - Especialistas en refrigeración y aires acondicionados."
  }
];

const webhookUrl = "https://whats-app-order-manager-rahimy7.replit.app/webhook";

function createWebhookPayload(phoneNumberId, fromNumber, messageText) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1438133463993189",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "+1 809-357-6939",
                phone_number_id: phoneNumberId
              },
              contacts: [
                {
                  profile: {
                    name: "Test User"
                  },
                  wa_id: fromNumber
                }
              ],
              messages: [
                {
                  from: fromNumber,
                  id: `test_msg_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: {
                    body: messageText
                  },
                  type: "text"
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };
}

async function testStoreAutoResponse(storeConfig) {
  console.log(`\n🧪 Probando respuestas automáticas para ${storeConfig.name}...`);
  console.log(`📱 phoneNumberId: ${storeConfig.phoneNumberId}`);
  console.log(`📞 Número de prueba: ${storeConfig.testPhoneNumber}`);
  
  try {
    const payload = createWebhookPayload(
      storeConfig.phoneNumberId, 
      storeConfig.testPhoneNumber, 
      "hola"
    );

    console.log(`🚀 Enviando mensaje de prueba "hola" al webhook...`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log(`📡 Respuesta webhook: ${response.status}`);
    const responseText = await response.text();
    console.log(`📄 Respuesta del servidor: ${responseText}`);
    
    if (response.status === 200) {
      console.log(`✅ ${storeConfig.name}: Webhook procesado correctamente`);
      console.log(`🔍 Se esperaba mensaje de bienvenida específico para ${storeConfig.name}`);
      console.log(`📝 Mensaje esperado: "${storeConfig.expectedWelcomeMessage}"`);
    } else {
      console.log(`❌ ${storeConfig.name}: Error en webhook - Status ${response.status}`);
    }
    
  } catch (error) {
    console.error(`💥 Error probando ${storeConfig.name}:`, error.message);
  }
}

async function validateAutoResponses() {
  console.log('🎯 VALIDACIÓN DE RESPUESTAS AUTOMÁTICAS MULTI-TENANT');
  console.log('========================================================');
  console.log('Verificando que cada webhook use las respuestas automáticas');
  console.log('específicas de la tienda propietaria del número WhatsApp\n');

  for (const storeConfig of storeConfigs) {
    await testStoreAutoResponse(storeConfig);
    
    // Pausa entre pruebas para evitar sobrecargar el sistema
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n📊 VALIDACIÓN COMPLETADA');
  console.log('=========================');
  console.log('Revisa los logs del servidor para confirmar que:');
  console.log('1. Cada mensaje se enrutó al tenant correcto (storeId)');
  console.log('2. Se utilizaron las respuestas automáticas específicas de cada tienda');
  console.log('3. Los mensajes de bienvenida contienen el nombre correcto de la tienda');
}

// Ejecutar validación
validateAutoResponses().catch(console.error);