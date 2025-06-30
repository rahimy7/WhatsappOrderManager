import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, MessageSquare, Database, Activity, TrendingUp, Clock, AlertCircle } from "lucide-react";

interface GlobalMetrics {
  totalStores: number;
  activeStores: number;
  totalUsers: number;
  totalMessages: number;
  dbConnections: number;
  systemUptime: string;
  apiCalls: number;
  storageUsage: string;
}

interface StoreMetrics {
  id: number;
  name: string;
  status: string;
  lastActivity: string;
  messageCount: number;
  userCount: number;
  dbSize: string;
  subscription: string;
}

export default function SuperAdminDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<GlobalMetrics>({
    queryKey: ["/api/super-admin/metrics"],
  });

  const { data: storeMetrics, isLoading: storesLoading } = useQuery<StoreMetrics[]>({
    queryKey: ["/api/super-admin/store-metrics"],
  });

  if (metricsLoading || storesLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      inactive: "secondary",
      maintenance: "destructive",
      warning: "outline",
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getSubscriptionColor = (subscription: string) => {
    const colors = {
      free: "text-gray-600",
      basic: "text-blue-600", 
      premium: "text-purple-600",
      enterprise: "text-green-600",
    } as const;
    
    return colors[subscription as keyof typeof colors] || "text-gray-600";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Global del Sistema</h1>
          <p className="text-muted-foreground">
            Gestión y monitoreo de todas las tiendas virtuales
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          Actualizado: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Métricas Globales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiendas Totales</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalStores || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.activeStores || 0} activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios del Sistema</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Todos los roles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensajes WhatsApp</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalMessages || 0}</div>
            <p className="text-xs text-muted-foreground">
              Últimas 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uso de Base de Datos</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.storageUsage || "0 MB"}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.dbConnections || 0} conexiones
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas Adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistema Activo</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics?.systemUptime || "0h 0m"}
            </div>
            <p className="text-xs text-muted-foreground">
              Tiempo de actividad
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Llamadas API</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.apiCalls || 0}</div>
            <p className="text-xs text-muted-foreground">
              Últimas 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado del Sistema</CardTitle>
            <AlertCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Operativo</div>
            <p className="text-xs text-muted-foreground">
              Todos los servicios funcionando
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Tiendas con Métricas */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Tiendas Virtuales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {storeMetrics?.map((store) => (
              <div
                key={store.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <h3 className="font-medium">{store.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      ID: {store.id}
                    </p>
                  </div>
                  {getStatusBadge(store.status)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-medium">{store.messageCount}</p>
                    <p className="text-muted-foreground">Mensajes</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{store.userCount}</p>
                    <p className="text-muted-foreground">Usuarios</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{store.dbSize}</p>
                    <p className="text-muted-foreground">BD Tamaño</p>
                  </div>
                  <div className="text-center">
                    <p className={`font-medium ${getSubscriptionColor(store.subscription)}`}>
                      {store.subscription.toUpperCase()}
                    </p>
                    <p className="text-muted-foreground">Plan</p>
                  </div>
                </div>

                <div className="text-right text-sm text-muted-foreground">
                  <p>Última actividad:</p>
                  <p>{store.lastActivity}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}