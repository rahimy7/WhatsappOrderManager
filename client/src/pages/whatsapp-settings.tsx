import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, Settings, Smartphone, Key, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  businessAccountId: string | null;
  appId: string | null;
  isActive: boolean | null;
}

interface WhatsAppStatus {
  connected: boolean;
  configured: boolean;
  lastActivity: string | null;
  webhookUrl: string;
}

export default function WhatsAppSettings() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<WhatsAppConfig>({
    accessToken: "",
    phoneNumberId: "",
    webhookVerifyToken: "",
    businessAccountId: "",
    appId: "",
    isActive: true
  });

  // Obtener configuración actual
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["/api/settings/whatsapp"]
  });

  // Obtener estado de conexión
  const { data: status } = useQuery({
    queryKey: ["/api/whatsapp/status"],
    refetchInterval: 5000
  });

  // Actualizar formData cuando se obtiene la configuración
  useEffect(() => {
    if (config && typeof config === 'object') {
      setFormData({
        accessToken: (config as any).accessToken || "",
        phoneNumberId: (config as any).phoneNumberId || "",
        webhookVerifyToken: (config as any).webhookVerifyToken || "",
        businessAccountId: (config as any).businessAccountId || "",
        appId: (config as any).appId || "",
        isActive: (config as any).isActive ?? true
      });
    }
  }, [config]);

  // Mutación para actualizar configuración
  const updateConfigMutation = useMutation({
    mutationFn: (data: WhatsAppConfig) => 
      apiRequest("/api/settings/whatsapp", "PUT", data),
    onSuccess: () => {
      toast({
        title: "Configuración actualizada",
        description: "Los cambios se guardaron correctamente"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/whatsapp"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración",
        variant: "destructive"
      });
    }
  });

  // Mutación para probar conexión
  const testConnectionMutation = useMutation({
    mutationFn: () => apiRequest("/api/whatsapp/test-connection", "POST"),
    onSuccess: (data: any) => {
      toast({
        title: "Prueba de conexión",
        description: data.success ? "Conexión exitosa" : "Error en la conexión",
        variant: data.success ? "default" : "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfigMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof WhatsAppConfig, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const maskToken = (token: string) => {
    if (!token || token.length < 10) return token;
    return token.slice(0, 8) + "****" + token.slice(-4);
  };

  if (configLoading) {
    return <div className="p-6">Cargando configuración...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Configuración de WhatsApp Business API</h1>
      </div>

      {/* Estado de conexión */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>Estado de Conexión</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Badge variant={(status as any)?.connected ? "default" : "destructive"}>
                {(status as any)?.connected ? "Conectado" : "Desconectado"}
              </Badge>
              <span className="text-sm text-muted-foreground">Estado API</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={(status as any)?.configured ? "default" : "secondary"}>
                {(status as any)?.configured ? "Configurado" : "Pendiente"}
              </Badge>
              <span className="text-sm text-muted-foreground">Configuración</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                size="sm" 
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending}
              >
                {testConnectionMutation.isPending ? "Probando..." : "Probar Conexión"}
              </Button>
            </div>
          </div>
          
          {(status as any)?.webhookUrl && (
            <div className="mt-4">
              <Label className="text-sm font-medium">URL del Webhook</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input 
                  value={(status as any).webhookUrl} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText((status as any).webhookUrl)}
                >
                  Copiar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulario de configuración */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5" />
            <span>Configuración de API</span>
          </CardTitle>
          <CardDescription>
            Configura los tokens y identificadores de tu aplicación de WhatsApp Business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Token de Acceso */}
            <div className="space-y-2">
              <Label htmlFor="accessToken" className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Token de Acceso</span>
              </Label>
              <Input
                id="accessToken"
                type="password"
                value={formData.accessToken}
                onChange={(e) => handleInputChange("accessToken", e.target.value)}
                placeholder="Ingresa tu token de acceso de Meta Developer Console"
                className="font-mono"
              />
              {config?.accessToken && (
                <p className="text-xs text-muted-foreground">
                  Token actual: {maskToken(config.accessToken)}
                </p>
              )}
            </div>

            <Separator />

            {/* Phone Number ID */}
            <div className="space-y-2">
              <Label htmlFor="phoneNumberId" className="flex items-center space-x-2">
                <Smartphone className="h-4 w-4" />
                <span>Phone Number ID</span>
              </Label>
              <Input
                id="phoneNumberId"
                value={formData.phoneNumberId}
                onChange={(e) => handleInputChange("phoneNumberId", e.target.value)}
                placeholder="667993026397854"
                className="font-mono"
              />
            </div>

            {/* Business Account ID */}
            <div className="space-y-2">
              <Label htmlFor="businessAccountId">Business Account ID</Label>
              <Input
                id="businessAccountId"
                value={formData.businessAccountId || ""}
                onChange={(e) => handleInputChange("businessAccountId", e.target.value)}
                placeholder="444239435931422"
                className="font-mono"
              />
            </div>

            {/* App ID */}
            <div className="space-y-2">
              <Label htmlFor="appId">App ID</Label>
              <Input
                id="appId"
                value={formData.appId || ""}
                onChange={(e) => handleInputChange("appId", e.target.value)}
                placeholder="711755744667781"
                className="font-mono"
              />
            </div>

            <Separator />

            {/* Webhook Verify Token */}
            <div className="space-y-2">
              <Label htmlFor="webhookVerifyToken">Webhook Verify Token</Label>
              <Input
                id="webhookVerifyToken"
                value={formData.webhookVerifyToken}
                onChange={(e) => handleInputChange("webhookVerifyToken", e.target.value)}
                placeholder="Token de verificación del webhook"
                className="font-mono"
              />
            </div>

            <div className="flex space-x-4">
              <Button 
                type="submit" 
                disabled={updateConfigMutation.isPending}
                className="flex-1"
              >
                {updateConfigMutation.isPending ? "Guardando..." : "Guardar Configuración"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Instrucciones */}
      <Card>
        <CardHeader>
          <CardTitle>Instrucciones de Configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Para obtener estos valores:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Ve a Meta Developer Console (developers.facebook.com)</li>
                <li>Selecciona tu aplicación de WhatsApp Business</li>
                <li>En "Configuración" encontrarás el Token de Acceso</li>
                <li>En "Números de teléfono" encontrarás el Phone Number ID</li>
                <li>En "Configuración de la aplicación" encontrarás el App ID</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}