// VERSIÓN COMPLETA de src/pages/super-admin/stores.tsx con TODAS las funciones

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  Search, 
  Settings, 
  Package, 
  Database,
  MessageCircle,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Edit3,
  Power,
  PowerOff
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ✅ INTERFACES COMPLETAS
interface Store {
  id: number;
  name: string;
  description: string;
  domain: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppConfig {
  id: number;
  storeId: number;
  accessToken: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  businessAccountId?: string;
  appId?: string;
  isActive: boolean;
  storeName?: string;
}

interface WhatsAppFormData {
  accessToken: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  businessAccountId: string;
  appId: string;
  isActive: boolean;
}

interface StoreFormData {
  name: string;
  description: string;
  domain: string;
  isActive: boolean;
}

interface GlobalWebhookSettings {
  webhookUrl: string;
  webhookVerifyToken: string;
  isActive: boolean;
  lastUpdate?: string;
}

interface GlobalWhatsAppSettings {
  webhook: GlobalWebhookSettings;
  defaultSettings: {
    businessHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
    };
    autoResponses: {
      enabled: boolean;
      welcomeMessage: string;
      businessHoursMessage: string;
      afterHoursMessage: string;
    };
    rateLimiting: {
      enabled: boolean;
      maxMessagesPerMinute: number;
      blockDuration: number;
    };
  };
}

export default function StoresPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [editedStore, setEditedStore] = useState<Store | null>(null);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [whatsappForm, setWhatsappForm] = useState<WhatsAppFormData>({
    accessToken: "",
    phoneNumberId: "",
    webhookVerifyToken: "",
    businessAccountId: "",
    appId: "",
    isActive: true
  });

  const [createForm, setCreateForm] = useState<StoreFormData>({
    name: "",
    description: "",
    domain: "",
    isActive: true
  });

  const [showGlobalSettingsDialog, setShowGlobalSettingsDialog] = useState(false);
const [globalSettings, setGlobalSettings] = useState<GlobalWhatsAppSettings>({
  webhook: {
    webhookUrl: "https://tu-servidor.com/api/whatsapp/webhook",
    webhookVerifyToken: "",
    isActive: true
  },
  defaultSettings: {
    businessHours: {
      enabled: true,
      startTime: "09:00",
      endTime: "18:00",
      timezone: "America/Santo_Domingo"
    },
    autoResponses: {
      enabled: true,
      welcomeMessage: "¡Hola! Bienvenido a nuestro servicio. ¿En qué podemos ayudarte?",
      businessHoursMessage: "Estamos fuera de horario. Te responderemos pronto.",
      afterHoursMessage: "Nuestro horario es de 9:00 AM a 6:00 PM."
    },
    rateLimiting: {
      enabled: true,
      maxMessagesPerMinute: 10,
      blockDuration: 60
    }
  }
});
  // ✅ QUERIES CON TIPOS EXPLÍCITOS
// 1) Tiendas
const {
  data: storesData = [],
  isLoading: storesLoading,
  isError: storesError,
  error: storesErrorObj,
} = useQuery<Store[], Error>({
  queryKey: ["/api/super-admin/stores"],
  queryFn: () => 
   apiRequest<Store[]>("GET", "/api/super-admin/stores"),
  staleTime: 30_000,
  initialData: [],
});
if (storesLoading) {
  return <div>Loading tiendas…</div>;
}
if (storesError) {
  return <div>Error: {storesErrorObj?.message || "No se pudieron cargar las tiendas"}</div>;
}

// 2) Configs de WhatsApp
const {
  data: configsData = [],
  isLoading: configsLoading,
  isError: configsError,
  error: configsErrorObj,
} = useQuery<WhatsAppConfig[], Error>({
  queryKey: ["/api/super-admin/whatsapp-configs"],
  queryFn: () => 
   apiRequest<WhatsAppConfig[]>("GET", "/api/super-admin/whatsapp-configs"),
  staleTime: 30_000,
  initialData: [],
});
if (configsLoading) {
  return <div>Loading configs…</div>;
}
if (configsError) {
  return <div>Error: {configsErrorObj?.message || "No se pudieron cargar las configuraciones"}</div>;
}


 const stores = storesData;

 const whatsappConfigs = configsData ?? [];



  const updateGlobalSettingsMutation = useMutation({
  mutationFn: (data: GlobalWhatsAppSettings) =>
    apiRequest("PUT", "/api/super-admin/global-whatsapp-settings", data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/super-admin/global-whatsapp-settings"] });
    setShowGlobalSettingsDialog(false);
    toast({
      title: "Configuración global actualizada",
      description: "Los ajustes globales de WhatsApp se han guardado exitosamente",
    });
  },
  onError: (error: any) => {
    toast({
      title: "Error",
      description: error.message || "Error al guardar la configuración global",
      variant: "destructive",
    });
  },
});

const testWebhookMutation = useMutation({
  mutationFn: (webhookUrl: string) =>
    apiRequest("POST", "/api/super-admin/test-webhook", { webhookUrl }),
  onSuccess: (data: any) => {
    toast({
      title: data.success ? "Webhook funcionando" : "Error en webhook",
      description: data.message,
      variant: data.success ? "default" : "destructive",
    });
  },
  onError: (error: any) => {
    toast({
      title: "Error al probar webhook",
      description: error.message || "No se pudo conectar con el webhook",
      variant: "destructive",
    });
  },
});

  // ✅ CREATE STORE MUTATION
  const createStoreMutation = useMutation({
    mutationFn: (data: StoreFormData) => apiRequest("POST", "/api/super-admin/stores", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stores"] });
      setShowCreateDialog(false);
      setCreateForm({ name: "", description: "", domain: "", isActive: true });
      toast({
        title: "Tienda creada",
        description: "La tienda se ha creado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear la tienda",
        variant: "destructive",
      });
    },
  });

  // ✅ UPDATE STORE MUTATION
  const updateStoreMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StoreFormData> }) =>
      apiRequest("PUT", `/api/super-admin/stores/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stores"] });
      setShowEditDialog(false);
      setEditedStore(null);
      toast({
        title: "Tienda actualizada",
        description: "La tienda se ha actualizado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la tienda",
        variant: "destructive",
      });
    },
  });

  // ✅ DELETE STORE MUTATION
  const deleteStoreMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/super-admin/stores/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stores"] });
      toast({
        title: "Tienda eliminada",
        description: "La tienda se ha eliminado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo eliminar la tienda",
        variant: "destructive",
      });
    },
  });

  // ✅ TOGGLE STORE STATUS MUTATION
  const toggleStoreMutation = useMutation({
    mutationFn: async ({ storeId, action }: { storeId: number; action: 'enable' | 'disable' }) => {
      const response = await apiRequest("PATCH", `/api/super-admin/stores/${storeId}/status`, { action });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stores"] });
      toast({
        title: "Estado actualizado",
        description: "El estado de la tienda se ha actualizado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo actualizar el estado",
        variant: "destructive",
      });
    },
  });

  // ✅ VALIDATE ECOSYSTEM MUTATION
  const validateMutation = useMutation({
    mutationFn: async (storeId: number) => {
      const response = await apiRequest("GET", `/api/super-admin/stores/${storeId}/validate`);
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Validación completada",
        description: data.message || "El ecosistema de la tienda se ha validado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error en validación",
        description: error?.message || "No se pudo validar el ecosistema de la tienda",
        variant: "destructive",
      });
    },
  });

  // ✅ ENHANCED VALIDATION MUTATION
  const validateEnhancedMutation = useMutation({
    mutationFn: async (storeId: number) => {
      const response = await apiRequest("GET", `/api/super-admin/stores/${storeId}/validate-enhanced`);
      return response;
    },
    onSuccess: (data: any) => {
      const details = data.details || {};
      const issuesCount = details.issues?.length || 0;
      const recommendationsCount = details.recommendations?.length || 0;
      
      toast({
        title: data.valid ? "✅ Ecosistema Saludable" : "⚠️ Problemas Detectados",
        description: data.valid 
          ? `${details.storeName}: Arquitectura multi-tenant correcta`
          : `${details.storeName}: ${issuesCount} problemas, ${recommendationsCount} recomendaciones`,
        variant: data.valid ? "default" : "destructive",
      });

      if (!data.valid && details.issues) {
        console.log("Problemas detectados:", details.issues);
        console.log("Recomendaciones:", details.recommendations);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error en análisis",
        description: "No se pudo realizar el análisis completo",
        variant: "destructive",
      });
    },
  });

  // ✅ ENHANCED REPAIR MUTATION
  const repairEnhancedMutation = useMutation({
    mutationFn: async (storeId: number) => {
      const response = await apiRequest("POST", `/api/super-admin/stores/${storeId}/repair-enhanced`);
      return response;
    },
    onSuccess: (data: any) => {
      const actionsCount = data.actions?.length || 0;
      const errorsCount = data.errors?.length || 0;
      
      toast({
        title: data.success ? "🔧 Reparación Exitosa" : "⚠️ Reparación Parcial",
        description: data.success 
          ? `${actionsCount} acciones completadas`
          : `${actionsCount} acciones completadas, ${errorsCount} errores`,
        variant: data.success ? "default" : "destructive",
      });

      if (data.actions) {
        console.log("Acciones realizadas:", data.actions);
      }
      if (data.errors) {
        console.log("Errores durante reparación:", data.errors);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stores"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error en reparación",
        description: "No se pudo reparar el ecosistema",
        variant: "destructive",
      });
    },
  });

  // ✅ VALIDATE ALL STORES MUTATION
  const validateAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", `/api/super-admin/stores/validate-all`);
      return response;
    },
    onSuccess: (data: any) => {
      const summary = data.summary || {};
      const validCount = summary.valid || 0;
      const totalCount = summary.total || 0;
      const invalidCount = summary.invalid || 0;
      
      toast({
        title: invalidCount === 0 ? "✅ Todos los Ecosistemas Saludables" : "⚠️ Problemas Detectados",
        description: `${validCount}/${totalCount} tiendas con ecosistemas válidos`,
        variant: invalidCount === 0 ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error en validación masiva",
        description: "No se pudo validar todos los ecosistemas",
        variant: "destructive",
      });
    },
  });

  // ✅ WHATSAPP MUTATIONS
  const whatsappMutation = useMutation({
    mutationFn: (data: WhatsAppFormData) => {
      if (!selectedStore) return Promise.reject(new Error("No hay tienda seleccionada"));
const existingConfig = whatsappConfigs.find((config) => config.storeId === selectedStore.id);

      
      if (existingConfig) {
        return apiRequest("PUT", `/api/super-admin/whatsapp-configs/${existingConfig.id}`, {
          ...data,
          storeId: selectedStore?.id
        });
      } else {
        return apiRequest("POST", "/api/super-admin/whatsapp-configs", {
          ...data,
          storeId: selectedStore?.id
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/whatsapp-configs"] });
      setShowWhatsAppDialog(false);
      setSelectedStore(null);
      resetWhatsAppForm();
      toast({
        title: "Configuración guardada",
        description: "La configuración de WhatsApp se guardó exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al guardar la configuración",
        variant: "destructive",
      });
    },
  });

  const deleteWhatsAppMutation = useMutation({
    mutationFn: (configId: number) => 
      apiRequest("DELETE", `/api/super-admin/whatsapp-configs/${configId}`),
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

  const testWhatsAppMutation = useMutation({
    mutationFn: (data: { storeId: number; phoneNumberId: string }) =>
      apiRequest("POST", "/api/super-admin/whatsapp-test", data),
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Conexión exitosa" : "Error de conexión",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error de prueba",
        description: error.message || "Error al probar la conexión",
        variant: "destructive",
      });
    },
  });

  // ✅ HELPER FUNCTIONS
  const resetWhatsAppForm = () => {
    setWhatsappForm({
      accessToken: "",
      phoneNumberId: "",
      webhookVerifyToken: "",
      businessAccountId: "",
      appId: "",
      isActive: true
    });
  };

  const openWhatsAppDialog = (store: Store) => {
    setSelectedStore(store);
    if (!selectedStore) return Promise.reject(new Error("No hay tienda seleccionada"));
const existingConfig = whatsappConfigs.find((config) => config.storeId === selectedStore.id);

    if (existingConfig) {
      setWhatsappForm({
        accessToken: existingConfig.accessToken,
        phoneNumberId: existingConfig.phoneNumberId,
        webhookVerifyToken: existingConfig.webhookVerifyToken,
        businessAccountId: existingConfig.businessAccountId || "",
        appId: existingConfig.appId || "",
        isActive: existingConfig.isActive
      });
    } else {
      resetWhatsAppForm();
    }
    setShowWhatsAppDialog(true);
  };

  const openEditDialog = (store: Store) => {
    setEditedStore(store);
    setShowEditDialog(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.domain) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa el nombre y dominio de la tienda",
        variant: "destructive",
      });
      return;
    }
    createStoreMutation.mutate(createForm);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedStore) return;
    updateStoreMutation.mutate({
      id: editedStore.id,
      data: {
        name: editedStore.name,
        description: editedStore.description,
        domain: editedStore.domain,
        isActive: editedStore.isActive
      }
    });
  };

  const handleWhatsAppSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) return;
    if (!whatsappForm.accessToken || !whatsappForm.phoneNumberId || !whatsappForm.webhookVerifyToken) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }
    whatsappMutation.mutate(whatsappForm);
  };

  const handleValidateEcosystem = (storeId: number) => {
    validateMutation.mutate(storeId);
  };

  const handleValidateEnhanced = (storeId: number) => {
    validateEnhancedMutation.mutate(storeId);
  };

  const handleRepairEnhanced = (storeId: number) => {
    repairEnhancedMutation.mutate(storeId);
  };

  const handleTestConnection = (store: Store) => {
    const config = whatsappConfigs.find((config) => config.storeId === store.id);
    if (config) {
      testWhatsAppMutation.mutate({
        storeId: store.id,
        phoneNumberId: config.phoneNumberId
      });
    } else {
      toast({
        title: "Sin configuración",
        description: "Esta tienda no tiene configuración de WhatsApp",
        variant: "destructive",
      });
    }
  };

  const handleDeleteWhatsAppConfig = (store: Store) => {
    const config = whatsappConfigs.find((config) => config.storeId === store.id);
    if (config) {
      if (confirm("¿Estás seguro de que quieres eliminar la configuración de WhatsApp para esta tienda?")) {
        deleteWhatsAppMutation.mutate(config.id);
      }
    }
  };

  const handleToggleStore = (storeId: number, action: 'enable' | 'disable') => {
    toggleStoreMutation.mutate({ storeId, action });
  };

  const toggleTokenVisibility = (field: string) => {
    setShowTokens(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const getWhatsAppStatus = (store: Store) => {
    const config = whatsappConfigs.find((config) => config.storeId === store.id);
    if (!config) return { status: "not_configured", label: "Sin configurar", color: "bg-gray-500" };
    if (!config.isActive) return { status: "inactive", label: "Inactivo", color: "bg-red-500" };
    return { status: "active", label: "Activo", color: "bg-green-500" };
  };

  // Filter stores
  const filteredStores = stores.filter((store) => {
    const matchesSearch = store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         store.domain.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && store.isActive) ||
                         (statusFilter === "inactive" && !store.isActive);
    return matchesSearch && matchesStatus;
  });

  const openGlobalSettingsDialog = () => {
  if (globalSettings) {
    setGlobalSettings(globalSettings);
  }
  setShowGlobalSettingsDialog(true);
};

const handleGlobalSettingsSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  updateGlobalSettingsMutation.mutate(globalSettings);
};

const handleTestWebhook = () => {
  if (globalSettings.webhook.webhookUrl) {
    testWebhookMutation.mutate(globalSettings.webhook.webhookUrl);
  } else {
    toast({
      title: "URL requerida",
      description: "Por favor ingresa la URL del webhook antes de probar",
      variant: "destructive",
    });
  }
};

  if (storesLoading || configsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Tiendas</h1>
          <p className="text-muted-foreground">
            Administra las tiendas registradas y su configuración de WhatsApp
          </p>
        </div>
       <div className="flex gap-2">
  <Button
    onClick={() => validateAllMutation.mutate()}
    disabled={validateAllMutation.isPending}
    variant="outline"
  >
    {validateAllMutation.isPending ? "Validando..." : "Validar Todas"}
  </Button>
  <Button
    onClick={openGlobalSettingsDialog}
    variant="outline"
    className="flex items-center gap-2"
  >
    <Settings className="h-4 w-4" />
    Config. Global
  </Button>
  <Button onClick={() => setShowCreateDialog(true)}>
    <Plus className="h-4 w-4 mr-2" />
    Nueva Tienda
  </Button>
</div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar tiendas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las tiendas</SelectItem>
            <SelectItem value="active">Solo activas</SelectItem>
            <SelectItem value="inactive">Solo inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStores.map((store) => {
          const whatsappStatus = getWhatsAppStatus(store);
          const whatsappConfig = whatsappConfigs.find((config) => config.storeId === store.id);
          
          return (
            <Card key={store.id} className="relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {store.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {store.domain}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge variant={store.isActive ? "default" : "secondary"}>
                      {store.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${whatsappStatus.color}`} />
                      <span className="text-xs text-muted-foreground">
                        WhatsApp: {whatsappStatus.label}
                      </span>
                    </div>
                  </div>
                </div>
                {store.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {store.description}
                  </p>
                )}
              </CardHeader>
              
              <CardContent>
                <div className="flex flex-col gap-2">
                  {/* Primary Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openWhatsAppDialog(store)}
                      className="flex items-center gap-1 flex-1"
                    >
                      <MessageCircle className="h-3 w-3" />
                      {whatsappConfig ? "WhatsApp" : "Agregar WA"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(store)}
                      className="flex items-center gap-1"
                    >
                      <Edit3 className="h-3 w-3" />
                      Editar
                    </Button>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation(`/super-admin/store-settings?store=${store.id}`)}
                      className="flex items-center gap-1"
                    >
                      <Settings className="h-3 w-3" />
                      Ajustes
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation(`/super-admin/store-products?store=${store.id}`)}
                      className="flex items-center gap-1"
                    >
                      <Package className="h-3 w-3" />
                      Productos
                    </Button>
                  </div>

                  {/* Ecosystem Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleValidateEcosystem(store.id)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                      disabled={validateMutation.isPending}
                    >
                      <Database className="h-3 w-3" />
                      {validateMutation.isPending ? "Validando..." : "Validar BD"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleValidateEnhanced(store.id)}
                      className="flex items-center gap-1 text-green-600 hover:text-green-700"
                      disabled={validateEnhancedMutation.isPending}
                    >
                      <Database className="h-3 w-3" />
                      {validateEnhancedMutation.isPending ? "Analizando..." : "🔍 Análisis"}
                    </Button>
                  </div>

                  {/* Repair and Status Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleRepairEnhanced(store.id)}
                      className="flex items-center gap-1 text-orange-600 hover:text-orange-700"
                      disabled={repairEnhancedMutation.isPending}
                    >
                      <Database className="h-3 w-3" />
                      {repairEnhancedMutation.isPending ? "Reparando..." : "🔧 Reparar"}
                    </Button>
                    {store.isActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStore(store.id, 'disable')}
                        className="flex items-center gap-1"
                      >
                        <PowerOff className="h-3 w-3" />
                        Desactivar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStore(store.id, 'enable')}
                        className="flex items-center gap-1"
                      >
                        <Power className="h-3 w-3" />
                        Activar
                      </Button>
                    )}
                  </div>

                  {/* WhatsApp Actions (only if configured) */}
                  {whatsappConfig && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(store)}
                        disabled={testWhatsAppMutation.isPending}
                        className="flex-1"
                      >
                        {testWhatsAppMutation.isPending ? "Probando..." : "Probar WA"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteWhatsAppConfig(store)}
                        disabled={deleteWhatsAppMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* Delete Store */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("¿Estás seguro de que quieres eliminar esta tienda? Esta acción no se puede deshacer.")) {
                        deleteStoreMutation.mutate(store.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-700"
                    disabled={deleteStoreMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {deleteStoreMutation.isPending ? "Eliminando..." : "Eliminar Tienda"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CREATE STORE DIALOG */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nueva Tienda</DialogTitle>
            <DialogDescription>
              Agrega una nueva tienda al sistema
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="createName">Nombre de la Tienda *</Label>
              <Input
                id="createName"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Mi Tienda"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="createDomain">Dominio *</Label>
              <Input
                id="createDomain"
                value={createForm.domain}
                onChange={(e) => setCreateForm(prev => ({ ...prev, domain: e.target.value }))}
                placeholder="mitienda.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="createDescription">Descripción</Label>
              <Textarea
                id="createDescription"
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción de la tienda..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="createActive"
                checked={createForm.isActive}
                onCheckedChange={(checked) => setCreateForm(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="createActive">Tienda activa</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={createStoreMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createStoreMutation.isPending}
              >
                {createStoreMutation.isPending ? "Creando..." : "Crear Tienda"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT STORE DIALOG */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tienda</DialogTitle>
            <DialogDescription>
              Modifica la información de la tienda
            </DialogDescription>
          </DialogHeader>

          {editedStore && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Nombre de la Tienda *</Label>
                <Input
                  id="editName"
                  value={editedStore.name}
                  onChange={(e) => setEditedStore(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  placeholder="Mi Tienda"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editDomain">Dominio *</Label>
                <Input
                  id="editDomain"
                  value={editedStore.domain}
                  onChange={(e) => setEditedStore(prev => prev ? ({ ...prev, domain: e.target.value }) : null)}
                  placeholder="mitienda.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editDescription">Descripción</Label>
                <Textarea
                  id="editDescription"
                  value={editedStore.description}
                  onChange={(e) => setEditedStore(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                  placeholder="Descripción de la tienda..."
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="editActive"
                  checked={editedStore.isActive}
                  onCheckedChange={(checked) => setEditedStore(prev => prev ? ({ ...prev, isActive: checked }) : null)}
                />
                <Label htmlFor="editActive">Tienda activa</Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  disabled={updateStoreMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateStoreMutation.isPending}
                >
                  {updateStoreMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* WHATSAPP CONFIGURATION DIALOG */}
      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Configuración de WhatsApp - {selectedStore?.name}
            </DialogTitle>
            <DialogDescription>
              Configura la integración de WhatsApp Business API para esta tienda
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleWhatsAppSubmit} className="space-y-4">
            {/* Access Token */}
            <div className="space-y-2">
              <Label htmlFor="accessToken">Token de Acceso *</Label>
              <div className="relative">
                <Input
                  id="accessToken"
                  type={showTokens.accessToken ? "text" : "password"}
                  value={whatsappForm.accessToken}
                  onChange={(e) => setWhatsappForm(prev => ({ ...prev, accessToken: e.target.value }))}
                  placeholder="EAAxxxxxxx..."
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  onClick={() => toggleTokenVisibility('accessToken')}
                >
                  {showTokens.accessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Phone Number ID */}
            <div className="space-y-2">
              <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
              <Input
                id="phoneNumberId"
                value={whatsappForm.phoneNumberId}
                onChange={(e) => setWhatsappForm(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                placeholder="1234567890123456"
                required
              />
            </div>

            {/* Webhook Verify Token */}
            <div className="space-y-2">
              <Label htmlFor="webhookVerifyToken">Webhook Verify Token *</Label>
              <div className="relative">
                <Input
                  id="webhookVerifyToken"
                  type={showTokens.webhookVerifyToken ? "text" : "password"}
                  value={whatsappForm.webhookVerifyToken}
                  onChange={(e) => setWhatsappForm(prev => ({ ...prev, webhookVerifyToken: e.target.value }))}
                  placeholder="mi_token_secreto_123"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  onClick={() => toggleTokenVisibility('webhookVerifyToken')}
                >
                  {showTokens.webhookVerifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Business Account ID */}
            <div className="space-y-2">
              <Label htmlFor="businessAccountId">Business Account ID (Opcional)</Label>
              <Input
                id="businessAccountId"
                value={whatsappForm.businessAccountId}
                onChange={(e) => setWhatsappForm(prev => ({ ...prev, businessAccountId: e.target.value }))}
                placeholder="1234567890123456"
              />
            </div>

            {/* App ID */}
            <div className="space-y-2">
              <Label htmlFor="appId">App ID (Opcional)</Label>
              <Input
                id="appId"
                value={whatsappForm.appId}
                onChange={(e) => setWhatsappForm(prev => ({ ...prev, appId: e.target.value }))}
                placeholder="1234567890123456"
              />
            </div>

            {/* Active Switch */}
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={whatsappForm.isActive}
                onCheckedChange={(checked) => setWhatsappForm(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">Configuración activa</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowWhatsAppDialog(false)}
                disabled={whatsappMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={whatsappMutation.isPending}
              >
                {whatsappMutation.isPending ? "Guardando..." : "Guardar Configuración"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showGlobalSettingsDialog} onOpenChange={setShowGlobalSettingsDialog}>
  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        Configuración Global de WhatsApp
      </DialogTitle>
      <DialogDescription>
        Configura los ajustes globales que se aplicarán a todas las tiendas del sistema
      </DialogDescription>
    </DialogHeader>

    <form onSubmit={handleGlobalSettingsSubmit} className="space-y-6">
      {/* Webhook Configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Configuración del Webhook</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">URL del Webhook *</Label>
            <Input
              id="webhookUrl"
              value={globalSettings.webhook.webhookUrl}
              onChange={(e) => setGlobalSettings(prev => ({
                ...prev,
                webhook: { ...prev.webhook, webhookUrl: e.target.value }
              }))}
              placeholder="https://tu-servidor.com/api/whatsapp/webhook"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="globalWebhookToken">Token de Verificación *</Label>
            <div className="relative">
              <Input
                id="globalWebhookToken"
                type={showTokens.globalWebhookToken ? "text" : "password"}
                value={globalSettings.webhook.webhookVerifyToken}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  webhook: { ...prev.webhook, webhookVerifyToken: e.target.value }
                }))}
                placeholder="token_global_secreto_123"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                onClick={() => toggleTokenVisibility('globalWebhookToken')}
              >
                {showTokens.globalWebhookToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="webhookActive"
              checked={globalSettings.webhook.isActive}
              onCheckedChange={(checked) => setGlobalSettings(prev => ({
                ...prev,
                webhook: { ...prev.webhook, isActive: checked }
              }))}
            />
            <Label htmlFor="webhookActive">Webhook activo</Label>
          </div>
          
          <Button
            type="button"
            variant="outline"
            onClick={handleTestWebhook}
            disabled={testWebhookMutation.isPending}
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            {testWebhookMutation.isPending ? "Probando..." : "Probar Webhook"}
          </Button>
        </div>
      </div>

      {/* Business Hours */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Horario de Atención</h3>
        
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            id="businessHoursEnabled"
            checked={globalSettings.defaultSettings.businessHours.enabled}
            onCheckedChange={(checked) => setGlobalSettings(prev => ({
              ...prev,
              defaultSettings: {
                ...prev.defaultSettings,
                businessHours: { ...prev.defaultSettings.businessHours, enabled: checked }
              }
            }))}
          />
          <Label htmlFor="businessHoursEnabled">Habilitar horario de atención</Label>
        </div>

        {globalSettings.defaultSettings.businessHours.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Hora de Inicio</Label>
              <Input
                id="startTime"
                type="time"
                value={globalSettings.defaultSettings.businessHours.startTime}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  defaultSettings: {
                    ...prev.defaultSettings,
                    businessHours: { ...prev.defaultSettings.businessHours, startTime: e.target.value }
                  }
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">Hora de Fin</Label>
              <Input
                id="endTime"
                type="time"
                value={globalSettings.defaultSettings.businessHours.endTime}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  defaultSettings: {
                    ...prev.defaultSettings,
                    businessHours: { ...prev.defaultSettings.businessHours, endTime: e.target.value }
                  }
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Zona Horaria</Label>
              <Select
                value={globalSettings.defaultSettings.businessHours.timezone}
                onValueChange={(value) => setGlobalSettings(prev => ({
                  ...prev,
                  defaultSettings: {
                    ...prev.defaultSettings,
                    businessHours: { ...prev.defaultSettings.businessHours, timezone: value }
                  }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Santo_Domingo">República Dominicana (GMT-4)</SelectItem>
                  <SelectItem value="America/New_York">Nueva York (GMT-5)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Los Ángeles (GMT-8)</SelectItem>
                  <SelectItem value="Europe/Madrid">Madrid (GMT+1)</SelectItem>
                  <SelectItem value="UTC">UTC (GMT+0)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Auto Responses */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Respuestas Automáticas Predeterminadas</h3>
        
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            id="autoResponsesEnabled"
            checked={globalSettings.defaultSettings.autoResponses.enabled}
            onCheckedChange={(checked) => setGlobalSettings(prev => ({
              ...prev,
              defaultSettings: {
                ...prev.defaultSettings,
                autoResponses: { ...prev.defaultSettings.autoResponses, enabled: checked }
              }
            }))}
          />
          <Label htmlFor="autoResponsesEnabled">Habilitar respuestas automáticas</Label>
        </div>

        {globalSettings.defaultSettings.autoResponses.enabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Mensaje de Bienvenida</Label>
              <Textarea
                id="welcomeMessage"
                value={globalSettings.defaultSettings.autoResponses.welcomeMessage}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  defaultSettings: {
                    ...prev.defaultSettings,
                    autoResponses: { ...prev.defaultSettings.autoResponses, welcomeMessage: e.target.value }
                  }
                }))}
                placeholder="¡Hola! Bienvenido a nuestro servicio..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessHoursMessage">Mensaje en Horario de Atención</Label>
              <Textarea
                id="businessHoursMessage"
                value={globalSettings.defaultSettings.autoResponses.businessHoursMessage}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  defaultSettings: {
                    ...prev.defaultSettings,
                    autoResponses: { ...prev.defaultSettings.autoResponses, businessHoursMessage: e.target.value }
                  }
                }))}
                placeholder="Gracias por contactarnos. Te responderemos pronto..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="afterHoursMessage">Mensaje Fuera de Horario</Label>
              <Textarea
                id="afterHoursMessage"
                value={globalSettings.defaultSettings.autoResponses.afterHoursMessage}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  defaultSettings: {
                    ...prev.defaultSettings,
                    autoResponses: { ...prev.defaultSettings.autoResponses, afterHoursMessage: e.target.value }
                  }
                }))}
                placeholder="Estamos fuera de horario. Nuestro horario es..."
                rows={2}
              />
            </div>
          </div>
        )}
      </div>

      {/* Rate Limiting */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Límites de Velocidad</h3>
        
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            id="rateLimitingEnabled"
            checked={globalSettings.defaultSettings.rateLimiting.enabled}
            onCheckedChange={(checked) => setGlobalSettings(prev => ({
              ...prev,
              defaultSettings: {
                ...prev.defaultSettings,
                rateLimiting: { ...prev.defaultSettings.rateLimiting, enabled: checked }
              }
            }))}
          />
          <Label htmlFor="rateLimitingEnabled">Habilitar límites de velocidad</Label>
        </div>

        {globalSettings.defaultSettings.rateLimiting.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxMessages">Máximo de Mensajes por Minuto</Label>
              <Input
                id="maxMessages"
                type="number"
                min="1"
                max="100"
                value={globalSettings.defaultSettings.rateLimiting.maxMessagesPerMinute}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  defaultSettings: {
                    ...prev.defaultSettings,
                    rateLimiting: { ...prev.defaultSettings.rateLimiting, maxMessagesPerMinute: parseInt(e.target.value) || 10 }
                  }
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="blockDuration">Duración del Bloqueo (segundos)</Label>
              <Input
                id="blockDuration"
                type="number"
                min="30"
                max="3600"
                value={globalSettings.defaultSettings.rateLimiting.blockDuration}
                onChange={(e) => setGlobalSettings(prev => ({
                  ...prev,
                  defaultSettings: {
                    ...prev.defaultSettings,
                    rateLimiting: { ...prev.defaultSettings.rateLimiting, blockDuration: parseInt(e.target.value) || 60 }
                  }
                }))}
              />
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowGlobalSettingsDialog(false)}
          disabled={updateGlobalSettingsMutation.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={updateGlobalSettingsMutation.isPending}
        >
          {updateGlobalSettingsMutation.isPending ? "Guardando..." : "Guardar Configuración Global"}
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>

      {/* Empty State */}
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