import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  Plus, 
  Search, 
  Settings, 
  Power, 
  PowerOff,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Edit,
  Trash2,
  Database
} from "lucide-react";

interface VirtualStore {
  id: number;
  name: string;
  description: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended';
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'cancelled';
  planType: 'basic' | 'premium' | 'enterprise';
  contactEmail: string;
  contactPhone: string;
  address: string;
  createdAt: string;
  lastActivity: string;
  monthlyOrders: number;
  monthlyRevenue: number;
  supportTickets: number;
  settings: {
    whatsappEnabled: boolean;
    notificationsEnabled: boolean;
    analyticsEnabled: boolean;
  };
}

const storeSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  description: z.string().min(1, "Descripción requerida"),
  domain: z.string().min(1, "Dominio requerido"),
  contactEmail: z.string().email("Email inválido"),
  contactPhone: z.string().min(1, "Teléfono requerido"),
  address: z.string().min(1, "Dirección requerida"),
  planType: z.enum(['basic', 'premium', 'enterprise']),
});

type StoreFormData = z.infer<typeof storeSchema>;

export default function StoresManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<VirtualStore | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  const { data: stores, isLoading, error } = useQuery({
    queryKey: ['/api/super-admin/stores'],
    queryFn: async () => {
      console.log('Executing query for stores...');
      const response = await apiRequest('GET', '/api/super-admin/stores');
      const data = await response.json();
      console.log('Raw response data:', data);
      return data;
    }
  });

  // Debug log para verificar datos
  console.log('Stores data received:', stores);
  console.log('Query error:', error);
  console.log('Is loading:', isLoading);

  const createStoreMutation = useMutation({
    mutationFn: async (data: StoreFormData) => {
      const response = await apiRequest("POST", "/api/super-admin/stores", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/stores'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Tienda creada",
        description: "La nueva tienda ha sido creada exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear la tienda",
        variant: "destructive",
      });
    }
  });

  const toggleStoreMutation = useMutation({
    mutationFn: async ({ storeId, action }: { storeId: number, action: 'enable' | 'disable' | 'suspend' }) => {
      const response = await apiRequest("PATCH", `/api/super-admin/stores/${storeId}/status`, { action });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/stores'] });
      toast({
        title: "Estado actualizado",
        description: "El estado de la tienda ha sido actualizado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar estado",
        variant: "destructive",
      });
    }
  });

  const form = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: "",
      description: "",
      domain: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      planType: "basic",
    },
  });

  const storesList: VirtualStore[] = Array.isArray(stores) ? stores : [];
  console.log('StoresList after processing:', storesList);
  console.log('Original stores data type:', typeof stores, stores);

  const filteredStores = storesList.filter(store => {
    const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         store.domain.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || store.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const onSubmit = (data: StoreFormData) => {
    createStoreMutation.mutate(data);
  };

  const handleToggleStore = (storeId: number, action: 'enable' | 'disable' | 'suspend') => {
    toggleStoreMutation.mutate({ storeId, action });
  };

  const handleValidateStore = async (storeId: number) => {
    try {
      const response = await apiRequest("GET", `/api/super-admin/stores/${storeId}/validate`);
      const validation = await response.json();
      
      if (!validation.valid) {
        // Si la validación falla, preguntar si quiere reparar
        const shouldRepair = confirm(
          `${validation.message}\n\n¿Deseas reparar automáticamente el ecosistema de base de datos?`
        );
        
        if (shouldRepair) {
          await handleRepairStore(storeId);
          return;
        }
      }
      
      toast({
        title: validation.valid ? "Ecosistema Válido" : "Problemas Detectados",
        description: validation.message || "Validación completada",
        variant: validation.valid ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Error en Validación",
        description: "No se pudo validar el ecosistema de la tienda",
        variant: "destructive",
      });
    }
  };

  const handleRepairStore = async (storeId: number) => {
    try {
      toast({
        title: "Reparando Ecosistema",
        description: "Iniciando reparación de base de datos...",
      });

      const response = await apiRequest("POST", `/api/super-admin/stores/${storeId}/repair`);
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Reparación Exitosa",
          description: result.message,
        });
        
        // Volver a validar después de la reparación
        setTimeout(() => {
          handleValidateStore(storeId);
        }, 1000);
      } else {
        toast({
          title: "Error en Reparación",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error en Reparación",
        description: "No se pudo reparar el ecosistema de la tienda",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Activa</Badge>;
      case 'inactive': return <Badge className="bg-gray-100 text-gray-800">Inactiva</Badge>;
      case 'suspended': return <Badge className="bg-red-100 text-red-800">Suspendida</Badge>;
      default: return <Badge>Desconocido</Badge>;
    }
  };

  const getSubscriptionBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Activa</Badge>;
      case 'trial': return <Badge className="bg-blue-100 text-blue-800">Prueba</Badge>;
      case 'expired': return <Badge className="bg-red-100 text-red-800">Vencida</Badge>;
      case 'cancelled': return <Badge className="bg-gray-100 text-gray-800">Cancelada</Badge>;
      default: return <Badge>Desconocido</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'basic': return <Badge variant="outline">Básico</Badge>;
      case 'premium': return <Badge className="bg-blue-100 text-blue-800">Premium</Badge>;
      case 'enterprise': return <Badge className="bg-purple-100 text-purple-800">Enterprise</Badge>;
      default: return <Badge>Desconocido</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Tiendas</h1>
          <p className="text-muted-foreground">Administra todas las tiendas virtuales del ecosistema</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Tienda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nueva Tienda</DialogTitle>
              <DialogDescription>
                Configura una nueva tienda virtual en la plataforma
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de la Tienda</FormLabel>
                        <FormControl>
                          <Input placeholder="Mi Tienda Virtual" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="domain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dominio</FormLabel>
                        <FormControl>
                          <Input placeholder="mi-tienda.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descripción de la tienda..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email de Contacto</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contacto@tienda.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input placeholder="+52 55 1234 5678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <Input placeholder="Dirección completa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="planType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan de Suscripción</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un plan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="basic">Básico - $29/mes</SelectItem>
                          <SelectItem value="premium">Premium - $59/mes</SelectItem>
                          <SelectItem value="enterprise">Enterprise - $99/mes</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createStoreMutation.isPending}>
                    {createStoreMutation.isPending ? "Creando..." : "Crear Tienda"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros y Búsqueda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar tiendas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="inactive">Inactivas</SelectItem>
                <SelectItem value="suspended">Suspendidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Tiendas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredStores.map((store) => (
          <Card key={store.id} className="relative">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{store.name}</CardTitle>
                  <CardDescription className="mt-1">{store.domain}</CardDescription>
                </div>
                <div className="flex gap-2">
                  {getStatusBadge(store.status)}
                  {getPlanBadge(store.planType)}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{store.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{store.contactEmail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{store.contactPhone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{store.address}</span>
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <div>
                  <div className="font-medium">{store.monthlyOrders}</div>
                  <div className="text-muted-foreground">Pedidos/mes</div>
                </div>
                <div>
                  <div className="font-medium">${store.monthlyRevenue.toLocaleString()}</div>
                  <div className="text-muted-foreground">Ingresos/mes</div>
                </div>
              </div>

              <div className="flex justify-between">
                {getSubscriptionBadge(store.subscriptionStatus)}
                {store.supportTickets > 0 && (
                  <Badge variant="outline" className="text-orange-600">
                    {store.supportTickets} tickets
                  </Badge>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex gap-2">
                  {store.status === 'active' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStore(store.id, 'disable')}
                      className="flex-1"
                    >
                      <PowerOff className="h-4 w-4 mr-2" />
                      Desactivar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStore(store.id, 'enable')}
                      className="flex-1"
                    >
                      <Power className="h-4 w-4 mr-2" />
                      Activar
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Navegando a configuración de tienda:', store.id);
                      setLocation(`/super-admin/store-settings?store=${store.id}`);
                    }}
                    title="Configurar tienda"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleValidateStore(store.id)}
                  title="Validar ecosistema de BD"
                  className="w-full bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Validar Ecosistema de BD
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStores.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron tiendas</h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== "all" 
                ? "Intenta ajustar los filtros de búsqueda"
                : "Crea tu primera tienda para comenzar"
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}