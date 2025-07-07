/**
 * Test completo para validar respuestas automáticas específicas por tienda
 */

const webhookUrl = "https://whats-app-order-manager-rahimy7.replit.app/webhook";

// Test para MASQUESALUD (Store ID: 5)
const masquesaludPayload = {
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
              phone_number_id: "690329620832620" // MASQUESALUD phoneNumberId
            },
            contacts: [
              {
                profile: {
                  name: "Test User MASQUESALUD"
                },
                wa_id: "525579096161"
              }
            ],
            messages: [
              {
                from: "525579096161",
                id: `test_masquesalud_${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                text: {
                  body: "hola"
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

// Test para RVR SERVICE (Store ID: 4)
const rvrServicePayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "444239435931422",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "+1 555 655 0331",
              phone_number_id: "667993026397854" // RVR SERVICE phoneNumberId
            },
            contacts: [
              {
                profile: {
                  name: "Test User RVR SERVICE"
                },
                wa_id: "525587654321"
              }
            ],
            messages: [
              {
                from: "525587654321",
                id: `test_rvr_${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                text: {
                  body: "hola"
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

async function testBothStores() {
  console.log('🧪 PROBANDO AMBAS TIENDAS - VALIDACIÓN MULTI-TENANT\n');
  
  // Test MASQUESALUD
  console.log('🏥 MASQUESALUD - phoneNumberId: 690329620832620 (Store ID: 5)');
  try {
    const response1 = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(masquesaludPayload)
    });
    console.log(`📡 MASQUESALUD Response: ${response1.status}`);
    const responseText1 = await response1.text();
    console.log(`📄 MASQUESALUD Response: ${responseText1}\n`);
  } catch (error) {
    console.error('❌ MASQUESALUD Error:', error.message);
  }

  // Esperar 2 segundos entre pruebas
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test RVR SERVICE
  console.log('❄️ RVR SERVICE - phoneNumberId: 667993026397854 (Store ID: 4)');
  try {
    const response2 = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(rvrServicePayload)
    });
    console.log(`📡 RVR SERVICE Response: ${response2.status}`);
    const responseText2 = await response2.text();
    console.log(`📄 RVR SERVICE Response: ${responseText2}`);
  } catch (error) {
    console.error('❌ RVR SERVICE Error:', error.message);
  }

  console.log('\n✅ PRUEBAS COMPLETADAS - Revisar logs del servidor para verificar procesamiento específico por tienda');
}

testBothStores();