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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Store, Settings } from "lucide-react";

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      domain: formData.get('domain') as string,
      description: formData.get('description') as string,
      plan: formData.get('plan') as string,
    };
    updateStoreMutation.mutate(data);
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

            <div>
              <Label htmlFor="plan">Plan</Label>
              <Select name="plan" defaultValue={store?.plan || "basic"}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Básico</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="enterprise">Empresarial</SelectItem>
                </SelectContent>
              </Select>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}