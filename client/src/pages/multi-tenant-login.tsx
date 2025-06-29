import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Store, User, Lock, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VirtualStore {
  id: number;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

export default function MultiTenantLogin() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  // Obtener lista de tiendas virtuales activas
  const { data: stores, isLoading: storesLoading } = useQuery<VirtualStore[]>({
    queryKey: ["/api/admin/stores"],
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string; storeId: number }) => {
      return apiRequest("POST", "/api/auth/login", credentials);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Inicio de sesión exitoso",
          description: `Bienvenido al sistema de ${stores?.find(s => s.id === parseInt(selectedStoreId))?.name}`,
        });
        // Recargar la página para inicializar el contexto de autenticación
        window.location.href = "/";
      }
    },
    onError: (error: any) => {
      setError(error.message || "Error de autenticación");
      toast({
        title: "Error de autenticación",
        description: "Verifica tus credenciales e intenta nuevamente",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedStoreId) {
      setError("Por favor selecciona una tienda virtual");
      return;
    }

    if (!username || !password) {
      setError("Por favor completa todos los campos");
      return;
    }

    loginMutation.mutate({
      username,
      password,
      storeId: parseInt(selectedStoreId),
    });
  };

  const activeStores = stores?.filter(store => store.isActive) || [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-300" />
          </div>
          <CardTitle className="text-2xl font-bold">Sistema Multi-Tenant</CardTitle>
          <p className="text-muted-foreground">
            Selecciona tu tienda virtual e inicia sesión
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selector de tienda virtual */}
            <div className="space-y-2">
              <Label htmlFor="store-select" className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                Tienda Virtual
              </Label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tu tienda virtual" />
                </SelectTrigger>
                <SelectContent>
                  {storesLoading ? (
                    <SelectItem value="loading" disabled>
                      Cargando tiendas...
                    </SelectItem>
                  ) : activeStores.length === 0 ? (
                    <SelectItem value="no-stores" disabled>
                      No hay tiendas disponibles
                    </SelectItem>
                  ) : (
                    activeStores.map((store) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        <div className="flex flex-col">
                          <span className="font-medium">{store.name}</span>
                          {store.description && (
                            <span className="text-xs text-muted-foreground">
                              {store.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Campo de usuario */}
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Usuario
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            {/* Campo de contraseña */}
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Mensaje de error */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Botón de inicio de sesión */}
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending || storesLoading || !selectedStoreId}
            >
              {loginMutation.isPending ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>

          {/* Información adicional */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Sistema de gestión de órdenes y WhatsApp
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cada tienda opera independientemente con su propia base de datos
            </p>
          </div>

          {/* Estadísticas del sistema */}
          {activeStores.length > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="text-center">
                <p className="text-sm font-medium">
                  {activeStores.length} tienda{activeStores.length !== 1 ? 's' : ''} disponible{activeStores.length !== 1 ? 's' : ''}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>✓ Multi-tenant</div>
                  <div>✓ WhatsApp integrado</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}