import { storage } from "./storage";

export async function seedAutoResponses() {
  console.log("Seeding auto responses...");

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
      name: "Seguimiento de Pedidos",
      trigger: "order_tracking",
      messageText: "📋 *Seguimiento de Pedidos*\n\nEsta función te mostrará el estado detallado de tus pedidos activos.\n\n¿Te gustaría ver el estado de tus pedidos?",
      isActive: true,
      priority: 5,
      requiresRegistration: false,
      menuOptions: null,
      nextAction: "show_order_status"
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
      name: "Mensaje de Despedida",
      trigger: "goodbye",
      messageText: "👋 ¡Gracias por contactarnos!\n\nSi necesitas ayuda adicional, no dudes en escribirnos.\n\n¡Que tengas un excelente día!",
      isActive: true,
      priority: 8,
      requiresRegistration: false,
      menuOptions: JSON.stringify([
        { label: "Reiniciar Conversación", value: "restart", action: "show_welcome" }
      ]),
      nextAction: "end_conversation"
    }
  ];

  try {
    // Check if responses already exist
    const existingResponses = await storage.getAllAutoResponses();
    
    if (existingResponses.length === 0) {
      console.log("Creating default auto responses...");
      
      for (const response of defaultResponses) {
        await storage.createAutoResponse(response);
        console.log(`Created auto response: ${response.name}`);
      }
      
      console.log("✅ Default auto responses created successfully");
    } else {
      console.log("Auto responses already exist, skipping seed");
    }
  } catch (error) {
    console.error("Error seeding auto responses:", error);
  }
}