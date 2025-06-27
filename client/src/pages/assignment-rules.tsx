import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings, MapPin, Clock, Target, Trash2, Edit, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';

interface AssignmentRule {
  id: number;
  name: string;
  isActive: boolean;
  priority: number;
  useLocationBased: boolean;
  maxDistanceKm: string;
  useSpecializationBased: boolean;
  requiredSpecializations: string[];
  useWorkloadBased: boolean;
  maxOrdersPerTechnician: number;
  useTimeBased: boolean;
  availabilityRequired: boolean;
  applicableProducts: string[];
  applicableServices: string[];
  assignmentMethod: string;
  autoAssign: boolean;
  notifyCustomer: boolean;
  estimatedResponseTime: number;
  createdAt: string;
  updatedAt: string;
}

const assignmentRuleSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  priority: z.number().min(1).max(10),
  useLocationBased: z.boolean(),
  maxDistanceKm: z.string().optional(),
  useSpecializationBased: z.boolean(),
  requiredSpecializations: z.array(z.string()).optional(),
  useWorkloadBased: z.boolean(),
  maxOrdersPerTechnician: z.number().min(1).optional(),
  useTimeBased: z.boolean(),
  availabilityRequired: z.boolean(),
  assignmentMethod: z.string(),
  autoAssign: z.boolean(),
  notifyCustomer: z.boolean(),
  estimatedResponseTime: z.number().min(1),
});

const specializations = [
  'air_conditioning',
  'electrical',
  'plumbing',
  'heating',
  'appliance_repair',
  'installation',
  'maintenance',
  'emergency_service'
];

const assignmentMethods = [
  { value: 'closest_available', label: 'Más cercano disponible' },
  { value: 'least_busy', label: 'Menos ocupado' },
  { value: 'highest_skill', label: 'Mayor habilidad' },
  { value: 'round_robin', label: 'Rotación equitativa' }
];

export default function AssignmentRules() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['/api/assignment-rules'],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/assignment-rules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignment-rules'] });
      setIsDialogOpen(false);
      setEditingRule(null);
      toast({
        title: 'Regla creada',
        description: 'La regla de asignación fue creada exitosamente',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Error al crear la regla de asignación',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest('PUT', `/api/assignment-rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignment-rules'] });
      setIsDialogOpen(false);
      setEditingRule(null);
      toast({
        title: 'Regla actualizada',
        description: 'La regla de asignación fue actualizada exitosamente',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Error al actualizar la regla de asignación',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/assignment-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignment-rules'] });
      toast({
        title: 'Regla eliminada',
        description: 'La regla de asignación fue eliminada exitosamente',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Error al eliminar la regla de asignación',
        variant: 'destructive',
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      apiRequest('PUT', `/api/assignment-rules/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignment-rules'] });
    },
  });

  const form = useForm({
    resolver: zodResolver(assignmentRuleSchema),
    defaultValues: {
      name: '',
      priority: 1,
      useLocationBased: true,
      maxDistanceKm: '15.0',
      useSpecializationBased: true,
      requiredSpecializations: [],
      useWorkloadBased: true,
      maxOrdersPerTechnician: 5,
      useTimeBased: true,
      availabilityRequired: true,
      assignmentMethod: 'closest_available',
      autoAssign: true,
      notifyCustomer: true,
      estimatedResponseTime: 60,
    },
  });

  const handleEdit = (rule: AssignmentRule) => {
    setEditingRule(rule);
    form.reset({
      name: rule.name,
      priority: rule.priority,
      useLocationBased: rule.useLocationBased,
      maxDistanceKm: rule.maxDistanceKm,
      useSpecializationBased: rule.useSpecializationBased,
      requiredSpecializations: rule.requiredSpecializations || [],
      useWorkloadBased: rule.useWorkloadBased,
      maxOrdersPerTechnician: rule.maxOrdersPerTechnician,
      useTimeBased: rule.useTimeBased,
      availabilityRequired: rule.availabilityRequired,
      assignmentMethod: rule.assignmentMethod,
      autoAssign: rule.autoAssign,
      notifyCustomer: rule.notifyCustomer,
      estimatedResponseTime: rule.estimatedResponseTime,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (values: any) => {
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleToggleActive = (rule: AssignmentRule) => {
    toggleActiveMutation.mutate({
      id: rule.id,
      isActive: !rule.isActive,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reglas de Asignación Automática</h1>
          <p className="text-muted-foreground">
            Configura cómo se asignan automáticamente los técnicos a las órdenes
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingRule(null);
              form.reset();
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Regla
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Editar Regla' : 'Nueva Regla de Asignación'}
              </DialogTitle>
              <DialogDescription>
                Configura los criterios para la asignación automática de técnicos
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Regla</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Asignación por proximidad" {...field} />
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
                        <Input 
                          type="number" 
                          min="1" 
                          max="10" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Mayor número = mayor prioridad
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Criterios de Asignación</h3>
                  
                  <FormField
                    control={form.control}
                    name="useLocationBased"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base flex items-center">
                            <MapPin className="w-4 h-4 mr-2" />
                            Asignación por Ubicación
                          </FormLabel>
                          <FormDescription>
                            Considera la distancia entre técnico y cliente
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('useLocationBased') && (
                    <FormField
                      control={form.control}
                      name="maxDistanceKm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Distancia Máxima (km)</FormLabel>
                          <FormControl>
                            <Input placeholder="15.0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="useSpecializationBased"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base flex items-center">
                            <Settings className="w-4 h-4 mr-2" />
                            Asignación por Especialización
                          </FormLabel>
                          <FormDescription>
                            Requiere especialidades específicas del técnico
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('useSpecializationBased') && (
                    <FormField
                      control={form.control}
                      name="requiredSpecializations"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Especializaciones Requeridas</FormLabel>
                          <div className="grid grid-cols-2 gap-2">
                            {specializations.map((spec) => (
                              <div key={spec} className="flex items-center space-x-2">
                                <Checkbox
                                  id={spec}
                                  checked={field.value?.includes(spec)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, spec]);
                                    } else {
                                      field.onChange(current.filter((s) => s !== spec));
                                    }
                                  }}
                                />
                                <label htmlFor={spec} className="text-sm capitalize">
                                  {spec.replace('_', ' ')}
                                </label>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="useWorkloadBased"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base flex items-center">
                            <Target className="w-4 h-4 mr-2" />
                            Asignación por Carga de Trabajo
                          </FormLabel>
                          <FormDescription>
                            Considera órdenes actuales del técnico
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('useWorkloadBased') && (
                    <FormField
                      control={form.control}
                      name="maxOrdersPerTechnician"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Máximo de Órdenes por Técnico</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Comportamiento de Asignación</h3>
                  
                  <FormField
                    control={form.control}
                    name="assignmentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método de Asignación</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un método" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {assignmentMethods.map((method) => (
                              <SelectItem key={method.value} value={method.value}>
                                {method.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estimatedResponseTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tiempo Estimado de Respuesta (minutos)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="autoAssign"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Asignación Automática</FormLabel>
                          <FormDescription>
                            Asignar automáticamente o solo sugerir
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notifyCustomer"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Notificar Cliente</FormLabel>
                          <FormDescription>
                            Enviar notificación al cliente sobre la asignación
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingRule ? 'Actualizar' : 'Crear'} Regla
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rules.map((rule: AssignmentRule) => (
            <Card key={rule.id} className={rule.isActive ? 'border-green-200' : 'border-gray-200'}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{rule.name}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      Prioridad {rule.priority}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(rule)}
                    >
                      {rule.isActive ? (
                        <ToggleRight className="w-4 h-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  {rule.isActive ? 'Activa' : 'Inactiva'} • 
                  Método: {assignmentMethods.find(m => m.value === rule.assignmentMethod)?.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Ubicación</span>
                    <Badge variant={rule.useLocationBased ? 'default' : 'secondary'}>
                      {rule.useLocationBased ? 'Sí' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Especialización</span>
                    <Badge variant={rule.useSpecializationBased ? 'default' : 'secondary'}>
                      {rule.useSpecializationBased ? 'Sí' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Carga de trabajo</span>
                    <Badge variant={rule.useWorkloadBased ? 'default' : 'secondary'}>
                      {rule.useWorkloadBased ? 'Sí' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Auto-asignar</span>
                    <Badge variant={rule.autoAssign ? 'default' : 'secondary'}>
                      {rule.autoAssign ? 'Sí' : 'No'}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex justify-between mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEdit(rule)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => deleteMutation.mutate(rule.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {rules.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Settings className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay reglas configuradas</h3>
            <p className="text-muted-foreground mb-4">
              Crea tu primera regla de asignación automática para optimizar la distribución de órdenes
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Primera Regla
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}