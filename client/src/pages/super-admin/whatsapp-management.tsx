import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, MessageCircle, TestTube, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface WhatsAppConfig {
  id?: number;
  accessToken: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  businessAccountId: string | null;
  appId: string | null;
  isActive: boolean;
  storeId: number;
  storeName?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface VirtualStore {
  id: number;
  name: string;
  description: string;
  domain: string;
  isActive: boolean;
  schema: string;
  createdAt: string;
  updatedAt: string;
}

const configSchema = z.object({
  storeId: z.number().min(1, "Seleccione una tienda"),
  accessToken: z.string().min(20, "Token de acceso debe tener al menos 20 caracteres"),
  phoneNumberId: z.string().min(10, "Phone Number ID requerido"),
  webhookVerifyToken: z.string().min(8, "Webhook verify token debe tener al menos 8 caracteres"),
  businessAccountId: z.string().optional(),
  appId: z.string().optional(),
  isActive: z.boolean().default(true)
});

type ConfigFormData = z.infer<typeof configSchema>;

export default function WhatsAppManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WhatsAppConfig | null>(null);
  const [showTokens, setShowTokens] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch WhatsApp configs
  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ["/api/super-admin/whatsapp-configs"],
    staleTime: 30000,
  });

  // Fetch stores
  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ["/api/super-admin/stores"],
    staleTime: 60000,
  });

  // Create config mutation
  const createConfigMutation = useMutation({
    mutationFn: (data: ConfigFormData) => apiRequest("POST", "/api/super-admin/whatsapp-configs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/whatsapp-configs"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Configuración creada",
        description: "La configuración de WhatsApp se creó exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear la configuración",
        variant: "destructive",
      });
    },
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ConfigFormData }) =>
      apiRequest("PUT", `/api/super-admin/whatsapp-configs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/whatsapp-configs"] });
      setEditingConfig(null);
      toast({
        title: "Configuración actualizada",
        description: "La configuración de WhatsApp se actualizó exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la configuración",
        variant: "destructive",
      });
    },
  });

  // Delete config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/super-admin/whatsapp-configs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/whatsapp-configs"] });
      toast({
        title: "Configuración eliminada",
        description: "La configuración de WhatsApp se eliminó exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar la configuración",
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: ({ storeId, phoneNumberId }: { storeId: number; phoneNumberId: string }) =>
      apiRequest("POST", "/api/super-admin/whatsapp-test", { storeId, phoneNumberId }),
    onSuccess: (result: any) => {
      if (result.success) {
        toast({
          title: "Conexión exitosa",
          description: result.message || "La configuración de WhatsApp es válida",
        });
      } else {
        toast({
          title: "Error de conexión",
          description: result.message || "La configuración no es válida",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error de prueba",
        description: error.message || "Error al probar la conexión",
        variant: "destructive",
      });
    },
  });

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      storeId: 0,
      accessToken: "",
      phoneNumberId: "",
      webhookVerifyToken: "",
      businessAccountId: "",
      appId: "",
      isActive: true,
    },
  });

  const openEditDialog = (config?: WhatsAppConfig) => {
    if (config) {
      setEditingConfig(config);
      form.reset({
        storeId: config.storeId,
        accessToken: config.accessToken,
        phoneNumberId: config.phoneNumberId,
        webhookVerifyToken: config.webhookVerifyToken,
        businessAccountId: config.businessAccountId || "",
        appId: config.appId || "",
        isActive: config.isActive,
      });
    } else {
      setEditingConfig(null);
      form.reset({
        storeId: 0,
        accessToken: "",
        phoneNumberId: "",
        webhookVerifyToken: "",
        businessAccountId: "",
        appId: "",
        isActive: true,
      });
      setIsCreateDialogOpen(true);
    }
  };

  const onSubmit = (data: ConfigFormData) => {
    if (editingConfig?.id) {
      updateConfigMutation.mutate({ id: editingConfig.id, data });
    } else {
      createConfigMutation.mutate(data);
    }
  };

  const toggleTokenVisibility = (configId: number) => {
    setShowTokens(prev => ({
      ...prev,
      [configId]: !prev[configId]
    }));
  };

  const maskToken = (token: string, show: boolean) => {
    if (show || !token) return token;
    return `${token.substring(0, 8)}${'*'.repeat(Math.max(0, token.length - 16))}${token.substring(token.length - 8)}`;
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  if (configsLoading || storesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-lg text-gray-600">Cargando configuraciones...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-emerald-100 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MessageCircle className="h-8 w-8 text-emerald-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gestión Centralizada de WhatsApp</h1>
                <p className="text-gray-600 mt-1">Administra las configuraciones de WhatsApp Business API para todas las tiendas</p>
              </div>
            </div>
            <Button 
              onClick={() => openEditDialog()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Configuración
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/90 backdrop-blur-sm border-emerald-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Configuraciones</CardTitle>
              <MessageCircle className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{configs.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/90 backdrop-blur-sm border-emerald-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Configuraciones Activas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {configs.filter((c: WhatsAppConfig) => c.isActive).length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/90 backdrop-blur-sm border-emerald-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Tiendas Conectadas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {new Set(configs.map((c: WhatsAppConfig) => c.storeId)).size}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/90 backdrop-blur-sm border-emerald-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Tiendas Disponibles</CardTitle>
              <XCircle className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stores.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {configs.map((config: WhatsAppConfig) => (
            <Card key={config.id} className="bg-white/90 backdrop-blur-sm border-emerald-100 hover:shadow-lg transition-all duration-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-gray-900 flex items-center">
                    {getStatusIcon(config.isActive)}
                    <span className="ml-2">{config.storeName}</span>
                  </CardTitle>
                  <Badge variant={config.isActive ? "default" : "secondary"}>
                    {config.isActive ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <CardDescription>Store ID: {config.storeId}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Phone Number ID</Label>
                    <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                      {config.phoneNumberId}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-600 flex items-center">
                      Access Token
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTokenVisibility(config.id!)}
                        className="ml-2 h-6 w-6 p-0"
                      >
                        {showTokens[config.id!] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </Label>
                    <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded break-all">
                      {maskToken(config.accessToken, showTokens[config.id!])}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Webhook Verify Token</Label>
                    <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                      {maskToken(config.webhookVerifyToken, showTokens[config.id!])}
                    </p>
                  </div>
                  
                  {config.businessAccountId && (
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Business Account ID</Label>
                      <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
                        {config.businessAccountId}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnectionMutation.mutate({
                      storeId: config.storeId,
                      phoneNumberId: config.phoneNumberId
                    })}
                    disabled={testConnectionMutation.isPending}
                    className="flex-1"
                  >
                    <TestTube className="h-4 w-4 mr-1" />
                    {testConnectionMutation.isPending ? "Probando..." : "Probar"}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(config)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteConfigMutation.mutate(config.id!)}
                    disabled={deleteConfigMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {configs.length === 0 && (
          <Card className="bg-white/90 backdrop-blur-sm border-emerald-100">
            <CardContent className="text-center py-12">
              <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay configuraciones de WhatsApp</h3>
              <p className="text-gray-600 mb-6">Comienza creando una nueva configuración para conectar las tiendas con WhatsApp Business API</p>
              <Button onClick={() => openEditDialog()} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Configuración
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isCreateDialogOpen || !!editingConfig} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingConfig(null);
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? "Editar Configuración de WhatsApp" : "Nueva Configuración de WhatsApp"}
              </DialogTitle>
              <DialogDescription>
                {editingConfig 
                  ? "Modifica la configuración de WhatsApp Business API para esta tienda"
                  : "Crea una nueva configuración de WhatsApp Business API para una tienda"
                }
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="storeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tienda</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))} 
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tienda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stores.map((store: VirtualStore) => (
                            <SelectItem key={store.id} value={store.id.toString()}>
                              {store.name} (ID: {store.id})
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
                  name="accessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Token</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="EAAxxxxxxxxxx..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="123456789012345" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="webhookVerifyToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook Verify Token</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="verifytoken123" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="businessAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Account ID (Opcional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="123456789012345" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="appId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>App ID (Opcional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="123456789012345" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Configuración Activa</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Habilita o deshabilita esta configuración de WhatsApp
                        </div>
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

                <div className="flex justify-end space-x-2 pt-6">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setEditingConfig(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createConfigMutation.isPending || updateConfigMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {createConfigMutation.isPending || updateConfigMutation.isPending 
                      ? "Guardando..." 
                      : editingConfig ? "Actualizar" : "Crear"
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}