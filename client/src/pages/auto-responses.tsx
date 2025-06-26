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
import { Plus, Edit, Trash2, MessageSquare, Users, Settings, Bot } from "lucide-react";

interface MenuOption {
  label: string;
  value: string;
  action: string;
}

export default function AutoResponsesPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResponse, setEditingResponse] = useState<AutoResponse | null>(null);
  const [formData, setFormData] = useState<Partial<InsertAutoResponse>>({
    name: "",
    trigger: "welcome",
    messageText: "",
    isActive: true,
    priority: 1,
    requiresRegistration: false,
    menuOptions: "",
    nextAction: "next_menu"
  });

  // Fetch auto responses
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["/api/auto-responses"],
  });

  // Create/Update response mutation
  const createResponseMutation = useMutation({
    mutationFn: async (data: Partial<InsertAutoResponse>) => {
      const url = editingResponse ? `/api/auto-responses/${editingResponse.id}` : "/api/auto-responses";
      const method = editingResponse ? "PATCH" : "POST";
      return apiRequest(url, method, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-responses"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingResponse ? "Respuesta actualizada" : "Respuesta creada",
        description: "La configuración se ha guardado correctamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    },
  });

  // Delete response mutation
  const deleteResponseMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/auto-responses/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auto-responses"] });
      toast({
        title: "Respuesta eliminada",
        description: "La configuración se ha eliminado correctamente.",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      trigger: "welcome",
      messageText: "",
      isActive: true,
      priority: 1,
      requiresRegistration: false,
      menuOptions: "",
      nextAction: "next_menu"
    });
    setEditingResponse(null);
  };

  const handleEdit = (response: AutoResponse) => {
    setEditingResponse(response);
    setFormData({
      name: response.name,
      trigger: response.trigger,
      messageText: response.messageText,
      isActive: response.isActive || true,
      priority: response.priority || 1,
      requiresRegistration: response.requiresRegistration || false,
      menuOptions: response.menuOptions || "",
      nextAction: response.nextAction || "next_menu"
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createResponseMutation.mutate(formData);
  };

  const triggerOptions = [
    { value: "welcome", label: "Mensaje de Bienvenida" },
    { value: "menu", label: "Menú Principal" },
    { value: "product_inquiry", label: "Consulta de Productos" },
    { value: "service_inquiry", label: "Consulta de Servicios" },
    { value: "contact_request", label: "Solicitud de Contacto" },
    { value: "registration", label: "Registro de Cliente" }
  ];

  const nextActionOptions = [
    { value: "next_menu", label: "Mostrar Siguiente Menú" },
    { value: "collect_data", label: "Recopilar Datos" },
    { value: "create_order", label: "Crear Pedido" },
    { value: "assign_technician", label: "Asignar Técnico" },
    { value: "end_conversation", label: "Finalizar Conversación" }
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
                  <Select value={formData.trigger} onValueChange={(value) => setFormData({ ...formData, trigger: value })}>
                    <SelectTrigger>
                      <SelectValue />
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
                <Label htmlFor="messageText">Mensaje</Label>
                <Textarea
                  id="messageText"
                  value={formData.messageText}
                  onChange={(e) => setFormData({ ...formData, messageText: e.target.value })}
                  placeholder="Escriba el mensaje que se enviará automáticamente..."
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="menuOptions">Opciones del Menú (JSON)</Label>
                <Textarea
                  id="menuOptions"
                  value={formData.menuOptions}
                  onChange={(e) => setFormData({ ...formData, menuOptions: e.target.value })}
                  placeholder='[{"label": "Ver Productos", "value": "products", "action": "show_products"}]'
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Formato JSON para opciones interactivas (opcional)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nextAction">Acción Siguiente</Label>
                  <Select value={formData.nextAction} onValueChange={(value) => setFormData({ ...formData, nextAction: value })}>
                    <SelectTrigger>
                      <SelectValue />
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
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    min="1"
                    max="10"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label htmlFor="isActive">Activo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requiresRegistration"
                    checked={formData.requiresRegistration}
                    onCheckedChange={(checked) => setFormData({ ...formData, requiresRegistration: checked })}
                  />
                  <Label htmlFor="requiresRegistration">Requiere Registro</Label>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createResponseMutation.isPending}>
                  {createResponseMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Responses List */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {responses.map((response: AutoResponse) => (
          <Card key={response.id} className={`transition-all hover:shadow-md ${!response.isActive ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  {response.name}
                </CardTitle>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(response)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteResponseMutation.mutate(response.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  response.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {response.isActive ? 'Activo' : 'Inactivo'}
                </span>
                <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                  {triggerOptions.find(t => t.value === response.trigger)?.label || response.trigger}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                {response.messageText}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Prioridad: {response.priority}</span>
                <span>
                  {response.requiresRegistration && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Registro requerido
                    </span>
                  )}
                </span>
              </div>
              {response.menuOptions && (
                <div className="mt-2 text-xs text-blue-600">
                  ✓ Incluye opciones interactivas
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {responses.length === 0 && (
        <Card className="p-8 text-center">
          <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay respuestas configuradas</h3>
          <p className="text-muted-foreground mb-4">
            Cree su primera respuesta automática para comenzar
          </p>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Crear Primera Respuesta
          </Button>
        </Card>
      )}

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración de Menús Interactivos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800">
          <div className="space-y-2 text-sm">
            <p><strong>Formato de opciones JSON:</strong></p>
            <pre className="bg-blue-100 p-3 rounded text-xs">
{`[
  {
    "label": "Ver Productos",
    "value": "products",
    "action": "show_products"
  },
  {
    "label": "Contactar Técnico",
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
        </CardContent>
      </Card>
    </div>
  );
}