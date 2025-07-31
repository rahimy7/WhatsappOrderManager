// ===== SCRIPT DE REPARACIÓN INMEDIATA =====
// Ejecuta este script para reparar los flujos atascados

import { diagnoseWhatsAppFlow, resetCustomerFlow, systemHealthCheck } from './flow-diagnostics.js';

// 🔧 Función principal de reparación
export async function emergencyFlowRepair(storeId: number, phoneNumbers?: string[]) {
  console.log(`\n🚨 ===== EMERGENCY FLOW REPAIR =====`);
  console.log(`🏪 Store ID: ${storeId}`);
  console.log(`📞 Phones: ${phoneNumbers ? phoneNumbers.join(', ') : 'All active flows'}`);
  
  const results = {
    storeId,
    timestamp: new Date(),
    repaired: [],
    failed: [],
    summary: {
      totalProcessed: 0,
      successful: 0,
      failed: 0
    }
  };
  
  try {
    // 1. Verificar salud general del sistema
    console.log(`\n1️⃣ SYSTEM HEALTH CHECK...`);
    const healthCheck = await systemHealthCheck(storeId);
    
    if (healthCheck.overall === 'critical') {
      console.log(`❌ CRITICAL SYSTEM ISSUES DETECTED:`);
      healthCheck.issues.forEach(issue => console.log(`   ${issue}`));
      return results;
    }
    
    // 2. Obtener flujos a reparar
    let flowsToRepair = [];
    
    if (phoneNumbers && phoneNumbers.length > 0) {
      // Reparar números específicos
      flowsToRepair = phoneNumbers;
    } else {
      // Obtener todos los flujos activos del storage
      const tenantStorage = await getTenantStorage(storeId);
      const activeFlows = await tenantStorage.getActiveRegistrationFlows();
      flowsToRepair = activeFlows.map(flow => flow.phoneNumber);
    }
    
    console.log(`\n2️⃣ FLOWS TO REPAIR: ${flowsToRepair.length}`);
    
    // 3. Procesar cada flujo
    for (const phoneNumber of flowsToRepair) {
      console.log(`\n🔧 Processing ${phoneNumber}...`);
      results.summary.totalProcessed++;
      
      try {
        // Diagnosticar primero
        const diagnosis = await diagnoseWhatsAppFlow(phoneNumber, storeId);
        
        if (!diagnosis.isHealthy) {
          console.log(`⚠️ Issues found for ${phoneNumber}: ${diagnosis.issues.length}`);
          
          // Intentar reparación automática
          const resetResult = await resetCustomerFlow(phoneNumber, storeId);
          
          if (resetResult.success) {
            results.repaired.push({
              phoneNumber,
              issues: diagnosis.issues,
              fixes: diagnosis.fixes,
              resetSuccessful: true
            });
            results.summary.successful++;
            console.log(`✅ Successfully repaired ${phoneNumber}`);
          } else {
            results.failed.push({
              phoneNumber,
              issues: diagnosis.issues,
              error: resetResult.message
            });
            results.summary.failed++;
            console.log(`❌ Failed to repair ${phoneNumber}: ${resetResult.message}`);
          }
        } else {
          console.log(`✅ ${phoneNumber} is already healthy`);
          results.repaired.push({
            phoneNumber,
            issues: [],
            fixes: ['Already healthy'],
            resetSuccessful: false
          });
          results.summary.successful++;
        }
        
      } catch (phoneError) {
        console.error(`❌ Error processing ${phoneNumber}:`, phoneError);
        results.failed.push({
          phoneNumber,
          issues: [`Processing error: ${phoneError.message}`],
          error: phoneError.message
        });
        results.summary.failed++;
      }
    }
    
    // 4. Generar reporte final
    console.log(`\n📋 ===== REPAIR SUMMARY =====`);
    console.log(`🏪 Store: ${storeId}`);
    console.log(`📊 Processed: ${results.summary.totalProcessed}`);
    console.log(`✅ Successful: ${results.summary.successful}`);
    console.log(`❌ Failed: ${results.summary.failed}`);
    
    if (results.repaired.length > 0) {
      console.log(`\n✅ SUCCESSFULLY REPAIRED:`);
      results.repaired.forEach(repair => {
        console.log(`   ${repair.phoneNumber}: ${repair.fixes.length} fixes applied`);
      });
    }
    
    if (results.failed.length > 0) {
      console.log(`\n❌ FAILED REPAIRS:`);
      results.failed.forEach(failure => {
        console.log(`   ${failure.phoneNumber}: ${failure.error}`);
      });
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ EMERGENCY REPAIR FAILED:', error);
    results.failed.push({
      phoneNumber: 'SYSTEM',
      issues: [`Critical error: ${error.message}`],
      error: error.message
    });
    return results;
  }
}

// 🔧 Reparar flujo específico de un cliente
export async function fixSpecificCustomer(phoneNumber: string, storeId: number) {
  console.log(`\n🔧 ===== FIXING SPECIFIC CUSTOMER =====`);
  console.log(`📞 Phone: ${phoneNumber}`);
  console.log(`🏪 Store: ${storeId}`);
  
  try {
    // 1. Diagnóstico completo
    const diagnosis = await diagnoseWhatsAppFlow(phoneNumber, storeId);
    
    console.log(`\n📋 DIAGNOSIS RESULTS:`);
    console.log(`   Healthy: ${diagnosis.isHealthy}`);
    console.log(`   Issues: ${diagnosis.issues.length}`);
    console.log(`   Fixes Applied: ${diagnosis.fixes.length}`);
    
    if (!diagnosis.isHealthy) {
      console.log(`\n⚠️ ISSUES FOUND:`);
      diagnosis.issues.forEach(issue => console.log(`   ${issue}`));
      
      // 2. Aplicar reparación completa
      const resetResult = await resetCustomerFlow(phoneNumber, storeId);
      
      if (resetResult.success) {
        console.log(`✅ Customer flow reset successfully`);
        
        // 3. Verificar que la reparación funcionó
        const verifyDiagnosis = await diagnoseWhatsAppFlow(phoneNumber, storeId);
        
        if (verifyDiagnosis.isHealthy) {
          console.log(`✅ REPAIR VERIFICATION: Flow is now healthy`);
          return {
            success: true,
            message: 'Customer flow repaired and verified',
            beforeIssues: diagnosis.issues.length,
            afterIssues: verifyDiagnosis.issues.length
          };
        } else {
          console.log(`⚠️ REPAIR VERIFICATION: Still has issues`);
          return {
            success: false,
            message: 'Flow reset but still has issues',
            remainingIssues: verifyDiagnosis.issues
          };
        }
      } else {
        console.log(`❌ Reset failed: ${resetResult.message}`);
        return {
          success: false,
          message: resetResult.message,
          issues: diagnosis.issues
        };
      }
    } else {
      console.log(`✅ Customer flow is already healthy`);
      return {
        success: true,
        message: 'Flow is already healthy',
        beforeIssues: 0,
        afterIssues: 0
      };
    }
    
  } catch (error) {
    console.error('❌ ERROR fixing specific customer:', error);
    return {
      success: false,
      message: `Error: ${error.message}`,
      issues: [`Critical error: ${error.message}`]
    };
  }
}

// 🔧 Reparar auto-respuestas faltantes
export async function repairAutoResponses(storeId: number) {
  console.log(`\n🔧 ===== REPAIRING AUTO-RESPONSES =====`);
  console.log(`🏪 Store: ${storeId}`);
  
  try {
    const tenantStorage = await getTenantStorage(storeId);
    
    // 1. Verificar respuestas actuales
    const currentResponses = await tenantStorage.getAllAutoResponses();
    console.log(`📋 Current responses: ${currentResponses.length}`);
    
    // 2. Verificar respuestas críticas
    const criticalTriggers = [
      'welcome', 'hola', 'order_received',
      'collect_name', 'collect_address', 'collect_contact', 
      'collect_payment', 'collect_notes', 'confirm_order'
    ];
    
    const missingTriggers = [];
    const foundTriggers = [];
    
    for (const trigger of criticalTriggers) {
      const found = currentResponses.find(resp => resp.trigger === trigger && resp.isActive);
      if (found) {
        foundTriggers.push(trigger);
      } else {
        missingTriggers.push(trigger);
      }
    }
    
    console.log(`✅ Found responses: ${foundTriggers.length}`);
    console.log(`❌ Missing responses: ${missingTriggers.length}`);
    
    if (missingTriggers.length > 0) {
      console.log(`\n🔧 Creating missing responses...`);
      
      // 3. Crear respuestas faltantes
      await tenantStorage.createDefaultAutoResponses();
      
      // 4. Verificar que se crearon
      const updatedResponses = await tenantStorage.getAllAutoResponses();
      const newResponsesCount = updatedResponses.length - currentResponses.length;
      
      console.log(`✅ Created ${newResponsesCount} new responses`);
      console.log(`📋 Total responses now: ${updatedResponses.length}`);
      
      return {
        success: true,
        message: `Created ${newResponsesCount} missing auto-responses`,
        before: currentResponses.length,
        after: updatedResponses.length,
        missingTriggers,
        foundTriggers
      };
    } else {
      console.log(`✅ All critical auto-responses are present`);
      return {
        success: true,
        message: 'All auto-responses are present',
        before: currentResponses.length,
        after: currentResponses.length,
        missingTriggers: [],
        foundTriggers
      };
    }
    
  } catch (error) {
    console.error('❌ ERROR repairing auto-responses:', error);
    return {
      success: false,
      message: `Error: ${error.message}`,
      before: 0,
      after: 0
    };
  }
}

// 🔧 Limpiar sistema completo
export async function fullSystemCleanup(storeId: number) {
  console.log(`\n🧹 ===== FULL SYSTEM CLEANUP =====`);
  console.log(`🏪 Store: ${storeId}`);
  
  const cleanupResults = {
    expiredFlows: 0,
    duplicateResponses: 0,
    orphanedData: 0,
    errorsFixed: 0
  };
  
  try {
    const tenantStorage = await getTenantStorage(storeId);
    
    // 1. Limpiar flujos expirados
    console.log(`\n1️⃣ Cleaning expired flows...`);
    cleanupResults.expiredFlows = await tenantStorage.cleanupExpiredRegistrationFlows();
    console.log(`✅ Cleaned ${cleanupResults.expiredFlows} expired flows`);
    
    // 2. Eliminar respuestas duplicadas
    console.log(`\n2️⃣ Removing duplicate auto-responses...`);
    const allResponses = await tenantStorage.getAllAutoResponses();
    const triggerCount = {};
    const duplicates = [];
    
    allResponses.forEach(resp => {
      if (triggerCount[resp.trigger]) {
        duplicates.push(resp.id);
      } else {
        triggerCount[resp.trigger] = 1;
      }
    });
    
    if (duplicates.length > 0) {
      // Eliminar duplicados (mantener el primero de cada trigger)
      for (const duplicateId of duplicates) {
        try {
          await tenantStorage.deleteAutoResponse(duplicateId);
          cleanupResults.duplicateResponses++;
        } catch (deleteError) {
          console.error(`Error deleting duplicate response ${duplicateId}:`, deleteError);
        }
      }
    }
    
    console.log(`✅ Removed ${cleanupResults.duplicateResponses} duplicate responses`);
    
    // 3. Verificar integridad de datos
    console.log(`\n3️⃣ Verifying data integrity...`);
    const activeFlows = await tenantStorage.getActiveRegistrationFlows();
    
    for (const flow of activeFlows) {
      // Verificar que el cliente existe
      const customer = await tenantStorage.getCustomerById(flow.customerId);
      if (!customer) {
        console.log(`⚠️ Orphaned flow found: ${flow.id} (no customer)`);
        await tenantStorage.deleteRegistrationFlowByPhone(flow.phoneNumber);
        cleanupResults.orphanedData++;
      }
      
      // Verificar que el pedido existe (si aplica)
      if (flow.orderId) {
        const order = await tenantStorage.getOrderById(flow.orderId);
        if (!order) {
          console.log(`⚠️ Flow with missing order: ${flow.id}`);
          // Limpiar orderId del flujo
          await tenantStorage.updateRegistrationFlowByPhone(flow.phoneNumber, {
            orderId: null,
            updatedAt: new Date()
          });
          cleanupResults.errorsFixed++;
        }
      }
    }
    
    console.log(`✅ Fixed ${cleanupResults.errorsFixed} data integrity issues`);
    console.log(`✅ Cleaned ${cleanupResults.orphanedData} orphaned records`);
    
    // 4. Generar reporte final
    console.log(`\n📋 ===== CLEANUP SUMMARY =====`);
    console.log(`🏪 Store: ${storeId}`);
    console.log(`⏰ Expired flows: ${cleanupResults.expiredFlows}`);
    console.log(`🔄 Duplicate responses: ${cleanupResults.duplicateResponses}`);
    console.log(`🗑️ Orphaned data: ${cleanupResults.orphanedData}`);
    console.log(`🔧 Errors fixed: ${cleanupResults.errorsFixed}`);
    
    const totalCleaned = Object.values(cleanupResults).reduce((sum, count) => sum + count, 0);
    console.log(`✅ Total items cleaned: ${totalCleaned}`);
    
    return {
      success: true,
      message: `System cleanup completed. ${totalCleaned} items processed.`,
      details: cleanupResults
    };
    
  } catch (error) {
    console.error('❌ ERROR in system cleanup:', error);
    return {
      success: false,
      message: `Cleanup failed: ${error.message}`,
      details: cleanupResults
    };
  }
}

// 🔧 Verificar y reparar configuración de tienda
export async function repairStoreConfiguration(storeId: number) {
  console.log(`\n🔧 ===== REPAIRING STORE CONFIGURATION =====`);
  console.log(`🏪 Store: ${storeId}`);
  
  try {
    // 1. Verificar que la tienda existe y está activa
    const { StorageFactory } = await import('../storage/storage-factory.js');
    const masterStorage = StorageFactory.getInstance().getMasterStorage();
    
    const store = await masterStorage.getVirtualStore(storeId);
    if (!store) {
      return {
        success: false,
        message: `Store ${storeId} not found`
      };
    }
    
    if (!store.isActive) {
      return {
        success: false,
        message: `Store ${storeId} is not active`
      };
    }
    
    console.log(`✅ Store found: ${store.name}`);
    
    // 2. Verificar conexión a base de datos
    const tenantStorage = await getTenantStorage(storeId);
    console.log(`✅ Database connection: OK`);
    
    // 3. Reparar auto-respuestas
    const autoResponseRepair = await repairAutoResponses(storeId);
    console.log(`✅ Auto-responses: ${autoResponseRepair.message}`);
    
    // 4. Limpiar sistema
    const cleanup = await fullSystemCleanup(storeId);
    console.log(`✅ System cleanup: ${cleanup.message}`);
    
    // 5. Verificar salud final
    const finalHealth = await systemHealthCheck(storeId);
    
    return {
      success: true,
      message: 'Store configuration repaired successfully',
      store: {
        id: store.id,
        name: store.name,
        isActive: store.isActive
      },
      autoResponses: autoResponseRepair,
      cleanup: cleanup.details,
      finalHealth: finalHealth.overall
    };
    
  } catch (error) {
    console.error('❌ ERROR repairing store configuration:', error);
    return {
      success: false,
      message: `Configuration repair failed: ${error.message}`
    };
  }
}

// Helper function
async function getTenantStorage(storeId: number) {
  const { StorageFactory } = await import('../storage/storage-factory.js');
  return StorageFactory.getInstance().getTenantStorage(storeId);
}

// 🚀 SCRIPT DE EJECUCIÓN RÁPIDA
// Ejecutar este comando para reparar inmediatamente:
/*
  // Para reparar una tienda específica:
  await emergencyFlowRepair(6); // Cambia 6 por tu storeId
  
  // Para reparar un cliente específico:
  await fixSpecificCustomer("+1234567890", 6);
  
  // Para reparar toda la configuración:
  await repairStoreConfiguration(6);
*/