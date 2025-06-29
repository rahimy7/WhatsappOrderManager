import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AutoResponse, InsertAutoResponse } from "@shared/schema";
import { Plus, Edit, Trash2, MessageSquare, Users, Settings, Bot, RotateCcw, Clock, ArrowLeft, Shield } from "lucide-react";

interface MenuOption {
  label: string;
  value: string;
  action: string;
}

export default function AutoResponsesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<AutoResponse | null>(null);
  const [formData, setFormData] = useState<Partial<InsertAutoResponse>>({
    name: "",
    trigger: "",
    messageText: "",
    menuOptions: "",
    nextAction: "",
    menuType: "buttons",
    showBackButton: false,
    allowFreeText: true,
    responseTimeout: 300,
    maxRetries: 3,
    fallbackMessage: "",
    conditionalDisplay: "",
    isActive: true,
  });

  const { toast } = useToast();

  // Fetch auto responses
  const { data: responses, isLoading } = useQuery<AutoResponse[]>({
    queryKey: ["/api/auto-responses"],
  });

  // Create response mutation
  const createResponseMutation = useMutation({
    mutationFn: async (data: Partial<InsertAutoResponse>) => {
      return apiRequest("POST", "/api/auto-responses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-responses"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Respuesta creada",
        description: "La respuesta automática se ha creado correctamente.",
      });
    },
  });

  // Update response mutation
  const updateResponseMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertAutoResponse>) => {
      return apiRequest("PUT", `/api/auto-responses/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-responses"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Respuesta actualizada",
        description: "La respuesta automática se ha actualizado correctamente.",
      });
    },
  });

  // Delete response mutation
  const deleteResponseMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/auto-responses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-responses"] });
      toast({
        title: "Respuesta eliminada",
        description: "La configuración se ha eliminado correctamente.",
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      console.log(`Toggling response ${id} to ${isActive}`);
      return apiRequest("PUT", `/api/auto-responses/${id}`, { isActive });
    },
    onSuccess: (data) => {
      console.log('Toggle success:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/auto-responses"] });
      toast({
        title: "Estado actualizado",
        description: "El estado de la respuesta se ha actualizado correctamente.",
      });
    },
    onError: (error) => {
      console.error('Toggle error:', error);
      toast({
        title: "Error",
        description: `No se pudo actualizar el estado: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Reset to defaults mutation
  const resetToDefaultsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auto-responses/reset-defaults");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-responses"] });
      toast({
        title: "Valores restaurados",
        description: "Se han restaurado las respuestas automáticas por defecto.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron restaurar los valores por defecto.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      trigger: "",
      messageText: "",
      menuOptions: "",
      nextAction: "",
      menuType: "buttons",
      showBackButton: false,
      allowFreeText: true,
      responseTimeout: 300,
      maxRetries: 3,
      fallbackMessage: "",
      conditionalDisplay: "",
      isActive: true,
    });
    setEditingResponse(null);
  };

  const handleEdit = (response: AutoResponse) => {
    setEditingResponse(response);
    setFormData({
      name: response.name,
      trigger: response.trigger,
      messageText: response.messageText,
      menuOptions: response.menuOptions || "",
      nextAction: response.nextAction || "",
      menuType: response.menuType || "buttons",
      showBackButton: response.showBackButton ?? false,
      allowFreeText: response.allowFreeText ?? true,
      responseTimeout: response.responseTimeout ?? 300,
      maxRetries: response.maxRetries ?? 3,
      fallbackMessage: response.fallbackMessage || "",
      conditionalDisplay: response.conditionalDisplay || "",
      isActive: response.isActive ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingResponse) {
      updateResponseMutation.mutate({ id: editingResponse.id, ...formData });
    } else {
      createResponseMutation.mutate(formData);
    }
  };

  const triggerOptions = [
    { value: "welcome", label: "Mensaje de Bienvenida" },
    { value: "menu", label: "Menú Principal" },
    { value: "product_inquiry", label: "Consulta de Productos" },
    { value: "service_inquiry", label: "Consulta de Servicios" },
    { value: "contact_request", label: "Solicitud de Contacto" },
    { value: "registration", label: "Registro de Cliente" },
    { value: "order_status", label: "Estado de Orden" },
    { value: "support", label: "Soporte Técnico" },
    { value: "tracking", label: "Seguimiento" },
    { value: "payment", label: "Información de Pago" },
    { value: "warranty", label: "Garantía" },
    { value: "feedback", label: "Comentarios" }
  ];

  const nextActionOptions = [
    { value: "next_menu", label: "Mostrar siguiente menú" },
    { value: "collect_data", label: "Recopilar información" },
    { value: "create_order", label: "Crear orden" },
    { value: "assign_technician", label: "Asignar técnico" },
    { value: "show_products", label: "Mostrar productos" },
    { value: "show_services", label: "Mostrar servicios" },
    { value: "request_location", label: "Solicitar ubicación" },
    { value: "calculate_price", label: "Calcular precio" },
    { value: "schedule_appointment", label: "Programar cita" },
    { value: "end_conversation", label: "Finalizar conversación" }
  ];

  const menuTypeOptions = [
    { value: "buttons", label: "Botones Interactivos" },
    { value: "list", label: "Lista Desplegable" },
    { value: "quick_reply", label: "Respuestas Rápidas" },
    { value: "text_only", label: "Solo Texto" }
  ];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-8 w-8 text-blue-600" />
            Respuestas Automáticas
          </h1>
          <p className="text-muted-foreground">
            Configure respuestas automáticas y menús interactivos para WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => resetToDefaultsMutation.mutate()}
            disabled={resetToDefaultsMutation.isPending}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {resetToDefaultsMutation.isPending ? "Restaurando..." : "Restaurar Valores"}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Respuesta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingResponse ? "Editar Respuesta Automática" : "Nueva Respuesta Automática"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: Menú Principal"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trigger">Disparador</Label>
                    <Select
                      value={formData.trigger}
                      onValueChange={(value) => setFormData({ ...formData, trigger: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un disparador" />
                      </SelectTrigger>
                      <SelectContent>
                        {triggerOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Contenido del Mensaje</Label>
                  <Textarea
                    id="content"
                    value={formData.messageText}
                    onChange={(e) => setFormData({ ...formData, messageText: e.target.value })}
                    placeholder="Mensaje que se enviará automáticamente..."
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="menuOptions">Opciones de Menú (JSON)</Label>
                    <Textarea
                      id="menuOptions"
                      value={formData.menuOptions || ""}
                      onChange={(e) => setFormData({ ...formData, menuOptions: e.target.value })}
                      placeholder='[{"label": "Opción 1", "value": "1", "action": "next"}]'
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nextAction">Siguiente Acción</Label>
                    <Select
                      value={formData.nextAction || ""}
                      onValueChange={(value) => setFormData({ ...formData, nextAction: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione acción" />
                      </SelectTrigger>
                      <SelectContent>
                        {nextActionOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Configuraciones avanzadas */}
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium text-gray-900">Configuraciones Avanzadas</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="menuType">Tipo de Menú</Label>
                      <Select
                        value={formData.menuType || "buttons"}
                        onValueChange={(value) => setFormData({ ...formData, menuType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {menuTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="responseTimeout">Tiempo de Espera (seg)</Label>
                      <Input
                        id="responseTimeout"
                        type="number"
                        value={formData.responseTimeout || 300}
                        onChange={(e) => setFormData({ ...formData, responseTimeout: parseInt(e.target.value) || 300 })}
                        min="30"
                        max="3600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxRetries">Máximo Reintentos</Label>
                      <Input
                        id="maxRetries"
                        type="number"
                        value={formData.maxRetries || 3}
                        onChange={(e) => setFormData({ ...formData, maxRetries: parseInt(e.target.value) || 3 })}
                        min="1"
                        max="10"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="fallbackMessage">Mensaje de Respaldo</Label>
                      <Input
                        id="fallbackMessage"
                        value={formData.fallbackMessage || ""}
                        onChange={(e) => setFormData({ ...formData, fallbackMessage: e.target.value })}
                        placeholder="Mensaje si no hay respuesta"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conditionalDisplay">Condiciones de Visualización</Label>
                    <Input
                      id="conditionalDisplay"
                      value={formData.conditionalDisplay || ""}
                      onChange={(e) => setFormData({ ...formData, conditionalDisplay: e.target.value })}
                      placeholder="ej: customer.isVip = true"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="showBackButton"
                        checked={Boolean(formData.showBackButton)}
                        onCheckedChange={(checked) => setFormData({ ...formData, showBackButton: checked })}
                      />
                      <Label htmlFor="showBackButton">Mostrar botón "Atrás"</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="allowFreeText"
                        checked={Boolean(formData.allowFreeText)}
                        onCheckedChange={(checked) => setFormData({ ...formData, allowFreeText: checked })}
                      />
                      <Label htmlFor="allowFreeText">Permitir texto libre</Label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 border-t pt-4">
                  <Switch
                    id="isActive"
                    checked={Boolean(formData.isActive)}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Respuesta activa</Label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createResponseMutation.isPending || updateResponseMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {createResponseMutation.isPending || updateResponseMutation.isPending
                      ? "Guardando..."
                      : editingResponse
                      ? "Actualizar"
                      : "Crear"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lista de respuestas automáticas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {responses?.map((response: AutoResponse) => (
          <Card key={response.id} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  {response.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(response.isActive)}
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ id: response.id, isActive: checked })
                      }
                      disabled={toggleActiveMutation.isPending}
                    />
                    {response.isActive ? (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                        Activo
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(response)}
                      className="h-8 w-8 p-0 hover:bg-blue-50"
                    >
                      <Edit className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteResponseMutation.mutate(response.id)}
                      disabled={deleteResponseMutation.isPending}
                      className="h-8 w-8 p-0 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                  {response.trigger}
                </span>
                {response.menuType && (
                  <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium">
                    {menuTypeOptions.find(opt => opt.value === response.menuType)?.label || response.menuType}
                  </span>
                )}
                {response.priority && (
                  <span className="text-xs">
                    Prioridad: {response.priority}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                {response.messageText}
              </p>
              
              {/* Configuraciones avanzadas */}
              <div className="space-y-1 mb-3">
                {response.responseTimeout !== 300 && (
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3 text-orange-500" />
                    <span className="text-orange-700">Tiempo: {response.responseTimeout}s</span>
                  </div>
                )}
                {response.maxRetries !== 3 && (
                  <div className="flex items-center gap-2 text-xs">
                    <RotateCcw className="h-3 w-3 text-purple-500" />
                    <span className="text-purple-700">Reintentos: {response.maxRetries}</span>
                  </div>
                )}
                {response.showBackButton && (
                  <div className="flex items-center gap-2 text-xs">
                    <ArrowLeft className="h-3 w-3 text-blue-500" />
                    <span className="text-blue-700">Con botón atrás</span>
                  </div>
                )}
                {!response.allowFreeText && (
                  <div className="flex items-center gap-2 text-xs">
                    <Shield className="h-3 w-3 text-red-500" />
                    <span className="text-red-700">Solo opciones predefinidas</span>
                  </div>
                )}
              </div>
              
              {response.menuOptions && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    Opciones de menú:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {JSON.parse(response.menuOptions).map((option: MenuOption, index: number) => (
                      <span key={index} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                        {option.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {response.nextAction && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Settings className="h-3 w-3" />
                  <span>Siguiente: {nextActionOptions.find(opt => opt.value === response.nextAction)?.label || response.nextAction}</span>
                </div>
              )}
              
              {/* Condiciones de visualización */}
              {response.conditionalDisplay && (
                <div className="mt-2 pt-2 border-t">
                  <div className="text-xs font-medium text-gray-500 mb-1">Condiciones:</div>
                  <code className="text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded block">
                    {response.conditionalDisplay}
                  </code>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Documentación */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600" />
            Configuración de Respuestas Automáticas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-gray-600">
            <p>
              Las respuestas automáticas permiten configurar mensajes que se envían automáticamente 
              cuando los clientes interactúan con WhatsApp usando palabras clave específicas.
            </p>
            
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Ejemplo de configuración de menú:</h4>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
{`[
  {
    "label": "Ver productos",
    "value": "products",
    "action": "show_products"
  },
  {
    "label": "Contactar técnico",
    "value": "technician",
    "action": "assign_technician"
  }
]`}
              </pre>
              <p className="mt-2">
                <strong>Disparadores disponibles:</strong> welcome (bienvenida), menu (menú), 
                product_inquiry (productos), service_inquiry (servicios), contact_request (contacto)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}