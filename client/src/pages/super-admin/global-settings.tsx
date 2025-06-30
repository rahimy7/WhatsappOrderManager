import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Settings, 
  Globe, 
  DollarSign, 
  FileText, 
  Bell,
  Mail,
  Languages,
  Save,
  Shield
} from "lucide-react";

interface GlobalConfig {
  platform: {
    name: string;
    version: string;
    maintenanceMode: boolean;
    defaultLanguage: string;
    supportedLanguages: string[];
    timezone: string;
  };
  pricing: {
    basicPlan: number;
    premiumPlan: number;
    enterprisePlan: number;
    currency: string;
    trialDays: number;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    systemAlerts: boolean;
  };
  security: {
    sessionTimeout: number;
    passwordMinLength: number;
    twoFactorRequired: boolean;
    ipWhitelist: string[];
  };
  legal: {
    termsOfService: string;
    privacyPolicy: string;
    cookiePolicy: string;
    lastUpdated: string;
  };
  support: {
    supportEmail: string;
    supportPhone: string;
    supportHours: string;
    ticketResponseTime: number;
  };
}

const configSchema = z.object({
  platformName: z.string().min(1, "Nombre requerido"),
  defaultLanguage: z.string().min(1, "Idioma requerido"),
  timezone: z.string().min(1, "Zona horaria requerida"),
  basicPlan: z.number().min(0, "Precio debe ser positivo"),
  premiumPlan: z.number().min(0, "Precio debe ser positivo"),
  enterprisePlan: z.number().min(0, "Precio debe ser positivo"),
  currency: z.string().min(1, "Moneda requerida"),
  trialDays: z.number().min(1, "Días de prueba requeridos"),
  supportEmail: z.string().email("Email inválido"),
  supportPhone: z.string().min(1, "Teléfono requerido"),
  supportHours: z.string().min(1, "Horarios requeridos"),
  ticketResponseTime: z.number().min(1, "Tiempo de respuesta requerido"),
  termsOfService: z.string().min(1, "Términos requeridos"),
  privacyPolicy: z.string().min(1, "Política requerida"),
  cookiePolicy: z.string().min(1, "Política requerida"),
});

type ConfigFormData = z.infer<typeof configSchema>;

export default function GlobalSettings() {
  const [activeTab, setActiveTab] = useState("platform");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['/api/super-admin/config'],
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: Partial<ConfigFormData>) => {
      const response = await apiRequest("PUT", "/api/super-admin/config", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/config'] });
      toast({
        title: "Configuración actualizada",
        description: "Los cambios han sido guardados exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar configuración",
        variant: "destructive",
      });
    }
  });

  const globalConfig: GlobalConfig = config || {
    platform: {
      name: "OrderManager Pro",
      version: "1.0.0",
      maintenanceMode: false,
      defaultLanguage: "es",
      supportedLanguages: ["es", "en"],
      timezone: "America/Mexico_City"
    },
    pricing: {
      basicPlan: 29,
      premiumPlan: 59,
      enterprisePlan: 99,
      currency: "USD",
      trialDays: 14
    },
    notifications: {
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      systemAlerts: true
    },
    security: {
      sessionTimeout: 24,
      passwordMinLength: 8,
      twoFactorRequired: false,
      ipWhitelist: []
    },
    legal: {
      termsOfService: "",
      privacyPolicy: "",
      cookiePolicy: "",
      lastUpdated: new Date().toISOString()
    },
    support: {
      supportEmail: "support@orderManager.com",
      supportPhone: "+52 55 1234 5678",
      supportHours: "Lunes a Viernes 9:00 - 18:00",
      ticketResponseTime: 24
    }
  };

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      platformName: globalConfig.platform.name,
      defaultLanguage: globalConfig.platform.defaultLanguage,
      timezone: globalConfig.platform.timezone,
      basicPlan: globalConfig.pricing.basicPlan,
      premiumPlan: globalConfig.pricing.premiumPlan,
      enterprisePlan: globalConfig.pricing.enterprisePlan,
      currency: globalConfig.pricing.currency,
      trialDays: globalConfig.pricing.trialDays,
      supportEmail: globalConfig.support.supportEmail,
      supportPhone: globalConfig.support.supportPhone,
      supportHours: globalConfig.support.supportHours,
      ticketResponseTime: globalConfig.support.ticketResponseTime,
      termsOfService: globalConfig.legal.termsOfService,
      privacyPolicy: globalConfig.legal.privacyPolicy,
      cookiePolicy: globalConfig.legal.cookiePolicy,
    },
  });

  const onSubmit = (data: ConfigFormData) => {
    updateConfigMutation.mutate(data);
  };

  const handleToggle = (field: string, value: boolean) => {
    updateConfigMutation.mutate({ [field]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Configuraciones Globales</h1>
          <p className="text-muted-foreground">Administra las configuraciones de toda la plataforma</p>
        </div>
        <Button onClick={() => form.handleSubmit(onSubmit)()} disabled={updateConfigMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateConfigMutation.isPending ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="platform">Plataforma</TabsTrigger>
          <TabsTrigger value="pricing">Precios</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          <TabsTrigger value="security">Seguridad</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
          <TabsTrigger value="support">Soporte</TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <TabsContent value="platform" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Configuración de Plataforma
                  </CardTitle>
                  <CardDescription>
                    Configuraciones generales de la plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="platformName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de la Plataforma</FormLabel>
                          <FormControl>
                            <Input placeholder="OrderManager Pro" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="space-y-2">
                      <Label>Versión Actual</Label>
                      <Input value={globalConfig.platform.version} disabled />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="defaultLanguage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Idioma por Defecto</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona idioma" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="es">Español</SelectItem>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="pt">Português</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zona Horaria</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona zona horaria" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="America/Mexico_City">México (GMT-6)</SelectItem>
                              <SelectItem value="America/New_York">New York (GMT-5)</SelectItem>
                              <SelectItem value="America/Los_Angeles">Los Ángeles (GMT-8)</SelectItem>
                              <SelectItem value="Europe/Madrid">Madrid (GMT+1)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Modo de Mantenimiento</Label>
                      <p className="text-sm text-muted-foreground">
                        Activa para bloquear el acceso durante actualizaciones
                      </p>
                    </div>
                    <Switch
                      checked={globalConfig.platform.maintenanceMode}
                      onCheckedChange={(checked) => handleToggle('maintenanceMode', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Configuración de Precios
                  </CardTitle>
                  <CardDescription>
                    Define los precios de suscripción para las tiendas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="basicPlan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan Básico (USD/mes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="29"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="premiumPlan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan Premium (USD/mes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="59"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enterprisePlan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan Enterprise (USD/mes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="99"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Moneda</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona moneda" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                              <SelectItem value="MXN">MXN - Peso Mexicano</SelectItem>
                              <SelectItem value="EUR">EUR - Euro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="trialDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Días de Prueba</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="14"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Configuración de Notificaciones
                  </CardTitle>
                  <CardDescription>
                    Controla los canales de notificación globales
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Notificaciones por Email</Label>
                        <p className="text-sm text-muted-foreground">
                          Permite envío de notificaciones por correo electrónico
                        </p>
                      </div>
                      <Switch
                        checked={globalConfig.notifications.emailEnabled}
                        onCheckedChange={(checked) => handleToggle('emailEnabled', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Notificaciones SMS</Label>
                        <p className="text-sm text-muted-foreground">
                          Permite envío de notificaciones por mensaje de texto
                        </p>
                      </div>
                      <Switch
                        checked={globalConfig.notifications.smsEnabled}
                        onCheckedChange={(checked) => handleToggle('smsEnabled', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Notificaciones Push</Label>
                        <p className="text-sm text-muted-foreground">
                          Permite notificaciones push del navegador
                        </p>
                      </div>
                      <Switch
                        checked={globalConfig.notifications.pushEnabled}
                        onCheckedChange={(checked) => handleToggle('pushEnabled', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base">Alertas del Sistema</Label>
                        <p className="text-sm text-muted-foreground">
                          Recibe alertas críticas del sistema
                        </p>
                      </div>
                      <Switch
                        checked={globalConfig.notifications.systemAlerts}
                        onCheckedChange={(checked) => handleToggle('systemAlerts', checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Configuración de Seguridad
                  </CardTitle>
                  <CardDescription>
                    Configuraciones de seguridad para toda la plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tiempo de Sesión (horas)</Label>
                      <Input
                        type="number"
                        value={globalConfig.security.sessionTimeout}
                        onChange={(e) => handleToggle('sessionTimeout', Number(e.target.value))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Longitud Mínima de Contraseña</Label>
                      <Input
                        type="number"
                        value={globalConfig.security.passwordMinLength}
                        onChange={(e) => handleToggle('passwordMinLength', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Autenticación de Dos Factores Obligatoria</Label>
                      <p className="text-sm text-muted-foreground">
                        Requiere 2FA para todos los usuarios administradores
                      </p>
                    </div>
                    <Switch
                      checked={globalConfig.security.twoFactorRequired}
                      onCheckedChange={(checked) => handleToggle('twoFactorRequired', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="legal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documentos Legales
                  </CardTitle>
                  <CardDescription>
                    Gestiona los términos y políticas de la plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="termsOfService"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Términos y Condiciones</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ingresa los términos y condiciones..."
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="privacyPolicy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Política de Privacidad</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ingresa la política de privacidad..."
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cookiePolicy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Política de Cookies</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ingresa la política de cookies..."
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="support" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Configuración de Soporte
                  </CardTitle>
                  <CardDescription>
                    Información de contacto y configuración del soporte técnico
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="supportEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email de Soporte</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="support@platform.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supportPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono de Soporte</FormLabel>
                          <FormControl>
                            <Input placeholder="+52 55 1234 5678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="supportHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horarios de Atención</FormLabel>
                          <FormControl>
                            <Input placeholder="Lunes a Viernes 9:00 - 18:00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ticketResponseTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tiempo de Respuesta (horas)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="24"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </form>
        </Form>
      </Tabs>
    </div>
  );
}