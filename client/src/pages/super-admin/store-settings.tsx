import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Database, Shield, Bell, Smartphone, MapPin, Clock, DollarSign, Settings2 } from "lucide-react";

interface StoreSettings {
  id: number;
  storeId: number;
  // General Settings
  storeName?: string;
  storeAddress?: string;
  storeEmail?: string;
  storePhone?: string;
  businessHours?: string;
  deliveryRadius?: number;
  // WhatsApp Settings
  storeWhatsAppNumber?: string;
  whatsappBusinessName?: string;
  enableWhatsappNotifications?: boolean;
  // Notification Settings
  enableEmailNotifications?: boolean;
  enableSmsNotifications?: boolean;
  notificationEmail?: string;
  // Payment Settings
  acceptCash?: boolean;
  acceptCard?: boolean;
  acceptTransfer?: boolean;
  defaultCurrency?: string;
  taxRate?: number;
  // Delivery Settings
  freeDeliveryThreshold?: number;
  deliveryFee?: number;
  estimatedDeliveryTime?: string;
}

export default function StoreSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState<number | null>(null);

  // Get store ID from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');
    if (storeParam) {
      setStoreId(parseInt(storeParam));
    }
  }, []);

  // Fetch store settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/super-admin/store-settings", storeId],
    queryFn: () => apiRequest("GET", `/api/super-admin/store-settings/${storeId}`),
    enabled: !!storeId,
  });

  // Fetch store info
  const { data: store } = useQuery({
    queryKey: ["/api/super-admin/stores", storeId],
    queryFn: () => apiRequest("GET", `/api/super-admin/stores/${storeId}`),
    enabled: !!storeId,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest("PUT", `/api/super-admin/store-settings/${storeId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/store-settings", storeId] });
      toast({
        title: "Configuración actualizada",
        description: "Los cambios se han guardado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo actualizar la configuración",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = (formData: FormData, section: string) => {
    const data: any = {};
    
    // Convert FormData to object based on section
    for (const [key, value] of formData.entries()) {
      if (key.includes('enable') || key.includes('accept')) {
        data[key] = value === 'on';
      } else if (key.includes('radius') || key.includes('fee') || key.includes('threshold') || key.includes('rate')) {
        data[key] = value ? parseFloat(value as string) : null;
      } else {
        data[key] = value || null;
      }
    }

    updateSettingsMutation.mutate(data);
  };

  if (!storeId) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600">No se especificó una tienda válida</p>
          <Button onClick={() => window.history.back()} className="mt-4">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuración de Tienda</h1>
          <p className="text-gray-600 mt-2">
            {store?.storeName || "Tienda"} • Gestiona la configuración específica de esta tienda
          </p>
        </div>
        <Button onClick={() => window.history.back()} variant="outline">
          Volver
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="delivery">Entrega</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configuración General
              </CardTitle>
              <CardDescription>
                Información básica y configuración general de la tienda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveSettings(new FormData(e.currentTarget), 'general');
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="storeName">Nombre de la Tienda</Label>
                    <Input 
                      id="storeName" 
                      name="storeName" 
                      defaultValue={settings?.storeName || store?.storeName || ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="storeEmail">Email de Contacto</Label>
                    <Input 
                      id="storeEmail" 
                      name="storeEmail" 
                      type="email"
                      defaultValue={settings?.storeEmail || ""}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="storePhone">Teléfono</Label>
                    <Input 
                      id="storePhone" 
                      name="storePhone"
                      defaultValue={settings?.storePhone || ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="deliveryRadius">Radio de Entrega (km)</Label>
                    <Input 
                      id="deliveryRadius" 
                      name="deliveryRadius"
                      type="number"
                      step="0.1"
                      defaultValue={settings?.deliveryRadius || ""}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="storeAddress">Dirección</Label>
                  <Textarea 
                    id="storeAddress" 
                    name="storeAddress"
                    defaultValue={settings?.storeAddress || ""}
                  />
                </div>
                <div>
                  <Label htmlFor="businessHours">Horarios de Atención</Label>
                  <Textarea 
                    id="businessHours" 
                    name="businessHours"
                    placeholder="Lunes a Viernes: 9:00 AM - 6:00 PM"
                    defaultValue={settings?.businessHours || ""}
                  />
                </div>
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateSettingsMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Settings */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Configuración de WhatsApp
              </CardTitle>
              <CardDescription>
                Configuración de WhatsApp Business para pedidos y comunicación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveSettings(new FormData(e.currentTarget), 'whatsapp');
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="storeWhatsAppNumber">Número de WhatsApp</Label>
                    <Input 
                      id="storeWhatsAppNumber" 
                      name="storeWhatsAppNumber"
                      placeholder="5215512345678"
                      defaultValue={settings?.storeWhatsAppNumber || ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="whatsappBusinessName">Nombre del Negocio en WhatsApp</Label>
                    <Input 
                      id="whatsappBusinessName" 
                      name="whatsappBusinessName"
                      defaultValue={settings?.whatsappBusinessName || ""}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="enableWhatsappNotifications" 
                    name="enableWhatsappNotifications"
                    defaultChecked={settings?.enableWhatsappNotifications || false}
                  />
                  <Label htmlFor="enableWhatsappNotifications">
                    Habilitar notificaciones por WhatsApp
                  </Label>
                </div>
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateSettingsMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Configuración de Notificaciones
              </CardTitle>
              <CardDescription>
                Gestiona cómo y cuándo recibir notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveSettings(new FormData(e.currentTarget), 'notifications');
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="notificationEmail">Email para Notificaciones</Label>
                  <Input 
                    id="notificationEmail" 
                    name="notificationEmail"
                    type="email"
                    defaultValue={settings?.notificationEmail || ""}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="enableEmailNotifications" 
                      name="enableEmailNotifications"
                      defaultChecked={settings?.enableEmailNotifications || false}
                    />
                    <Label htmlFor="enableEmailNotifications">
                      Habilitar notificaciones por email
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="enableSmsNotifications" 
                      name="enableSmsNotifications"
                      defaultChecked={settings?.enableSmsNotifications || false}
                    />
                    <Label htmlFor="enableSmsNotifications">
                      Habilitar notificaciones por SMS
                    </Label>
                  </div>
                </div>
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateSettingsMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Configuración de Pagos
              </CardTitle>
              <CardDescription>
                Métodos de pago aceptados y configuración fiscal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveSettings(new FormData(e.currentTarget), 'payments');
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="defaultCurrency">Moneda</Label>
                    <Select name="defaultCurrency" defaultValue={settings?.defaultCurrency || "MXN"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MXN">Peso Mexicano (MXN)</SelectItem>
                        <SelectItem value="USD">Dólar (USD)</SelectItem>
                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="taxRate">Tasa de Impuesto (%)</Label>
                    <Input 
                      id="taxRate" 
                      name="taxRate"
                      type="number"
                      step="0.01"
                      defaultValue={settings?.taxRate || ""}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Métodos de Pago Aceptados</Label>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="acceptCash" 
                      name="acceptCash"
                      defaultChecked={settings?.acceptCash || false}
                    />
                    <Label htmlFor="acceptCash">Efectivo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="acceptCard" 
                      name="acceptCard"
                      defaultChecked={settings?.acceptCard || false}
                    />
                    <Label htmlFor="acceptCard">Tarjeta de crédito/débito</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="acceptTransfer" 
                      name="acceptTransfer"
                      defaultChecked={settings?.acceptTransfer || false}
                    />
                    <Label htmlFor="acceptTransfer">Transferencia bancaria</Label>
                  </div>
                </div>
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateSettingsMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delivery Settings */}
        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Configuración de Entrega
              </CardTitle>
              <CardDescription>
                Costos y tiempos de entrega
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveSettings(new FormData(e.currentTarget), 'delivery');
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="deliveryFee">Costo de Entrega</Label>
                    <Input 
                      id="deliveryFee" 
                      name="deliveryFee"
                      type="number"
                      step="0.01"
                      defaultValue={settings?.deliveryFee || ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="freeDeliveryThreshold">Entrega Gratis desde</Label>
                    <Input 
                      id="freeDeliveryThreshold" 
                      name="freeDeliveryThreshold"
                      type="number"
                      step="0.01"
                      defaultValue={settings?.freeDeliveryThreshold || ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="estimatedDeliveryTime">Tiempo Estimado</Label>
                    <Input 
                      id="estimatedDeliveryTime" 
                      name="estimatedDeliveryTime"
                      placeholder="24-48 horas"
                      defaultValue={settings?.estimatedDeliveryTime || ""}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={updateSettingsMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateSettingsMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}