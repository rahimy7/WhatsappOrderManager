/**
 * Test rápido para validar respuesta automática específica por tienda
 */

const webhookUrl = "https://whats-app-order-manager-rahimy7.replit.app/webhook";

// Test para MASQUESALUD
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

async function testMasquesalud() {
  console.log('🧪 PROBANDO MASQUESALUD - phoneNumberId: 690329620832620');
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(masquesaludPayload)
    });

    console.log(`📡 MASQUESALUD Response: ${response.status}`);
    const responseText = await response.text();
    console.log(`📄 MASQUESALUD Response text: ${responseText}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMasquesalud();