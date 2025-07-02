import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Settings, Users, Package, BarChart3, Trash2, Edit3, Store, Database, CheckCircle, XCircle } from "lucide-react";

interface VirtualStore {
  id: number;
  storeName: string;
  domain: string;
  isActive: boolean;
  plan: string;
  createdAt: string;
  ownerId: number;
  storeAddress?: string;
  storeEmail?: string;
  storePhone?: string;
  description?: string;
  ownerName?: string;
  ownerEmail?: string;
}

export default function StoreManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [selectedStore, setSelectedStore] = useState<VirtualStore | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Fetch stores
  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["/api/super-admin/stores"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/super-admin/stores");
      return await response.json();
    },
  });

  // Create store mutation
  const createStoreMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/super-admin/stores", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stores"] });
      setShowCreateDialog(false);
      toast({
        title: "Tienda creada",
        description: "La tienda se ha creado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo crear la tienda",
        variant: "destructive",
      });
    },
  });

  // Update store mutation
  const updateStoreMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PUT", `/api/super-admin/stores/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stores"] });
      setShowEditDialog(false);
      setSelectedStore(null);
      toast({
        title: "Tienda actualizada",
        description: "Los cambios se han guardado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo actualizar la tienda",
        variant: "destructive",
      });
    },
  });

  // Toggle store status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/super-admin/stores/${id}/status`, { isActive });
      return await response.json();
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

  // Delete store mutation
  const deleteStoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/super-admin/stores/${id}`);
      return await response.json();
    },
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

  // Validate ecosystem mutation
  const validateMutation = useMutation({
    mutationFn: async (storeId: number) => {
      const response = await apiRequest("GET", `/api/super-admin/stores/${storeId}/validate`);
      return await response.json();
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

  const handleValidateEcosystem = (storeId: number) => {
    validateMutation.mutate(storeId);
  };

  const handleCreateStore = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      storeName: formData.get("storeName") as string,
      domain: formData.get("domain") as string,
      plan: formData.get("plan") as string,
      storeAddress: formData.get("storeAddress") as string,
      storeEmail: formData.get("storeEmail") as string,
      storePhone: formData.get("storePhone") as string,
      description: formData.get("description") as string,
      ownerName: formData.get("ownerName") as string,
      ownerEmail: formData.get("ownerEmail") as string,
    };
    createStoreMutation.mutate(data);
  };

  const handleUpdateStore = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedStore) return;
    
    const formData = new FormData(e.currentTarget);
    const data = {
      storeName: formData.get("storeName") as string,
      domain: formData.get("domain") as string,
      plan: formData.get("plan") as string,
      storeAddress: formData.get("storeAddress") as string,
      storeEmail: formData.get("storeEmail") as string,
      storePhone: formData.get("storePhone") as string,
      description: formData.get("description") as string,
    };
    updateStoreMutation.mutate({ id: selectedStore.id, data });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tiendas Registradas</h1>
          <p className="text-gray-600 mt-2">Gestiona todas las tiendas virtuales del ecosistema</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nueva Tienda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crear Nueva Tienda</DialogTitle>
              <DialogDescription>
                Completa la información para crear una nueva tienda virtual
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateStore} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="storeName">Nombre de la Tienda</Label>
                  <Input id="storeName" name="storeName" required />
                </div>
                <div>
                  <Label htmlFor="domain">Dominio</Label>
                  <Input id="domain" name="domain" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plan">Plan</Label>
                  <Select name="plan" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Básico</SelectItem>
                      <SelectItem value="professional">Profesional</SelectItem>
                      <SelectItem value="enterprise">Empresarial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="storeEmail">Email de la Tienda</Label>
                  <Input id="storeEmail" name="storeEmail" type="email" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="storePhone">Teléfono</Label>
                  <Input id="storePhone" name="storePhone" />
                </div>
                <div>
                  <Label htmlFor="ownerName">Nombre del Propietario</Label>
                  <Input id="ownerName" name="ownerName" required />
                </div>
              </div>
              <div>
                <Label htmlFor="ownerEmail">Email del Propietario</Label>
                <Input id="ownerEmail" name="ownerEmail" type="email" required />
              </div>
              <div>
                <Label htmlFor="storeAddress">Dirección</Label>
                <Textarea id="storeAddress" name="storeAddress" />
              </div>
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" name="description" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createStoreMutation.isPending}>
                  {createStoreMutation.isPending ? "Creando..." : "Crear Tienda"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tiendas</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stores.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiendas Activas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stores.filter((store: VirtualStore) => store.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiendas Inactivas</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stores.filter((store: VirtualStore) => !store.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plan Empresarial</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stores.filter((store: VirtualStore) => store.plan === "enterprise").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stores List */}
      <div className="grid gap-6">
        {stores.map((store: VirtualStore) => (
          <Card key={store.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {store.storeName}
                    <Badge variant={store.isActive ? "default" : "secondary"}>
                      {store.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                    <Badge variant="outline">{store.plan}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {store.domain} • Creada el {new Date(store.createdAt).toLocaleDateString()}
                  </CardDescription>
                  {store.description && (
                    <p className="text-sm text-gray-600 mt-2">{store.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLocation(`/super-admin/store-settings?store=${store.id}`);
                    }}
                    className="p-2 h-8 w-8"
                    title="Configurar tienda"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={store.isActive}
                    onCheckedChange={(checked) => 
                      toggleStatusMutation.mutate({ id: store.id, isActive: checked })
                    }
                    disabled={toggleStatusMutation.isPending}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {store.storeEmail && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Email</p>
                    <p className="text-sm text-gray-600">{store.storeEmail}</p>
                  </div>
                )}
                {store.storePhone && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Teléfono</p>
                    <p className="text-sm text-gray-600">{store.storePhone}</p>
                  </div>
                )}
                {store.ownerName && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Propietario</p>
                    <p className="text-sm text-gray-600">{store.ownerName}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedStore(store);
                    setShowEditDialog(true);
                  }}
                  className="flex items-center gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLocation(`/super-admin/store-settings?store=${store.id}`);
                  }}
                  className="flex items-center gap-1"
                >
                  <Settings className="h-3 w-3" />
                  Ajustes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLocation(`/super-admin/store-products?store=${store.id}`);
                  }}
                  className="flex items-center gap-1"
                >
                  <Package className="h-3 w-3" />
                  Productos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleValidateEcosystem(store.id)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                  disabled={validateMutation.isPending}
                >
                  <Database className="h-3 w-3" />
                  {validateMutation.isPending ? "Validando..." : "Validar Ecosistema"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("¿Estás seguro de que quieres eliminar esta tienda?")) {
                      deleteStoreMutation.mutate(store.id);
                    }
                  }}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700"
                  disabled={deleteStoreMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Store Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Tienda</DialogTitle>
            <DialogDescription>
              Modifica la información de la tienda
            </DialogDescription>
          </DialogHeader>
          {selectedStore && (
            <form onSubmit={handleUpdateStore} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-storeName">Nombre de la Tienda</Label>
                  <Input 
                    id="edit-storeName" 
                    name="storeName" 
                    defaultValue={selectedStore.storeName}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit-domain">Dominio</Label>
                  <Input 
                    id="edit-domain" 
                    name="domain" 
                    defaultValue={selectedStore.domain}
                    required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-plan">Plan</Label>
                  <Select name="plan" defaultValue={selectedStore.plan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Básico</SelectItem>
                      <SelectItem value="professional">Profesional</SelectItem>
                      <SelectItem value="enterprise">Empresarial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-storeEmail">Email de la Tienda</Label>
                  <Input 
                    id="edit-storeEmail" 
                    name="storeEmail" 
                    type="email"
                    defaultValue={selectedStore.storeEmail || ""}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-storePhone">Teléfono</Label>
                <Input 
                  id="edit-storePhone" 
                  name="storePhone"
                  defaultValue={selectedStore.storePhone || ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-storeAddress">Dirección</Label>
                <Textarea 
                  id="edit-storeAddress" 
                  name="storeAddress"
                  defaultValue={selectedStore.storeAddress || ""}
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea 
                  id="edit-description" 
                  name="description"
                  defaultValue={selectedStore.description || ""}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateStoreMutation.isPending}>
                  {updateStoreMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}