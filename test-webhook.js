// Script to test multi-tenant WhatsApp webhook with auto-responses
const testWebhook = async (storeType = 'masquesalud') => {
  try {
    let webhookData;
    
    if (storeType === 'masquesalud') {
      webhookData = {
        "object": "whatsapp_business_account",
        "entry": [{
          "id": "1438133463993189",
          "changes": [{
            "field": "messages", 
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "18093576939",
                "phone_number_id": "690329620832620"  // MASQUESALUD Store ID: 5
              },
              "contacts": [{
                "profile": {
                  "name": "Cliente MASQUESALUD"
                },
                "wa_id": "525512345678"
              }],
              "messages": [{
                "from": "525512345678",
                "id": "test_msg_masque_" + Date.now(),
                "timestamp": Math.floor(Date.now() / 1000).toString(),
                "text": {
                  "body": "hola"
                },
                "type": "text"
              }]
            }
          }]
        }]
      };
    } else {
      webhookData = {
        "object": "whatsapp_business_account",
        "entry": [{
          "id": "444239435931422",
          "changes": [{
            "field": "messages", 
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "15556550331",
                "phone_number_id": "667993026397854"  // RVR SERVICE Store ID: 4
              },
              "contacts": [{
                "profile": {
                  "name": "Cliente RVR"
                },
                "wa_id": "525587654321"
              }],
              "messages": [{
                "from": "525587654321",
                "id": "test_msg_rvr_" + Date.now(),
                "timestamp": Math.floor(Date.now() / 1000).toString(),
                "text": {
                  "body": "hola"
                },
                "type": "text"
              }]
            }
          }]
        }]
      };
    }

    console.log(`Testing ${storeType.toUpperCase()} store webhook...`);
    
    const response = await fetch("http://localhost:5000/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(webhookData)
    });

    console.log("Webhook test response:", response.status);
    console.log("Response text:", await response.text());
  } catch (error) {
    console.error("Error testing webhook:", error);
  }
};

// Test both stores
console.log("Testing multi-tenant auto-responses...");
testWebhook('masquesalud').then(() => {
  setTimeout(() => {
    testWebhook('rvr');
  }, 2000);
});