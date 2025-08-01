import { getTenantStorage } from './storage/index.js';



export async function seedAutoResponses(storeId: number) {
  console.log(`🌱 Seeding auto responses for store ${storeId}...`);

  const defaultResponses = [
    {
      name: "Mensaje de Bienvenida",
      trigger: "welcome",
      messageText: "¡Hola! 👋 Bienvenido a nuestro servicio de aires acondicionados.\n\n¿En qué podemos ayudarte hoy?",
      isActive: true,
      priority: 1,
      requiresRegistration: false,
      menuOptions: JSON.stringify([
        { label: "Ver Productos", value: "products", action: "show_products" },
        { label: "Ver Servicios", value: "services", action: "show_services" },
        { label: "Estado de Pedido", value: "order_status", action: "show_order_status" },
        { label: "Hablar con Técnico", value: "technician", action: "contact_technician" }
      ]),
      nextAction: "show_menu"
    },
    {
      name: "Menú Principal",
      trigger: "menu",
      messageText: "📋 *Menú Principal*\n\nSelecciona una opción:",
      isActive: true,
      priority: 2,
      requiresRegistration: false,
      menuOptions: JSON.stringify([
        { label: "🔧 Ver Productos", value: "products", action: "show_products" },
        { label: "⚙️ Ver Servicios", value: "services", action: "show_services" },
        { label: "📦 Estado de Pedido", value: "order_status", action: "show_order_status" },
        { label: "🔧 Hablar con Técnico", value: "technician", action: "contact_technician" },
        { label: "ℹ️ Ayuda", value: "help", action: "show_help" }
      ]),
      nextAction: "wait_selection"
    },
    {
      name: "Solicitud de Ubicación",
      trigger: "location_request",
      messageText: "📍 Para calcular el costo de entrega, necesitamos tu ubicación.\n\nPor favor comparte tu ubicación o escribe tu dirección completa.",
      isActive: true,
      priority: 3,
      requiresRegistration: false,
      menuOptions: null,
      nextAction: "wait_location"
    },
    {
      name: "Confirmación de Pedido",
      trigger: "order_confirmation",
      messageText: "✅ *Pedido Confirmado*\n\nTu pedido ha sido registrado exitosamente.\n\nRecibe detalles:\n• Número de pedido: {orderNumber}\n• Total: ${totalAmount}\n• Tiempo estimado: {estimatedTime}\n\nUn técnico te contactará pronto.",
      isActive: true,
      priority: 4,
      requiresRegistration: false,
      menuOptions: JSON.stringify([
        { label: "Ver Estado", value: "track_order", action: "track_order" },
        { label: "Menú Principal", value: "main_menu", action: "show_main_menu" }
      ]),
      nextAction: "end_conversation"
    },
    {
      name: "Registro de Cliente",
      trigger: "registration",
      messageText: "📝 Para continuar, necesitamos registrarte en nuestro sistema.\n\nPor favor proporciona tu nombre completo:",
      isActive: true,
      priority: 5,
      requiresRegistration: true,
      menuOptions: null,
      nextAction: "collect_name"
    },
    {
      name: "Mensaje de Ayuda",
      trigger: "help",
      messageText: "ℹ️ *Centro de Ayuda*\n\nComandos disponibles:\n• *menu* - Mostrar menú principal\n• *productos* - Ver catálogo de productos\n• *servicios* - Ver servicios disponibles\n• *pedido* - Estado de tu pedido\n• *ubicacion* - Actualizar ubicación\n• *ayuda* - Mostrar esta ayuda\n\n¿Necesitas hablar con un técnico? Escribe *técnico*",
      isActive: true,
      priority: 6,
      requiresRegistration: false,
      menuOptions: JSON.stringify([
        { label: "Menú Principal", value: "main_menu", action: "show_main_menu" },
        { label: "Contactar Técnico", value: "technician", action: "contact_technician" }
      ]),
      nextAction: "show_menu"
    },
    {
      name: "Producto No Disponible",
      trigger: "product_unavailable",
      messageText: "😕 Lo sentimos, el producto seleccionado no está disponible actualmente.\n\n¿Te gustaría ver productos similares o hablar con un técnico?",
      isActive: true,
      priority: 7,
      requiresRegistration: false,
      menuOptions: JSON.stringify([
        { label: "Ver Otros Productos", value: "products", action: "show_products" },
        { label: "Hablar con Técnico", value: "technician", action: "contact_technician" },
        { label: "Menú Principal", value: "main_menu", action: "show_main_menu" }
      ]),
      nextAction: "wait_selection"
    },
    {
      name: "Consulta de Productos",
      trigger: "product_inquiry",
      messageText: "🛍️ *Catálogo de Productos*\n\nNuestros productos de aires acondicionados:\n\n• Mini Split 12,000 BTU - $15,000\n• Mini Split 18,000 BTU - $18,500\n• Mini Split 24,000 BTU - $22,000\n• Aire Central 36,000 BTU - $35,000\n\n¿Te interesa algún producto específico?",
      isActive: true,
      priority: 8,
      requiresRegistration: false,
      menuOptions: JSON.stringify([
        { label: "Mini Split 12K BTU", value: "product_12k", action: "select_product" },
        { label: "Mini Split 18K BTU", value: "product_18k", action: "select_product" },
        { label: "Mini Split 24K BTU", value: "product_24k", action: "select_product" },
        { label: "Hacer Pedido", value: "order", action: "start_order" }
      ]),
      nextAction: "wait_selection"
    },
    {
      name: "Consulta de Servicios", 
      trigger: "service_inquiry",
      messageText: "⚙️ *Servicios Disponibles*\n\nOfrecemos los siguientes servicios:\n\n• Instalación de Aires - $2,500\n• Mantenimiento Preventivo - $800\n• Reparación de Equipos - $1,200\n• Limpieza Profunda - $600\n\n¿Qué servicio necesitas?",
      isActive: true,
      priority: 9,
      requiresRegistration: false,
      menuOptions: JSON.stringify([
        { label: "Instalación", value: "service_install", action: "select_service" },
        { label: "Mantenimiento", value: "service_maintenance", action: "select_service" },
        { label: "Reparación", value: "service_repair", action: "select_service" },
        { label: "Solicitar Servicio", value: "order", action: "start_order" }
      ]),
      nextAction: "wait_selection"
    },
    {
      name: "Mensaje de Despedida",
      trigger: "goodbye",
      messageText: "👋 ¡Gracias por contactarnos!\n\nSi necesitas ayuda adicional, no dudes en escribirnos.\n\n¡Que tengas un excelente día!",
      isActive: true,
      priority: 10, // ✅ Corregido: cambié de 8 a 10 para evitar conflicto con "Consulta de Productos"
      requiresRegistration: false,
      menuOptions: JSON.stringify([
        { label: "Reiniciar Conversación", value: "restart", action: "show_welcome" }
      ]),
      nextAction: "end_conversation"
    }
  ];

  try {
    // ✅ CORREGIDO: Usar tenant storage específico para la tienda
    const tenantStorage = await getTenantStorage(storeId);
    
    // Check if responses already exist
    const existingResponses = await tenantStorage.getAllAutoResponses();
    
    if (existingResponses.length === 0) {
      console.log(`📝 Creating ${defaultResponses.length} default auto responses for store ${storeId}...`);
      
      for (const response of defaultResponses) {
        try {
          // ✅ CORREGIDO: Usar tenant storage
          await tenantStorage.createAutoResponse(response);
          console.log(`✅ Created auto response: ${response.name}`);
        } catch (error) {
          console.error(`❌ Error creating ${response.name}:`, error);
        }
      }
      
      console.log("✅ Default auto responses created successfully");
    } else {
      console.log(`ℹ️ Auto responses already exist for store ${storeId} (${existingResponses.length} found), skipping seed`);
    }
  } catch (error) {
    console.error(`❌ Error seeding auto responses for store ${storeId}:`, error);
    throw error;
  }
}

// ================================
// FUNCIÓN AUXILIAR PARA SEED EN TODAS LAS TIENDAS
// ================================

export async function seedAutoResponsesForAllStores() {
  try {
    console.log("🌱 Starting auto responses seed for all stores...");
    
    const { getMasterStorage } = await import('./storage/index.js');
    const masterStorage = getMasterStorage();
    
    // Obtener todas las tiendas virtuales
    const stores = await masterStorage.getAllVirtualStores();
    
    if (stores.length === 0) {
      console.log("⚠️ No stores found, skipping seed");
      return;
    }
    
    console.log(`📊 Found ${stores.length} stores, seeding auto responses...`);
    
    for (const store of stores) {
      try {
        console.log(`\n🏪 Processing store: ${store.name} (ID: ${store.id})`);
        await seedAutoResponses(store.id);
      } catch (error) {
        console.error(`❌ Error seeding store ${store.id} (${store.name}):`, error);
      }
    }
    
    console.log("\n✅ Auto responses seed completed for all stores");
  } catch (error) {
    console.error("❌ Error seeding auto responses for all stores:", error);
    throw error;
  }
}

