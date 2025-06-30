import { db } from "./db";
import { assignmentRules } from "@shared/schema";

const defaultAssignmentRules = [
  {
    name: "Urgencias - Asignación Inmediata",
    isActive: true,
    priority: 10,
    useLocationBased: true,
    maxDistanceKm: "25.0",
    useSpecializationBased: true,
    requiredSpecializations: ["urgencias", "emergencias"],
    useWorkloadBased: false, // Para urgencias, no importa la carga de trabajo
    maxOrdersPerTechnician: 10,
    useTimeBased: true,
    availabilityRequired: true,
    applicableProducts: [],
    applicableServices: ["emergencia", "urgencia"],
    assignmentMethod: "closest_available",
    autoAssign: true,
    notifyCustomer: true,
    estimatedResponseTime: 30
  },
  {
    name: "Aires Acondicionados - Especialistas",
    isActive: true,
    priority: 8,
    useLocationBased: true,
    maxDistanceKm: "20.0",
    useSpecializationBased: true,
    requiredSpecializations: ["aire_acondicionado", "climatizacion"],
    useWorkloadBased: true,
    maxOrdersPerTechnician: 4,
    useTimeBased: true,
    availabilityRequired: true,
    applicableProducts: [],
    applicableServices: ["instalacion", "mantenimiento"],
    assignmentMethod: "highest_skill",
    autoAssign: true,
    notifyCustomer: true,
    estimatedResponseTime: 120
  },
  {
    name: "Instalaciones Complejas",
    isActive: true,
    priority: 7,
    useLocationBased: true,
    maxDistanceKm: "30.0",
    useSpecializationBased: true,
    requiredSpecializations: ["instalacion_compleja", "sistemas_avanzados"],
    useWorkloadBased: true,
    maxOrdersPerTechnician: 2,
    useTimeBased: true,
    availabilityRequired: true,
    applicableProducts: [],
    applicableServices: ["instalacion"],
    assignmentMethod: "highest_skill",
    autoAssign: true,
    notifyCustomer: true,
    estimatedResponseTime: 180
  },
  {
    name: "Mantenimiento Preventivo",
    isActive: true,
    priority: 5,
    useLocationBased: true,
    maxDistanceKm: "15.0",
    useSpecializationBased: false,
    requiredSpecializations: ["mantenimiento"],
    useWorkloadBased: true,
    maxOrdersPerTechnician: 6,
    useTimeBased: true,
    availabilityRequired: true,
    applicableProducts: [],
    applicableServices: ["mantenimiento"],
    assignmentMethod: "least_busy",
    autoAssign: true,
    notifyCustomer: true,
    estimatedResponseTime: 90
  },
  {
    name: "Asignación General - Por Proximidad",
    isActive: true,
    priority: 3,
    useLocationBased: true,
    maxDistanceKm: "15.0",
    useSpecializationBased: false,
    requiredSpecializations: [],
    useWorkloadBased: true,
    maxOrdersPerTechnician: 5,
    useTimeBased: true,
    availabilityRequired: true,
    applicableProducts: [],
    applicableServices: [],
    assignmentMethod: "closest_available",
    autoAssign: true,
    notifyCustomer: true,
    estimatedResponseTime: 120
  },
  {
    name: "Distribución Equitativa",
    isActive: false, // Desactivada por defecto
    priority: 1,
    useLocationBased: false,
    maxDistanceKm: "50.0",
    useSpecializationBased: false,
    requiredSpecializations: [],
    useWorkloadBased: true,
    maxOrdersPerTechnician: 4,
    useTimeBased: true,
    availabilityRequired: true,
    applicableProducts: [],
    applicableServices: [],
    assignmentMethod: "round_robin",
    autoAssign: false, // Solo sugerencia
    notifyCustomer: false,
    estimatedResponseTime: 240
  }
];

export async function seedAssignmentRules() {
  try {
    console.log('Checking for existing assignment rules...');
    
    const existingRules = await db.select().from(assignmentRules);
    
    if (existingRules.length > 0) {
      console.log(`Assignment rules already exist (${existingRules.length}), skipping seed`);
      return;
    }

    console.log('Seeding default assignment rules...');
    
    for (const rule of defaultAssignmentRules) {
      await db.insert(assignmentRules).values(rule);
      console.log(`✓ Created assignment rule: ${rule.name}`);
    }
    
    console.log(`✅ Successfully seeded ${defaultAssignmentRules.length} assignment rules`);
    
  } catch (error) {
    console.error('Error seeding assignment rules:', error);
  }
}