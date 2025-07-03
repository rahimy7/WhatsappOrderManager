import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Store, Settings, CreditCard, Package, MessageSquare, Users } from "lucide-react";
import type { SubscriptionPlan } from "@shared/schema";

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

  // Fetch store info
  const { data: store, isLoading } = useQuery({
    queryKey: [`/api/super-admin/stores`],
    enabled: !!storeId,
    select: (data: any[]) => data?.find((s: any) => s.id === storeId)
  });

  // Fetch subscription plans
  const { data: subscriptionPlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['/api/super-admin/subscription-plans'],
  });

  // Update store mutation
  const updateStoreMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest("PUT", `/api/super-admin/stores/${storeId}`, data).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/stores`] });
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

  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  // Initialize selected plan when store data loads
  useEffect(() => {
    if (store?.subscriptionPlanId) {
      setSelectedPlanId(store.subscriptionPlanId.toString());
    }
  }, [store]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      domain: formData.get('domain') as string,
      description: formData.get('description') as string,
      subscriptionPlanId: selectedPlanId ? parseInt(selectedPlanId) : null,
    };
    updateStoreMutation.mutate(data);
  };

  const formatPrice = (price: string | null) => {
    if (!price) return 'N/A';
    return `$${parseFloat(price).toLocaleString('es-MX')}`;
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
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Cargando...</h1>
          <p className="text-gray-600">Obteniendo información de la tienda</p>
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
            {store?.name || "Tienda"} • Gestiona la configuración específica de esta tienda
          </p>
        </div>
        <Button onClick={() => window.history.back()} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Información General
          </CardTitle>
          <CardDescription>
            Configura la información básica de la tienda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre de la Tienda</Label>
                <Input 
                  id="name" 
                  name="name" 
                  defaultValue={store?.name || ""}
                  required
                />
              </div>
              <div>
                <Label htmlFor="domain">Dominio</Label>
                <Input 
                  id="domain" 
                  name="domain" 
                  defaultValue={store?.domain || ""}
                  placeholder="mi-tienda.com"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea 
                id="description" 
                name="description" 
                defaultValue={store?.description || ""}
                placeholder="Descripción de la tienda"
                rows={3}
              />
            </div>

            {/* Plan de Suscripción */}
            <div className="space-y-4">
              <Label>Plan de Suscripción</Label>
              <div className="grid gap-4">
                {subscriptionPlans.map((plan: SubscriptionPlan) => {
                  const isSelected = selectedPlanId === plan.id.toString();
                  return (
                    <Card 
                      key={plan.id} 
                      className={`cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : 'hover:border-gray-300 hover:shadow-sm'
                      }`}
                      onClick={() => setSelectedPlanId(plan.id.toString())}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div 
                                className={`w-4 h-4 rounded-full border-2 ${
                                  isSelected 
                                    ? 'border-blue-500 bg-blue-500' 
                                    : 'border-gray-300'
                                }`}
                              >
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full m-0.5" />}
                              </div>
                              <h3 className="font-semibold text-lg">{plan.name}</h3>
                              <Badge className={
                                plan.type === 'fixed' ? 'bg-blue-100 text-blue-800' :
                                plan.type === 'usage_based' ? 'bg-green-100 text-green-800' :
                                'bg-purple-100 text-purple-800'
                              }>
                                {plan.type === 'fixed' ? 'Fijo' : 
                                 plan.type === 'usage_based' ? 'Por Uso' : 'Híbrido'}
                              </Badge>
                            </div>
                            
                            <p className="text-gray-600 mb-3">{plan.description}</p>
                            
                            <div className="text-2xl font-bold text-blue-600 mb-3">
                              {formatPrice(plan.monthlyPrice?.toString())}
                              <span className="text-sm font-normal text-gray-500">/mes</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-gray-500" />
                                <span>Productos: {plan.maxProducts === -1 ? 'Ilimitados' : plan.maxProducts}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-gray-500" />
                                <span>WhatsApp: {plan.maxWhatsappMessages === -1 ? 'Ilimitados' : plan.maxWhatsappMessages}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-500" />
                                <span>Usuarios: {plan.maxUsers === -1 ? 'Ilimitados' : plan.maxUsers}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-gray-500" />
                                <span>BD: {plan.maxDbStorage === null ? 'N/A' : `${plan.maxDbStorage}GB`}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id="isActive" 
                defaultChecked={store?.isActive || false}
                name="isActive"
              />
              <Label htmlFor="isActive">Tienda Activa</Label>
            </div>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={updateStoreMutation.isPending}
              >
                {updateStoreMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Store Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Información de la Tienda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">ID:</span> {store?.id}
            </div>
            <div>
              <span className="font-medium">Estado:</span>{" "}
              <span className={store?.isActive ? "text-green-600" : "text-red-600"}>
                {store?.isActive ? "Activa" : "Inactiva"}
              </span>
            </div>
            <div>
              <span className="font-medium">Plan:</span> {store?.plan}
            </div>
            <div>
              <span className="font-medium">Fecha de creación:</span>{" "}
              {store?.createdAt ? new Date(store.createdAt).toLocaleDateString() : "No disponible"}
            </div>
            <div>
              <span className="font-medium">Propietario:</span> {store?.ownerName || "No asignado"}
            </div>
            <div>
              <span className="font-medium">Email del propietario:</span> {store?.ownerEmail || "No disponible"}
            </div>
            <div className="md:col-span-2">
              <span className="font-medium">Schema de BD:</span>{" "}
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono">
                {store?.databaseUrl ? 
                  store.databaseUrl.match(/schema=([^&]+)/)?.[1] || "schema no encontrado" 
                  : "No disponible"
                }
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}