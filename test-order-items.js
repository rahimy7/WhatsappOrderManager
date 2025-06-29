// Script de prueba para verificar getOrderItems
const { storage } = require('./server/storage.js');

async function testGetOrderItems() {
  try {
    console.log('Testing getOrderItems with order ID 48...');
    const orderItems = await storage.getOrderItems(48);
    console.log('Order items retrieved successfully:');
    console.log(JSON.stringify(orderItems, null, 2));
  } catch (error) {
    console.error('Error testing getOrderItems:', error);
  }
}

testGetOrderItems();