// ===== PASO 1: CREAR flow-diagnostics.ts =====
// Crear archivo: src/lib/flow-diagnostics.ts

import { getTenantDb, masterDb } from '../multi-tenant-db.js';
import * as schema from '@shared/schema';
import { eq, and, lt, desc } from 'drizzle-orm';
import { sendWhatsAppMessageDirect } from '../whatsapp-simple.js';

// Función para obtener tenant storage
async function getTenantStorage(storeId: number) {
  const { StorageFactory } = await import('../storage/storage-factory.js');
  return StorageFactory.getInstance().getTenantStorage(storeId);
}

// 🔍 Diagnóstico completo de flujo de WhatsApp
export async function diagnoseWhatsAppFlow(phoneNumber: string, storeId: number) {
  console.log(`\n🔍 ===== DIAGNOSING WHATSAPP FLOW =====`);
  console.log(`📞 Phone: ${phoneNumber}`);
  console.log(`🏪 Store ID: ${storeId}`);
  
  const issues: string[] = [];
  const fixes: string[] = [];
  
  try {
    const tenantStorage = await getTenantStorage(storeId);
    
    // 1. Verificar cliente
    console.log(`\n1️⃣ CHECKING CUSTOMER...`);
    const customer = await tenantStorage.getCustomerByPhone(phoneNumber);
    if (!customer) {
      issues.push('❌ Customer not found');
      fixes.push('Create customer record');
    } else {
      console.log(`✅ Customer found: ${customer.name || 'Unnamed'} (ID: ${customer.id})`);
    }
    
    // 2. Verificar flujo de registro
    console.log(`\n2️⃣ CHECKING REGISTRATION FLOW...`);
    const health = await tenantStorage.verifyRegistrationFlowHealth(phoneNumber);
    
    if (!health.isHealthy) {
      issues.push(`❌ Registration flow issues: ${health.issues.join(', ')}`);
      fixes.push('Repair or recreate registration flow');
      
      // Intentar reparar automáticamente
      const repaired = await tenantStorage.repairRegistrationFlow(phoneNumber);
      if (repaired) {
        fixes.push('✅ Auto-repair successful');
      }
    } else if (health.flow) {
      console.log(`✅ Registration flow healthy`);
      console.log(`   Step: ${health.flow.currentStep}`);
      console.log(`   Order ID: ${health.flow.orderId || 'None'}`);
      console.log(`   Completed: ${health.flow.isCompleted}`);
    } else {
      console.log(`ℹ️ No active registration flow`);
    }
    
    // 3. Verificar auto-respuestas
    console.log(`\n3️⃣ CHECKING AUTO-RESPONSES...`);
    const autoResponses = await tenantStorage.getAllAutoResponses();
    
    if (autoResponses.length === 0) {
      issues.push('❌ No auto-responses configured');
      fixes.push('Create default auto-responses');
      
      // Crear respuestas por defecto
      await tenantStorage.createDefaultAutoResponses();
      fixes.push('✅ Default auto-responses created');
    } else {
      console.log(`✅ Found ${autoResponses.length} auto-responses`);
      
      // Verificar respuestas críticas
      const criticalTriggers = ['collect_name', 'collect_address', 'collect_contact', 'collect_payment', 'collect_notes'];
      const missingTriggers = [];
      
      for (const trigger of criticalTriggers) {
        const found = autoResponses.find(resp => resp.trigger === trigger && resp.isActive);
        if (!found) {
          missingTriggers.push(trigger);
        }
      }
      
      if (missingTriggers.length > 0) {
        issues.push(`❌ Missing critical auto-responses: ${missingTriggers.join(', ')}`);
        fixes.push('Recreate missing auto-responses');
      }
    }
    
    // 4. Verificar órdenes pendientes
    console.log(`\n4️⃣ CHECKING PENDING ORDERS...`);
    if (customer) {
      const orders = await tenantStorage.getOrdersByCustomerId(customer.id);
      const pendingOrders = orders.filter(order => 
        order.status === 'pending' || order.status === 'created'
      );
      
      if (pendingOrders.length > 0) {
        console.log(`⚠️ Found ${pendingOrders.length} pending orders`);
        pendingOrders.forEach(order => {
          console.log(`   Order ${order.orderNumber || order.id}: Status ${order.status}`);
        });
      } else {
        console.log(`ℹ️ No pending orders`);
      }
    }
    
    // 5. Limpiar flujos expirados
    console.log(`\n5️⃣ CLEANING EXPIRED FLOWS...`);
    const cleanedCount = await tenantStorage.cleanupExpiredRegistrationFlows();
    if (cleanedCount > 0) {
      fixes.push(`🧹 Cleaned ${cleanedCount} expired flows`);
    }
    
    // 6. Generar reporte
    console.log(`\n📋 ===== DIAGNOSIS REPORT =====`);
    console.log(`🏪 Store: ${storeId}`);
    console.log(`📞 Phone: ${phoneNumber}`);
    console.log(`❌ Issues: ${issues.length}`);
    console.log(`✅ Fixes: ${fixes.length}`);
    
    if (issues.length > 0) {
      console.log(`\n⚠️ ISSUES FOUND:`);
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    if (fixes.length > 0) {
      console.log(`\n🔧 FIXES APPLIED:`);
      fixes.forEach(fix => console.log(`   ${fix}`));
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      fixes,
      customer,
      registrationFlow: health.flow,
      autoResponsesCount: autoResponses.length
    };
    
  } catch (error) {
    console.error('❌ ERROR IN DIAGNOSIS:', error);
    return {
      isHealthy: false,
      issues: [`Critical error: ${error.message}`],
      fixes: [],
      customer: null,
      registrationFlow: null,
      autoResponsesCount: 0
    };
  }
}

// 🔄 Reiniciar flujo de cliente
export async function resetCustomerFlow(phoneNumber: string, storeId: number) {
  console.log(`\n🔄 ===== RESETTING CUSTOMER FLOW =====`);
  console.log(`📞 Phone: ${phoneNumber}`);
  console.log(`🏪 Store ID: ${storeId}`);
  
  try {
    const tenantStorage = await getTenantStorage(storeId);
    
    // 1. Eliminar flujo de registro existente
    await tenantStorage.deleteRegistrationFlowByPhone(phoneNumber);
    console.log(`✅ Registration flow deleted`);
    
    // 2. Verificar/crear cliente
    let customer = await tenantStorage.getCustomerByPhone(phoneNumber);
    if (!customer) {
      customer = await tenantStorage.createCustomer({
        phone: phoneNumber,
        name: 'Cliente',
        email: null,
        storeId: storeId
      });
      console.log(`✅ Customer created: ID ${customer.id}`);
    } else {
      console.log(`✅ Customer exists: ID ${customer.id}`);
    }
    
    // 3. Enviar mensaje de bienvenida
    await sendAutoResponseMessage(phoneNumber, 'welcome', storeId, tenantStorage);
    console.log(`✅ Welcome message sent`);
    
    return {
      success: true,
      customer,
      message: 'Customer flow reset successfully'
    };
    
  } catch (error) {
    console.error('❌ ERROR RESETTING FLOW:', error);
    return {
      success: false,
      customer: null,
      message: `Error: ${error.message}`
    };
  }
}

// 🏥 Verificación de salud del sistema
export async function systemHealthCheck(storeId: number) {
  console.log(`\n🏥 ===== SYSTEM HEALTH CHECK =====`);
  console.log(`🏪 Store ID: ${storeId}`);
  
  const healthReport = {
    timestamp: new Date(),
    storeId,
    overall: 'healthy',
    issues: [],
    recommendations: []
  };
  
  try {
    // 1. Verificar conexión a base de datos
    const tenantStorage = await getTenantStorage(storeId);
    console.log(`✅ Database connection: OK`);
    
    // 2. Verificar auto-respuestas
    const autoResponses = await tenantStorage.getAllAutoResponses();
    if (autoResponses.length === 0) {
      healthReport.issues.push('No auto-responses configured');
      healthReport.overall = 'warning';
    }
    
    // 3. Verificar flujos activos
    const flowReport = await monitorActiveFlows(storeId);
    if (flowReport && flowReport.stuckFlows.length > 0) {
      healthReport.issues.push(`${flowReport.stuckFlows.length} stuck flows detected`);
      healthReport.recommendations.push('Review and reset stuck flows');
      healthReport.overall = 'warning';
    }
    
    // 4. Limpiar flujos expirados
    const cleanedCount = await tenantStorage.cleanupExpiredRegistrationFlows();
    if (cleanedCount > 0) {
      healthReport.recommendations.push(`Cleaned ${cleanedCount} expired flows`);
    }
    
    console.log(`\n🏥 HEALTH REPORT:`);
    console.log(`   Overall: ${healthReport.overall.toUpperCase()}`);
    console.log(`   Issues: ${healthReport.issues.length}`);
    console.log(`   Recommendations: ${healthReport.recommendations.length}`);
    
    return healthReport;
    
  } catch (error) {
    console.error('❌ HEALTH CHECK FAILED:', error);
    healthReport.overall = 'critical';
    healthReport.issues.push(`System error: ${error.message}`);
    return healthReport;
  }
}

// 📊 Monitorear flujos activos
export async function monitorActiveFlows(storeId: number) {
  console.log(`\n📊 ===== MONITORING ACTIVE FLOWS =====`);
  console.log(`🏪 Store ID: ${storeId}`);
  
  try {
    const tenantStorage = await getTenantStorage(storeId);
    
    // Obtener todos los flujos activos
    const activeFlows = await tenantStorage.getActiveRegistrationFlows();
    
    console.log(`📋 Found ${activeFlows.length} active flows`);
    
    const report = {
      totalFlows: activeFlows.length,
      byStep: {},
      expiredFlows: 0,
      stuckFlows: [],
      healthyFlows: 0
    };
    
    for (const flow of activeFlows) {
      // Contar por paso
      report.byStep[flow.currentStep] = (report.byStep[flow.currentStep] || 0) + 1;
      
      // Verificar si expiró
      if (flow.expiresAt && new Date() > flow.expiresAt) {
        report.expiredFlows++;
      }
      
      // Verificar si está atascado (más de 2 horas sin actualizar)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      if (flow.updatedAt < twoHoursAgo && !flow.isCompleted) {
        report.stuckFlows.push({
          phone: flow.phoneNumber,
          step: flow.currentStep,
          orderId: flow.orderId,
          lastUpdate: flow.updatedAt
        });
      } else if (!flow.isCompleted) {
        report.healthyFlows++;
      }
    }
    
    console.log(`\n📊 FLOW STATISTICS:`);
    console.log(`   Total Active: ${report.totalFlows}`);
    console.log(`   Healthy: ${report.healthyFlows}`);
    console.log(`   Expired: ${report.expiredFlows}`);
    console.log(`   Stuck: ${report.stuckFlows.length}`);
    
    console.log(`\n📋 BY STEP:`);
    Object.entries(report.byStep).forEach(([step, count]) => {
      console.log(`   ${step}: ${count}`);
    });
    
    if (report.stuckFlows.length > 0) {
      console.log(`\n⚠️ STUCK FLOWS:`);
      report.stuckFlows.forEach(flow => {
        console.log(`   ${flow.phone}: ${flow.step} (Order: ${flow.orderId || 'None'})`);
      });
    }
    
    return report;
    
  } catch (error) {
    console.error('❌ ERROR MONITORING FLOWS:', error);
    return null;
  }
}

// Función helper para enviar auto-respuestas
async function sendAutoResponseMessage(phoneNumber: string, trigger: string, storeId: number, tenantStorage: any) {
  try {
    const autoResponse = await tenantStorage.getAutoResponsesByTrigger(trigger);
    if (autoResponse && autoResponse.length > 0) {
      let message = autoResponse[0].messageText || autoResponse[0].message || 'Mensaje no disponible';
      
      // Reemplazar variables
      const customer = await tenantStorage.getCustomerByPhone(phoneNumber);
      if (customer) {
        message = message.replace('{customerName}', customer.name || 'Cliente');
      }
      
      await sendWhatsAppMessageDirect(phoneNumber, message, storeId);
    }
  } catch (error) {
    console.error(`Error sending auto-response for ${trigger}:`, error);
  }
}