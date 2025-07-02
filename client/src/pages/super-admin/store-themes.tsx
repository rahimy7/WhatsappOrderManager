import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Palette, Eye } from "lucide-react";

export default function StoreThemes() {
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
        title: "Tema actualizado",
        description: "Los cambios se han guardado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo actualizar el tema",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
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
          <h1 className="text-3xl font-bold text-gray-900">Temas y Personalización</h1>
          <p className="text-gray-600 mt-2">
            {store?.name || "Tienda"} • Personaliza la apariencia de la tienda
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
            <Palette className="h-5 w-5" />
            Personalización Básica
          </CardTitle>
          <CardDescription>
            Configura la información visual básica de la tienda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              <Label htmlFor="description">Descripción</Label>
              <Input 
                id="description" 
                name="description" 
                defaultValue={store?.description || ""}
                placeholder="Descripción breve de la tienda"
              />
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

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Vista Previa
          </CardTitle>
          <CardDescription>
            Así se ve actualmente la información de tu tienda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-6 bg-gray-50">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {store?.name || "Nombre de la Tienda"}
            </h3>
            <p className="text-gray-600 mb-4">
              {store?.description || "Descripción de la tienda"}
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Dominio:</span> {store?.domain || "No configurado"}
              </div>
              <div>
                <span className="font-medium">Plan:</span> {store?.plan || "Básico"}
              </div>
              <div>
                <span className="font-medium">Estado:</span>{" "}
                <span className={store?.isActive ? "text-green-600" : "text-red-600"}>
                  {store?.isActive ? "Activa" : "Inactiva"}
                </span>
              </div>
              <div>
                <span className="font-medium">Fecha de creación:</span>{" "}
                {store?.createdAt ? new Date(store.createdAt).toLocaleDateString() : "No disponible"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}