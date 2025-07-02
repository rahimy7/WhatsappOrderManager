import { useState, useEffect } from "react";
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
import { Plus, Edit, Trash2, MessageSquare, Users, Settings, Bot, RotateCcw, Clock, ArrowLeft, Shield, Minus, HelpCircle, Book, Info } from "lucide-react";

interface MenuOption {
  label: string;
  value: string;
  action: string;
}

// Component for editing menu options visually
function MenuOptionsEditor({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const [options, setOptions] = useState<MenuOption[]>(() => {
    try {
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const newOptions = value ? JSON.parse(value) : [];
      setOptions(newOptions);
    } catch {
      setOptions([]);
    }
  }, [value]);

  const updateOptions = (newOptions: MenuOption[]) => {
    setOptions(newOptions);
    onChange(JSON.stringify(newOptions));
  };

  const addOption = () => {
    updateOptions([...options, { label: "", value: "", action: "" }]);
  };

  const removeOption = (index: number) => {
    updateOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, field: keyof MenuOption, value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    updateOptions(newOptions);
  };

  const actionOptions = [
    { value: "show_products", label: "Mostrar Productos" },
    { value: "show_services", label: "Mostrar Servicios" },
    { value: "show_menu", label: "Mostrar Menú" },
    { value: "show_help", label: "Mostrar Ayuda" },
    { value: "contact_technician", label: "Contactar Técnico" },
    { value: "start_order", label: "Iniciar Pedido" },
    { value: "track_order", label: "Rastrear Pedido" },
    { value: "select_product", label: "Seleccionar Producto" },
    { value: "select_service", label: "Seleccionar Servicio" },
    { value: "wait_selection", label: "Esperar Selección" },
    { value: "end_conversation", label: "Finalizar Conversación" }
  ];

  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <Label className="text-xs">Texto del Botón</Label>
              <Input
                value={option.label}
                onChange={(e) => updateOption(index, 'label', e.target.value)}
                placeholder="Ej: Ver Productos"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Valor</Label>
              <Input
                value={option.value}
                onChange={(e) => updateOption(index, 'value', e.target.value)}
                placeholder="Ej: products"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Acción</Label>
              <Select
                value={option.action}
                onValueChange={(value) => updateOption(index, 'action', value)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {actionOptions.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeOption(index)}
            className="h-6 px-2 text-xs text-red-600 hover:bg-red-50"
          >
            <Minus className="h-3 w-3 mr-1" />
            Eliminar
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addOption}
        className="w-full h-8 text-sm border-dashed"
      >
        <Plus className="h-3 w-3 mr-1" />
        Agregar Opción
      </Button>
    </div>
  );
}

export default function AutoResponsesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Fixed Header */}
      <div className="bg-white border-b border-gray-200 p-6 flex-shrink-0">
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
              onClick={() => setIsHelpDialogOpen(true)}
              className="border-green-200 text-green-700 hover:bg-green-50"
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              Ayuda
            </Button>
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
                    <Label>Opciones de Menú Interactivo</Label>
                    <MenuOptionsEditor
                      value={formData.menuOptions}
                      onChange={(menuOptions) => setFormData({ ...formData, menuOptions })}
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
                  <div className="text-xs font-medium text-gray-500 mb-2">
                    Botones de menú interactivo:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {JSON.parse(response.menuOptions).map((option: MenuOption, index: number) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                        <div className="text-xs font-medium text-gray-800">{option.label}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="bg-blue-100 text-blue-700 px-1 rounded text-xs">{option.value}</span>
                          {option.action && (
                            <span className="ml-1 bg-green-100 text-green-700 px-1 rounded text-xs">{option.action}</span>
                          )}
                        </div>
                      </div>
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

      {/* Modal de Ayuda */}
      <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Book className="h-5 w-5 text-green-600" />
              Guía de Respuestas Automáticas
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Sección 1: Introducción */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                ¿Qué son las Respuestas Automáticas?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Las respuestas automáticas permiten configurar mensajes que se envían automáticamente cuando los clientes 
                interactúan con WhatsApp usando palabras clave específicas. Esto ayuda a brindar respuestas instantáneas 
                y mejorar la experiencia del cliente las 24 horas del día.
              </p>
            </div>

            {/* Sección 2: Cómo Crear/Editar */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Cómo Crear o Editar Respuestas
              </h3>
              <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-800">Para crear una nueva respuesta:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700 text-sm">
                    <li>Haz clic en el botón "Nueva Respuesta" en la parte superior derecha</li>
                    <li>Completa el formulario con los campos requeridos</li>
                    <li>Configura las opciones avanzadas según tus necesidades</li>
                    <li>Activa la respuesta usando el interruptor "Respuesta activa"</li>
                    <li>Haz clic en "Crear" para guardar</li>
                  </ol>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-800">Para editar una respuesta existente:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700 text-sm">
                    <li>Busca la tarjeta de la respuesta que deseas modificar</li>
                    <li>Haz clic en el ícono de lápiz (editar) en la esquina superior derecha de la tarjeta</li>
                    <li>Modifica los campos necesarios en el formulario</li>
                    <li>Haz clic en "Actualizar" para guardar los cambios</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Sección 3: Campos del Formulario */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                Campos del Formulario
              </h3>
              <div className="grid gap-4">
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-800">Nombre *</h4>
                  <p className="text-sm text-gray-600">Nombre descriptivo para identificar la respuesta en el panel de administración.</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-800">Mensaje de Respuesta *</h4>
                  <p className="text-sm text-gray-600">El texto que se enviará a los clientes. Puede incluir emojis y saltos de línea.</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-800">Palabra Clave (Trigger) *</h4>
                  <p className="text-sm text-gray-600">
                    La palabra o frase que activará esta respuesta. Ejemplos: "menu", "ayuda", "productos", "servicios".
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-800">Opciones de Menú</h4>
                  <p className="text-sm text-gray-600">
                    Botones interactivos que aparecerán debajo del mensaje. Formato JSON con label, value y action.
                  </p>
                </div>
              </div>
            </div>

            {/* Sección 4: Opciones Avanzadas */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                Opciones Avanzadas
              </h3>
              <div className="grid gap-4">
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-800">Tipo de Menú</h4>
                  <p className="text-sm text-gray-600">
                    <strong>Botones:</strong> Muestra opciones como botones interactivos<br/>
                    <strong>Lista:</strong> Muestra opciones en una lista desplegable
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-800">Tiempo de Espera</h4>
                  <p className="text-sm text-gray-600">
                    Tiempo en segundos que el sistema esperará una respuesta del cliente (30-3600 segundos).
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-800">Máximo Reintentos</h4>
                  <p className="text-sm text-gray-600">
                    Número de veces que el sistema intentará enviar el mensaje en caso de falla (1-10 intentos).
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="font-medium text-gray-800">Prioridad</h4>
                  <p className="text-sm text-gray-600">
                    Orden de procesamiento cuando múltiples respuestas coinciden (1 = mayor prioridad).
                  </p>
                </div>
              </div>
            </div>

            {/* Sección 5: Ejemplo de Configuración */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                Ejemplo de Configuración de Menú
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Formato JSON para Opciones de Menú:</h4>
                <pre className="text-xs overflow-x-auto bg-white p-3 rounded border">
{`[
  {
    "label": "Ver Productos",
    "value": "products",
    "action": "show_products"
  },
  {
    "label": "Ver Servicios", 
    "value": "services",
    "action": "show_services"
  },
  {
    "label": "Contactar Soporte",
    "value": "support",
    "action": "contact_support"
  }
]`}
                </pre>
                <p className="text-sm text-gray-600 mt-2">
                  <strong>label:</strong> Texto que verá el cliente<br/>
                  <strong>value:</strong> Valor interno para identificar la opción<br/>
                  <strong>action:</strong> Acción que se ejecutará al seleccionar la opción
                </p>
              </div>
            </div>

            {/* Sección 6: Triggers Disponibles */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <ArrowLeft className="h-5 w-5 text-blue-600" />
                Triggers (Palabras Clave) Disponibles
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="bg-green-50 p-3 rounded">
                    <span className="font-medium text-green-800">welcome</span>
                    <p className="text-xs text-green-600">Mensaje de bienvenida inicial</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded">
                    <span className="font-medium text-blue-800">menu</span>
                    <p className="text-xs text-blue-600">Mostrar menú principal</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <span className="font-medium text-purple-800">show_products</span>
                    <p className="text-xs text-purple-600">Mostrar catálogo de productos</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="bg-orange-50 p-3 rounded">
                    <span className="font-medium text-orange-800">show_services</span>
                    <p className="text-xs text-orange-600">Mostrar servicios disponibles</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded">
                    <span className="font-medium text-red-800">show_help</span>
                    <p className="text-xs text-red-600">Mostrar ayuda y soporte</p>
                  </div>
                  <div className="bg-teal-50 p-3 rounded">
                    <span className="font-medium text-teal-800">main_menu</span>
                    <p className="text-xs text-teal-600">Volver al menú principal</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sección 7: Gestión de Respuestas */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Switch className="h-5 w-5 text-blue-600" />
                Gestión de Respuestas
              </h3>
              <div className="grid gap-3">
                <div className="bg-green-50 p-3 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-1">Activar/Desactivar</h4>
                  <p className="text-sm text-green-700">
                    Usa el interruptor en cada tarjeta para activar o desactivar respuestas sin eliminarlas.
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-1">Restaurar Valores</h4>
                  <p className="text-sm text-blue-700">
                    El botón "Restaurar Valores" elimina todas las respuestas personalizadas y restaura las predeterminadas.
                  </p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-1">Eliminar Respuestas</h4>
                  <p className="text-sm text-red-700">
                    Usa el ícono de papelera para eliminar permanentemente una respuesta personalizada.
                  </p>
                </div>
              </div>
            </div>

            {/* Botón de cerrar */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setIsHelpDialogOpen(false)} className="bg-green-600 hover:bg-green-700">
                Entendido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}