import { db } from "./db";
import { users, customers, products, orders, orderItems, orderHistory, conversations, messages, whatsappSettings } from "../shared/schema";

async function seedDatabase() {
  try {
    console.log("🌱 Seeding database...");

    // Clear existing data
    await db.delete(messages);
    await db.delete(conversations);
    await db.delete(orderHistory);
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(customers);
    await db.delete(products);
    await db.delete(users);
    await db.delete(whatsappSettings);

    // Seed Users
    const [admin, technician1, seller1, technician2] = await db.insert(users).values([
      {
        username: "admin",
        password: "password",
        name: "Admin Principal",
        role: "admin",
        status: "active",
        phone: "+52 55 1234 5678",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face"
      },
      {
        username: "tech1",
        password: "password",
        name: "Carlos Mendoza",
        role: "technician",
        status: "active",
        phone: "+52 55 2345 6789",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face"
      },
      {
        username: "seller1",
        password: "password",
        name: "Ana García",
        role: "seller",
        status: "active",
        phone: "+52 55 3456 7890",
        avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b1e1?w=32&h=32&fit=crop&crop=face"
      },
      {
        username: "tech2",
        password: "password",
        name: "Miguel Torres",
        role: "technician",
        status: "busy",
        phone: "+52 55 4567 8901",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=32&h=32&fit=crop&crop=face"
      }
    ]).returning();

    // Seed Customers
    const [customer1, customer2, customer3] = await db.insert(customers).values([
      {
        name: "Juan López",
        phone: "+52 55 1111 2222",
        whatsappId: "52551111222@c.us",
        address: "Av. Insurgentes Sur 123, Roma Norte, CDMX",
        latitude: "19.4196",
        longitude: "-99.1677",
        lastContact: new Date()
      },
      {
        name: "María Rodríguez",
        phone: "+52 55 3333 4444",
        whatsappId: "52553333444@c.us",
        address: "Calle Madero 456, Centro Histórico, CDMX",
        latitude: "19.4342",
        longitude: "-99.1376",
        lastContact: new Date()
      },
      {
        name: "Roberto Silva",
        phone: "+52 55 5555 6666",
        whatsappId: "52555556666@c.us",
        address: "Av. Reforma 789, Polanco, CDMX",
        latitude: "19.4260",
        longitude: "-99.1710",
        lastContact: new Date()
      }
    ]).returning();

    // Seed Products
    const [product1, product2, product3, service1, service2] = await db.insert(products).values([
      {
        name: "Instalación de Aires Acondicionados",
        description: "Servicio profesional de instalación de equipos de aire acondicionado residencial y comercial",
        price: "2500.00",
        category: "service",
        status: "active"
      },
      {
        name: "Reparación de Refrigeradores",
        description: "Diagnóstico y reparación de refrigeradores de todas las marcas",
        price: "800.00",
        category: "service",
        status: "active"
      },
      {
        name: "Mantenimiento de Lavadoras",
        description: "Servicio de mantenimiento preventivo y correctivo para lavadoras",
        price: "600.00",
        category: "service",
        status: "active"
      },
      {
        name: "Filtro de Aire Acondicionado",
        description: "Filtro de alta eficiencia para equipos de aire acondicionado",
        price: "250.00",
        category: "product",
        status: "active"
      },
      {
        name: "Compresor Universal",
        description: "Compresor para refrigeradores de diferentes capacidades",
        price: "1200.00",
        category: "product",
        status: "active"
      }
    ]).returning();

    // Seed Orders
    const [order1, order2, order3] = await db.insert(orders).values([
      {
        orderNumber: "ORD-1001",
        customerId: customer1.id,
        assignedUserId: technician1.id,
        status: "in_progress",
        priority: "high",
        totalAmount: "2750.00",
        description: "Instalación de aire acondicionado en sala principal",
        notes: "Cliente requiere instalación urgente antes del fin de semana"
      },
      {
        orderNumber: "ORD-1002",
        customerId: customer2.id,
        assignedUserId: technician2.id,
        status: "assigned",
        priority: "normal",
        totalAmount: "850.00",
        description: "Reparación de refrigerador - no enfría correctamente"
      },
      {
        orderNumber: "ORD-1003",
        customerId: customer3.id,
        status: "pending",
        priority: "low",
        totalAmount: "600.00",
        description: "Mantenimiento preventivo de lavadora"
      }
    ]).returning();

    // Seed Order Items
    await db.insert(orderItems).values([
      {
        orderId: order1.id,
        productId: service1.id,
        quantity: 1,
        unitPrice: "2500.00",
        totalPrice: "2500.00",
        installationCost: "2500.00",
        partsCost: "0.00",
        laborHours: "4.00",
        laborRate: "150.00",
        deliveryCost: "250.00",
        deliveryDistance: "15.50",
        notes: "Instalación completa con garantía de 1 año"
      },
      {
        orderId: order2.id,
        productId: service2.id,
        quantity: 1,
        unitPrice: "800.00",
        totalPrice: "800.00",
        installationCost: "600.00",
        partsCost: "200.00",
        laborHours: "2.00",
        laborRate: "150.00",
        deliveryCost: "50.00",
        deliveryDistance: "8.20"
      },
      {
        orderId: order3.id,
        productId: product3.id,
        quantity: 1,
        unitPrice: "600.00",
        totalPrice: "600.00",
        installationCost: "600.00",
        partsCost: "0.00",
        laborHours: "1.50",
        laborRate: "150.00",
        deliveryCost: "0.00",
        deliveryDistance: "0.00"
      }
    ]);

    // Seed Order History
    await db.insert(orderHistory).values([
      {
        orderId: order1.id,
        userId: admin.id,
        statusFrom: null,
        statusTo: "pending",
        action: "created",
        notes: "Pedido creado desde WhatsApp"
      },
      {
        orderId: order1.id,
        userId: admin.id,
        statusFrom: "pending",
        statusTo: "assigned",
        action: "assigned",
        notes: "Asignado a Carlos Mendoza"
      },
      {
        orderId: order1.id,
        userId: technician1.id,
        statusFrom: "assigned",
        statusTo: "in_progress",
        action: "started",
        notes: "Técnico en camino al domicilio"
      }
    ]);

    // Seed Conversations
    const [conv1, conv2] = await db.insert(conversations).values([
      {
        customerId: customer1.id,
        orderId: order1.id,
        status: "active",
        lastMessageAt: new Date()
      },
      {
        customerId: customer2.id,
        orderId: order2.id,
        status: "active",
        lastMessageAt: new Date()
      }
    ]).returning();

    // Seed Messages
    await db.insert(messages).values([
      {
        conversationId: conv1.id,
        senderId: null,
        senderType: "customer",
        messageType: "text",
        content: "Hola, necesito que instalen un aire acondicionado urgente",
        whatsappMessageId: "msg_001",
        isRead: true
      },
      {
        conversationId: conv1.id,
        senderId: admin.id,
        senderType: "user",
        messageType: "text",
        content: "Hola Juan, claro que sí. Te hemos asignado al técnico Carlos que llegará mañana por la mañana.",
        isRead: true
      },
      {
        conversationId: conv2.id,
        senderId: null,
        senderType: "customer",
        messageType: "text",
        content: "Mi refrigerador no está enfriando bien",
        whatsappMessageId: "msg_002",
        isRead: false
      }
    ]);

    // Seed WhatsApp Settings from environment variables
    if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      await db.insert(whatsappSettings).values({
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "verify_token_123",
        businessAccountId: "",
        appId: "",
        isActive: true
      });
    }

    console.log("✅ Database seeded successfully!");
    console.log(`- Users: ${[admin, technician1, seller1, technician2].length}`);
    console.log(`- Customers: ${[customer1, customer2, customer3].length}`);
    console.log(`- Products: ${[product1, product2, product3, service1, service2].length}`);
    console.log(`- Orders: ${[order1, order2, order3].length}`);
    console.log(`- Conversations: ${[conv1, conv2].length}`);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Run if called directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedDatabase };