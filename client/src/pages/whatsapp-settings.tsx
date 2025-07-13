import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  AlertCircle, 
  CheckCircle, 
  Settings, 
  Smartphone, 
  Key, 
  Shield, 
  Server,
  Phone,
  Globe,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Activity
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

interface WhatsAppConfig {
  id?: number;
  accessToken: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  businessAccountId: string | null;
  appId: string | null;
  isActive: boolean | null;
  storeId?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface WhatsAppStatus {
  connected: boolean;
  configured: boolean;
  lastActivity: string | null;
  webhookUrl: string;
  phoneNumber?: string;
  businessName?: string;
  message?: string;
}

export default function WhatsAppSettings() {
  const { toast } = useToast();
 const { user } = useAuth();
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<WhatsAppConfig>({
    accessToken: "",
    phoneNumberId: "",
    webhookVerifyToken: "",
    businessAccountId: "",
    appId: "",
    isActive: true
  });

  // Obtener configuración actual
 // Obtener configuración actual
// Obtener configuración actual
const { data: config, isLoading: configLoading, refetch: refetchConfig } = useQuery<WhatsAppConfig>({
  queryKey: ["/api/whatsapp-settings"]
});

// Obtener estado de conexión
const { data: status, refetch: refetchStatus } = useQuery<WhatsAppStatus>({
  queryKey: ["/api/whatsapp/status"],
  refetchInterval: 30000
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
    apiRequest("PUT", "/api/whatsapp-settings", data),
  onSuccess: () => {
    toast({
      title: "Configuración actualizada",
      description: "Los cambios se guardaron correctamente"
    });
    refetchConfig();
    refetchStatus();
  },
  onError: (error: any) => {
    toast({
      title: "Error",
      description: error?.message || "No se pudo actualizar la configuración",
      variant: "destructive"
    });
  }
});

const testConnectionMutation = useMutation({
  mutationFn: () => apiRequest("POST", "/api/super-admin/whatsapp-test", {
    storeId: user?.storeId || user?.storeId,
    phoneNumberId: formData.phoneNumberId || config?.phoneNumberId
  }),
  onSuccess: (data: any) => {
    toast({
      title: "Prueba de conexión",
      description: data.success ? (data.message || "Conexión exitosa") : (data.message || "Error en la conexión"),
      variant: data.success ? "default" : "destructive"
    });
    refetchStatus();
  },
  onError: (error: any) => {
    toast({
      title: "Error de conexión",
      description: error?.message || "No se pudo probar la conexión",
      variant: "destructive"
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

  const toggleTokenVisibility = (field: string) => {
    setShowTokens(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: `${label} copiado al portapapeles`
    });
  };

  const maskToken = (token: string) => {
    if (!token || token.length < 10) return token;
    return token.slice(0, 12) + "••••••••••••••••" + token.slice(-6);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "No disponible";
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (configLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Cargando configuración...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Settings className="h-7 w-7 text-green-600" />
        <div>
          <h1 className="text-3xl font-bold">Configuración de WhatsApp Business API</h1>
          <p className="text-muted-foreground">Gestiona la configuración y estado de tu integración con WhatsApp</p>
        </div>
      </div>

      {/* Información actual de la configuración */}
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-green-800">
            <Activity className="h-5 w-5" />
            <span>Configuración Actual</span>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => { refetchConfig(); refetchStatus(); }}
              className="ml-auto"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Store Info */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Server className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Información de Tienda</span>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Store ID:</span>
                  <span className="ml-2 font-mono">{config?.storeId || user?.storeId || 'No definido'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Usuario:</span>
                  <span className="ml-2">{user?.username || 'No autenticado'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Nivel:</span>
                 <Badge variant="outline" className="ml-2">{user?.role || 'N/A'}</Badge>
                </div>
              </div>
            </div>

            {/* WhatsApp API Info */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-green-600" />
                <span className="font-medium">Información de API</span>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Phone Number ID:</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {config?.phoneNumberId || 'No configurado'}
                    </span>
                    {config?.phoneNumberId && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => copyToClipboard(config.phoneNumberId, 'Phone Number ID')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Business Account ID:</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {config?.businessAccountId || 'No configurado'}
                    </span>
                    {config?.businessAccountId && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => copyToClipboard(config.businessAccountId, 'Business Account ID')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">App ID:</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {config?.appId || 'No configurado'}
                    </span>
                    {config?.appId && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => copyToClipboard(config.appId, 'App ID')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Status and Timestamps */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium">Estado y Fechas</span>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <Badge 
                    variant={config?.isActive ? "default" : "destructive"} 
                    className="ml-2"
                  >
                    {config?.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Creado:</span>
                  <div className="text-xs mt-1">{formatDate(config?.createdAt)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Actualizado:</span>
                  <div className="text-xs mt-1">{formatDate(config?.updatedAt)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Access Token Display */}
          <Separator className="my-4" />
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-orange-600" />
              <span className="font-medium">Token de Acceso</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-100 p-2 rounded font-mono text-xs">
                {showTokens.accessToken ? config?.accessToken : maskToken(config?.accessToken || '')}
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => toggleTokenVisibility('accessToken')}
              >
                {showTokens.accessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              {config?.accessToken && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => copyToClipboard(config.accessToken, 'Token de Acceso')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Webhook Verify Token Display */}
          <div className="space-y-2 mt-4">
            <div className="flex items-center space-x-2">
              <Key className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Webhook Verify Token</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-100 p-2 rounded font-mono text-xs">
                {showTokens.verifyToken ? config?.webhookVerifyToken : (config?.webhookVerifyToken ? '••••••••••••' : 'No configurado')}
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => toggleTokenVisibility('verifyToken')}
              >
                {showTokens.verifyToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              {config?.webhookVerifyToken && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => copyToClipboard(config.webhookVerifyToken, 'Verify Token')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estado de conexión */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <span>Estado de Conexión</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
              <span className="text-sm font-medium">{(status as any)?.phoneNumber || 'N/A'}</span>
              <span className="text-sm text-muted-foreground">Número</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                size="sm" 
                onClick={() => testConnectionMutation.mutate()}
                disabled={testConnectionMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {testConnectionMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    Probando...
                  </>
                ) : (
                  "Probar Conexión"
                )}
              </Button>
            </div>
          </div>
          
          {(status as any)?.webhookUrl && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center space-x-1">
                <Globe className="w-4 h-4" />
                <span>URL del Webhook</span>
              </Label>
              <div className="flex items-center space-x-2">
                <Input 
                  value={(status as any).webhookUrl} 
                  readOnly 
                  className="font-mono text-xs bg-gray-50"
                />
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => copyToClipboard((status as any).webhookUrl, 'URL del Webhook')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {(status as any)?.message && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{(status as any).message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Formulario de configuración */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Actualizar Configuración</span>
          </CardTitle>
          <CardDescription>
            Modifica los tokens y identificadores de tu aplicación de WhatsApp Business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Token de Acceso */}
            <div className="space-y-2">
              <Label htmlFor="accessToken" className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Token de Acceso Permanente</span>
              </Label>
              <Input
                id="accessToken"
                type={showTokens.editAccessToken ? "text" : "password"}
                value={formData.accessToken}
                onChange={(e) => handleInputChange("accessToken", e.target.value)}
                placeholder="Ingresa tu token de acceso permanente de Meta Developer Console"
                className="font-mono pr-10"
              />
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleTokenVisibility('editAccessToken')}
                >
                  {showTokens.editAccessToken ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                  {showTokens.editAccessToken ? 'Ocultar' : 'Mostrar'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Usa tokens permanentes (no caducan)
                </span>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* Webhook Verify Token */}
              <div className="space-y-2">
                <Label htmlFor="webhookVerifyToken">Webhook Verify Token</Label>
                <Input
                  id="webhookVerifyToken"
                  type={showTokens.editVerifyToken ? "text" : "password"}
                  value={formData.webhookVerifyToken}
                  onChange={(e) => handleInputChange("webhookVerifyToken", e.target.value)}
                  placeholder="verifytoken12345"
                  className="font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleTokenVisibility('editVerifyToken')}
                >
                  {showTokens.editVerifyToken ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                  {showTokens.editVerifyToken ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>
            </div>

            <div className="flex space-x-4">
              <Button 
                type="submit" 
                disabled={updateConfigMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {updateConfigMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Configuración"
                )}
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
                <li>Ve a <strong>Meta Developer Console</strong> (developers.facebook.com)</li>
                <li>Selecciona tu aplicación de WhatsApp Business</li>
                <li>En <strong>"Configuración"</strong> encontrarás el Token de Acceso</li>
                <li>En <strong>"Números de teléfono"</strong> encontrarás el Phone Number ID</li>
                <li>En <strong>"Configuración de la aplicación"</strong> encontrarás el App ID</li>
                <li>Configura el webhook URL: <code>{(status as any)?.webhookUrl}</code></li>
                <li>Usa el verify token configurado para verificar el webhook</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}