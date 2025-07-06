// Script to test multi-tenant WhatsApp webhook
const testWebhook = async () => {
  try {
    const webhookData = {
      "object": "whatsapp_business_account",
      "entry": [{
        "id": "entry_test_masquesalud",
        "changes": [{
          "field": "messages", 
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "18093576939",
              "phone_number_id": "690329620832620"  // MASQUESALUD number
            },
            "contacts": [{
              "profile": {
                "name": "Cliente Prueba"
              },
              "wa_id": "525512345678"
            }],
            "messages": [{
              "from": "525512345678",
              "id": "test_msg_" + Date.now(),
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

testWebhook();