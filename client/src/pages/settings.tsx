import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AppLayout from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Settings as SettingsIcon, 
  Key, 
  Phone, 
  Shield, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Eye,
  EyeOff,
  Globe,
  Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const whatsappConfigSchema = z.object({
  metaAppId: z.string().min(1, "Meta App ID es requerido"),
  metaAppSecret: z.string().min(1, "Meta App Secret es requerido"),
  whatsappBusinessAccountId: z.string().min(1, "WhatsApp Business Account ID es requerido"),
  whatsappPhoneNumberId: z.string().min(1, "WhatsApp Phone Number ID es requerido"),
  whatsappToken: z.string().min(1, "WhatsApp Token es requerido"),
  whatsappVerifyToken: z.string().min(1, "WhatsApp Verify Token es requerido"),
  webhookUrl: z.string().url("URL del webhook debe ser válida"),
});

type WhatsAppConfig = z.infer<typeof whatsappConfigSchema>;

export default function Settings() {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const { toast } = useToast();

  const { data: config = {}, isLoading } = useQuery<any>({
    queryKey: ["/api/settings/whatsapp"],
  });

  const { data: connectionStatus = {} } = useQuery<any>({
    queryKey: ["/api/whatsapp/status"],
  });

  const form = useForm<WhatsAppConfig>({
    resolver: zodResolver(whatsappConfigSchema),
    defaultValues: {
      metaAppId: config.metaAppId || "",
      metaAppSecret: config.metaAppSecret || "",
      whatsappBusinessAccountId: config.whatsappBusinessAccountId || "",
      whatsappPhoneNumberId: config.whatsappPhoneNumberId || "",
      whatsappToken: config.whatsappToken || "",
      whatsappVerifyToken: config.whatsappVerifyToken || "",
      webhookUrl: config.webhookUrl || "https://whatsapp2-production-e205.up.railway.app/webhook",
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (data: WhatsAppConfig) => {
      return apiRequest("POST", "/api/settings/whatsapp", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/whatsapp"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      toast({
        title: "Configuración guardada",
        description: "Las credenciales de WhatsApp se han guardado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      setIsTestingConnection(true);
      return apiRequest("POST", "/api/whatsapp/test-connection");
    },
    onSuccess: (result: any) => {
      setIsTestingConnection(false);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      toast({
        title: result.success ? "Conexión exitosa" : "Error de conexión",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      setIsTestingConnection(false);
      toast({
        title: "Error de conexión",
        description: error.message || "No se pudo conectar con WhatsApp Business API.",
        variant: "destructive",
      });
    },
  });

  const toggleShowSecret = (field: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const onSubmit = (data: WhatsAppConfig) => {
    saveConfigMutation.mutate(data);
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };

  const getConnectionStatusBadge = () => {
    if (!connectionStatus) {
      return <Badge variant="secondary">No configurado</Badge>;
    }
    
    return connectionStatus.connected ? (
      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Conectado
      </Badge>
    ) : (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Desconectado
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
            <p className="text-gray-600">Gestiona las configuraciones del sistema y API de WhatsApp</p>
          </div>
          {getConnectionStatusBadge()}
        </div>

        <Tabs defaultValue="whatsapp" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="whatsapp" className="flex items-center space-x-2">
              <Phone className="h-4 w-4" />
              <span>WhatsApp Business</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Seguridad</span>
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center space-x-2">
              <SettingsIcon className="h-4 w-4" />
              <span>General</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Phone className="h-5 w-5 text-green-600" />
                  <span>Configuración WhatsApp Business API</span>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Configura las credenciales para conectar con WhatsApp Business API
                </p>
              </CardHeader>
              <CardContent>
                {connectionStatus && !connectionStatus.connected && (
                  <Alert className="mb-6">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      WhatsApp Business API no está conectado. Verifica las credenciales y prueba la conexión.
                    </AlertDescription>
                  </Alert>
                )}

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Meta App ID */}
                    <div className="space-y-2">
                      <Label htmlFor="metaAppId" className="flex items-center space-x-2">
                        <Key className="h-4 w-4" />
                        <span>Meta App ID</span>
                      </Label>
                      <Input
                        id="metaAppId"
                        {...form.register("metaAppId")}
                        placeholder="Tu Meta App ID"
                        className="font-mono"
                      />
                      {form.formState.errors.metaAppId && (
                        <p className="text-sm text-red-600">{form.formState.errors.metaAppId.message}</p>
                      )}
                    </div>

                    {/* Meta App Secret */}
                    <div className="space-y-2">
                      <Label htmlFor="metaAppSecret" className="flex items-center space-x-2">
                        <Key className="h-4 w-4" />
                        <span>Meta App Secret</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="metaAppSecret"
                          {...form.register("metaAppSecret")}
                          type={showSecrets.metaAppSecret ? "text" : "password"}
                          placeholder="Tu Meta App Secret"
                          className="font-mono pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => toggleShowSecret("metaAppSecret")}
                        >
                          {showSecrets.metaAppSecret ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {form.formState.errors.metaAppSecret && (
                        <p className="text-sm text-red-600">{form.formState.errors.metaAppSecret.message}</p>
                      )}
                    </div>

                    {/* WhatsApp Business Account ID */}
                    <div className="space-y-2">
                      <Label htmlFor="whatsappBusinessAccountId" className="flex items-center space-x-2">
                        <Phone className="h-4 w-4" />
                        <span>WhatsApp Business Account ID</span>
                      </Label>
                      <Input
                        id="whatsappBusinessAccountId"
                        {...form.register("whatsappBusinessAccountId")}
                        placeholder="Tu WhatsApp Business Account ID"
                        className="font-mono"
                      />
                      {form.formState.errors.whatsappBusinessAccountId && (
                        <p className="text-sm text-red-600">{form.formState.errors.whatsappBusinessAccountId.message}</p>
                      )}
                    </div>

                    {/* WhatsApp Phone Number ID */}
                    <div className="space-y-2">
                      <Label htmlFor="whatsappPhoneNumberId" className="flex items-center space-x-2">
                        <Phone className="h-4 w-4" />
                        <span>WhatsApp Phone Number ID</span>
                      </Label>
                      <Input
                        id="whatsappPhoneNumberId"
                        {...form.register("whatsappPhoneNumberId")}
                        placeholder="Tu WhatsApp Phone Number ID"
                        className="font-mono"
                      />
                      {form.formState.errors.whatsappPhoneNumberId && (
                        <p className="text-sm text-red-600">{form.formState.errors.whatsappPhoneNumberId.message}</p>
                      )}
                    </div>

                    {/* WhatsApp Token */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="whatsappToken" className="flex items-center space-x-2">
                        <Key className="h-4 w-4" />
                        <span>WhatsApp Token</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="whatsappToken"
                          {...form.register("whatsappToken")}
                          type={showSecrets.whatsappToken ? "text" : "password"}
                          placeholder="Tu WhatsApp Access Token"
                          className="font-mono pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => toggleShowSecret("whatsappToken")}
                        >
                          {showSecrets.whatsappToken ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {form.formState.errors.whatsappToken && (
                        <p className="text-sm text-red-600">{form.formState.errors.whatsappToken.message}</p>
                      )}
                    </div>

                    {/* WhatsApp Verify Token */}
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="whatsappVerifyToken" className="flex items-center space-x-2">
                        <Shield className="h-4 w-4" />
                        <span>WhatsApp Verify Token</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="whatsappVerifyToken"
                          {...form.register("whatsappVerifyToken")}
                          type={showSecrets.whatsappVerifyToken ? "text" : "password"}
                          placeholder="Tu WhatsApp Verify Token"
                          className="font-mono pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => toggleShowSecret("whatsappVerifyToken")}
                        >
                          {showSecrets.whatsappVerifyToken ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {form.formState.errors.whatsappVerifyToken && (
                        <p className="text-sm text-red-600">{form.formState.errors.whatsappVerifyToken.message}</p>
                      )}
                    </div>

                    {/* Webhook URL */}
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="webhookUrl" className="flex items-center space-x-2">
                        <Globe className="h-4 w-4" />
                        <span>URL del Webhook</span>
                      </Label>
                      <Input
                        id="webhookUrl"
                        {...form.register("webhookUrl")}
                        placeholder="https://whatsapp2-production-e205.up.railway.app/webhook"
                        className="font-mono"
                      />
                      {form.formState.errors.webhookUrl && (
                        <p className="text-sm text-red-600">{form.formState.errors.webhookUrl.message}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Esta URL recibirá las notificaciones de mensajes de WhatsApp
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection || testConnectionMutation.isPending}
                    >
                      {isTestingConnection || testConnectionMutation.isPending ? (
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Probando...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="h-4 w-4" />
                          <span>Probar Conexión</span>
                        </div>
                      )}
                    </Button>

                    <Button
                      type="submit"
                      disabled={saveConfigMutation.isPending}
                      className="whatsapp-bg hover:bg-green-600"
                    >
                      {saveConfigMutation.isPending ? (
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Guardando...</span>
                        </div>
                      ) : (
                        "Guardar Configuración"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Connection Status Card */}
            {connectionStatus && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span>Estado de Conexión</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Estado</Label>
                      <div>{getConnectionStatusBadge()}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Última verificación</Label>
                      <p className="text-sm text-gray-600">
                        {connectionStatus.lastCheck ? 
                          new Date(connectionStatus.lastCheck).toLocaleString() : 
                          "Nunca"
                        }
                      </p>
                    </div>
                    {connectionStatus.phoneNumber && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Número de teléfono</Label>
                        <p className="text-sm font-mono">{connectionStatus.phoneNumber}</p>
                      </div>
                    )}
                    {connectionStatus.businessName && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Nombre del negocio</Label>
                        <p className="text-sm">{connectionStatus.businessName}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Seguridad</CardTitle>
                <p className="text-sm text-gray-600">
                  Próximamente: Configuraciones de autenticación y permisos
                </p>
              </CardHeader>
            </Card>
          </TabsContent>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Configuración General</CardTitle>
                <p className="text-sm text-gray-600">
                  Próximamente: Configuraciones generales del sistema
                </p>
              </CardHeader>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}