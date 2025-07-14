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

  // ✅ CORREGIDO: Update store mutation SIN .then(res => res.json())
  const updateStoreMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest("PUT", `/api/super-admin/stores/${storeId}`, data),
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
          <h1 className="text-2xl font-bold text-gray-600 mb-4">
            ID de tienda requerido
          </h1>
          <p className="text-gray-500">
            Por favor, especifica un ID de tienda válido en la URL
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-600 mb-4">
            Tienda no encontrada
          </h1>
          <p className="text-gray-500">
            No se pudo encontrar la tienda con ID {storeId}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Temas de Tienda</h1>
          <p className="text-gray-600">
            Personaliza el diseño de {store.name}
          </p>
        </div>
      </div>

      {/* Theme Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Configuración de Tema
          </CardTitle>
          <CardDescription>
            Personaliza la apariencia de tu tienda virtual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Theme Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Tema</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={store.name}
                  placeholder="Nombre del tema"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  name="description"
                  defaultValue={store.description}
                  placeholder="Descripción del tema"
                />
              </div>
            </div>

            {/* Color Palette */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Paleta de Colores</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Color Primario</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="primaryColor"
                      name="primaryColor"
                      type="color"
                      defaultValue="#3B82F6"
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      type="text"
                      defaultValue="#3B82F6"
                      placeholder="#3B82F6"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Color Secundario</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="secondaryColor"
                      name="secondaryColor"
                      type="color"
                      defaultValue="#6B7280"
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      type="text"
                      defaultValue="#6B7280"
                      placeholder="#6B7280"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accentColor">Color de Acento</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="accentColor"
                      name="accentColor"
                      type="color"
                      defaultValue="#10B981"
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      type="text"
                      defaultValue="#10B981"
                      placeholder="#10B981"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backgroundColor">Color de Fondo</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="backgroundColor"
                      name="backgroundColor"
                      type="color"
                      defaultValue="#F9FAFB"
                      className="w-16 h-10 p-1 border rounded"
                    />
                    <Input
                      type="text"
                      defaultValue="#F9FAFB"
                      placeholder="#F9FAFB"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Tipografía</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fontFamily">Familia de Fuente</Label>
                  <select 
                    id="fontFamily" 
                    name="fontFamily"
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                    <option value="Poppins">Poppins</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fontSize">Tamaño Base de Fuente</Label>
                  <select 
                    id="fontSize" 
                    name="fontSize"
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="14px">14px (Pequeño)</option>
                    <option value="16px" selected>16px (Medio)</option>
                    <option value="18px">18px (Grande)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Layout Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Configuración de Layout</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="headerStyle">Estilo de Header</Label>
                  <select 
                    id="headerStyle" 
                    name="headerStyle"
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="classic">Clásico</option>
                    <option value="modern">Moderno</option>
                    <option value="minimal">Minimalista</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="layoutStyle">Estilo de Layout</Label>
                  <select 
                    id="layoutStyle" 
                    name="layoutStyle"
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="boxed">Contenido Centrado</option>
                    <option value="full-width">Ancho Completo</option>
                    <option value="fluid">Fluido</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="borderRadius">Bordes Redondeados</Label>
                  <select 
                    id="borderRadius" 
                    name="borderRadius"
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="0px">Sin Redondeo</option>
                    <option value="4px">Ligero</option>
                    <option value="8px" selected>Medio</option>
                    <option value="12px">Pronunciado</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button 
                type="button" 
                variant="outline"
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Vista Previa
              </Button>
              
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    // Reset form to default values
                    const form = document.querySelector('form') as HTMLFormElement;
                    form?.reset();
                  }}
                >
                  Restablecer
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateStoreMutation.isPending}
                >
                  {updateStoreMutation.isPending ? "Guardando..." : "Guardar Tema"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Theme Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Vista Previa del Tema
          </CardTitle>
          <CardDescription>
            Previsualiza cómo se verá tu tienda con los cambios aplicados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="mb-4">
              <div className="w-full h-40 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg mb-4"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Vista Previa del Tema
            </h3>
            <p className="text-gray-500">
              La vista previa se mostrará aquí una vez que apliques los cambios
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}