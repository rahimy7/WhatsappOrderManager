import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, MapPin, Users, Clock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AssignmentRule, InsertAssignmentRule } from "@shared/schema";

const assignmentRuleSchema = z.object({
  name: z.string().min(1, "Nombre es requerido"),
  isActive: z.boolean().default(true),
  priority: z.number().min(1).max(10),
  useLocationBased: z.boolean().default(true),
  maxDistanceKm: z.number().min(0.1).max(100),
  useSpecializationBased: z.boolean().default(true),
  requiredSpecializations: z.array(z.string()).default([]),
  useWorkloadBased: z.boolean().default(true),
  maxOrdersPerTechnician: z.number().min(1).max(20),
  useTimeBased: z.boolean().default(true),
  availabilityRequired: z.boolean().default(true),
  applicableProducts: z.array(z.string()).default([]),
  applicableServices: z.array(z.string()).default([]),
  assignmentMethod: z.enum(["closest_available", "least_busy", "highest_skill", "round_robin"]).default("closest_available"),
  autoAssign: z.boolean().default(true),
  notifyCustomer: z.boolean().default(true),
  estimatedResponseTime: z.number().min(15).max(480), // 15 minutes to 8 hours
});

type AssignmentRuleForm = z.infer<typeof assignmentRuleSchema>;

export default function AssignmentRules() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["/api/assignment-rules"],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
  });

  const createMutation = useMutation({
    mutationFn: (data: AssignmentRuleForm) => apiRequest("POST", "/api/assignment-rules", data),
    onSuccess: () => {
      toast({ title: "Regla creada exitosamente" });
      queryClient.invalidateQueries({ queryKey: ["/api/assignment-rules"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error al crear regla", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AssignmentRuleForm> }) =>
      apiRequest("PUT", `/api/assignment-rules/${id}`, data),
    onSuccess: () => {
      toast({ title: "Regla actualizada exitosamente" });
      queryClient.invalidateQueries({ queryKey: ["/api/assignment-rules"] });
      setIsDialogOpen(false);
      setEditingRule(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error al actualizar regla", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/assignment-rules/${id}`),
    onSuccess: () => {
      toast({ title: "Regla eliminada exitosamente" });
      queryClient.invalidateQueries({ queryKey: ["/api/assignment-rules"] });
    },
    onError: () => {
      toast({ title: "Error al eliminar regla", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PUT", `/api/assignment-rules/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignment-rules"] });
    },
  });

  const form = useForm<AssignmentRuleForm>({
    resolver: zodResolver(assignmentRuleSchema),
    defaultValues: {
      name: "",
      isActive: true,
      priority: 1,
      useLocationBased: true,
      maxDistanceKm: 15,
      useSpecializationBased: true,
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
      estimatedResponseTime: 60,
    },
  });

  const onSubmit = (data: AssignmentRuleForm) => {
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (rule: AssignmentRule) => {
    setEditingRule(rule);
    form.reset({
      name: rule.name,
      isActive: rule.isActive || true,
      priority: rule.priority || 1,
      useLocationBased: rule.useLocationBased || true,
      maxDistanceKm: Number(rule.maxDistanceKm) || 15,
      useSpecializationBased: rule.useSpecializationBased || true,
      requiredSpecializations: rule.requiredSpecializations || [],
      useWorkloadBased: rule.useWorkloadBased || true,
      maxOrdersPerTechnician: rule.maxOrdersPerTechnician || 5,
      useTimeBased: rule.useTimeBased || true,
      availabilityRequired: rule.availabilityRequired || true,
      applicableProducts: rule.applicableProducts || [],
      applicableServices: rule.applicableServices || [],
      assignmentMethod: (rule.assignmentMethod as any) || "closest_available",
      autoAssign: rule.autoAssign || true,
      notifyCustomer: rule.notifyCustomer || true,
      estimatedResponseTime: rule.estimatedResponseTime || 60,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta regla?")) {
      deleteMutation.mutate(id);
    }
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      closest_available: "Más Cercano Disponible",
      least_busy: "Menos Ocupado",
      highest_skill: "Mayor Habilidad",
      round_robin: "Rotación"
    };
    return labels[method] || method;
  };

  if (isLoading) {
    return <div className="p-6">Cargando reglas de asignación...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reglas de Asignación Automática</h1>
          <p className="text-gray-600">Configure las reglas para asignar automáticamente técnicos a órdenes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingRule(null);
              form.reset();
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Regla
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? "Editar Regla de Asignación" : "Nueva Regla de Asignación"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de la Regla</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Asignación por Proximidad" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prioridad (1-10)</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="10" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Location Criteria */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Criterios de Ubicación
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="useLocationBased"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Usar asignación basada en ubicación</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {form.watch("useLocationBased") && (
                      <FormField
                        control={form.control}
                        name="maxDistanceKm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Distancia máxima (km)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" min="0.1" max="100" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Specialization Criteria */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Criterios de Especialización
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="useSpecializationBased"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Usar asignación basada en especialización</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Workload Criteria */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Criterios de Carga de Trabajo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="useWorkloadBased"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel>Usar asignación basada en carga de trabajo</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {form.watch("useWorkloadBased") && (
                      <FormField
                        control={form.control}
                        name="maxOrdersPerTechnician"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Máximo de órdenes por técnico</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" max="20" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Assignment Method */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Método de Asignación
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="assignmentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Método de Asignación</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona método" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="closest_available">Más Cercano Disponible</SelectItem>
                              <SelectItem value="least_busy">Menos Ocupado</SelectItem>
                              <SelectItem value="highest_skill">Mayor Habilidad</SelectItem>
                              <SelectItem value="round_robin">Rotación</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="autoAssign"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <FormLabel>Asignación automática</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="notifyCustomer"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between">
                            <FormLabel>Notificar al cliente</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="estimatedResponseTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tiempo estimado de respuesta (minutos)</FormLabel>
                          <FormControl>
                            <Input type="number" min="15" max="480" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingRule ? "Actualizar" : "Crear"} Regla
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-8">
              <Users className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay reglas de asignación</h3>
              <p className="text-gray-600 text-center mb-4">
                Crea tu primera regla para automatizar la asignación de técnicos
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Regla
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule: AssignmentRule) => (
            <Card key={rule.id} className="w-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CardTitle>{rule.name}</CardTitle>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                    <Badge variant="outline">Prioridad: {rule.priority}</Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={rule.isActive || false}
                      onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: rule.id, isActive: checked })}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Criterios Activos</h4>
                    <div className="space-y-1">
                      {rule.useLocationBased && (
                        <Badge variant="outline" className="mr-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          Ubicación (≤{rule.maxDistanceKm}km)
                        </Badge>
                      )}
                      {rule.useSpecializationBased && (
                        <Badge variant="outline" className="mr-1">
                          <Users className="h-3 w-3 mr-1" />
                          Especialización
                        </Badge>
                      )}
                      {rule.useWorkloadBased && (
                        <Badge variant="outline" className="mr-1">
                          <Clock className="h-3 w-3 mr-1" />
                          Carga de Trabajo
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Método de Asignación</h4>
                    <Badge variant="secondary">{getMethodLabel(rule.assignmentMethod || "closest_available")}</Badge>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Configuración</h4>
                    <div className="space-y-1">
                      <Badge variant={rule.autoAssign ? "default" : "outline"} className="mr-1">
                        {rule.autoAssign ? "Auto-asignar" : "Solo sugerir"}
                      </Badge>
                      {rule.notifyCustomer && (
                        <Badge variant="outline" className="mr-1">
                          Notificar cliente
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}