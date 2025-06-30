import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  TrendingUp, 
  DollarSign, 
  Users, 
  ShoppingCart,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";

interface GlobalMetrics {
  totalStores: number;
  activeStores: number;
  inactiveStores: number;
  totalOrders: number;
  monthlyRevenue: number;
  averageRetention: number;
  pendingSupport: number;
}

interface StoreOverview {
  id: number;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'cancelled';
  monthlyOrders: number;
  monthlyRevenue: number;
  lastActivity: string;
  supportTickets: number;
}

export default function GlobalDashboard() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/super-admin/metrics', timeRange],
  });

  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ['/api/super-admin/stores'],
  });

  const globalMetrics: GlobalMetrics = metrics || {
    totalStores: 0,
    activeStores: 0,
    inactiveStores: 0,
    totalOrders: 0,
    monthlyRevenue: 0,
    averageRetention: 0,
    pendingSupport: 0
  };

  const storesList: StoreOverview[] = stores || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-gray-500';
      case 'suspended': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getSubscriptionBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-800">Activa</Badge>;
      case 'trial': return <Badge className="bg-blue-100 text-blue-800">Prueba</Badge>;
      case 'expired': return <Badge className="bg-red-100 text-red-800">Vencida</Badge>;
      case 'cancelled': return <Badge className="bg-gray-100 text-gray-800">Cancelada</Badge>;
      default: return <Badge>Desconocido</Badge>;
    }
  };

  if (metricsLoading || storesLoading) {
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
          <h1 className="text-3xl font-bold">Panel del Administrador Global</h1>
          <p className="text-muted-foreground">Controla todo el ecosistema de tiendas desde aquí</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={timeRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('7d')}
          >
            7 días
          </Button>
          <Button 
            variant={timeRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('30d')}
          >
            30 días
          </Button>
          <Button 
            variant={timeRange === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('90d')}
          >
            90 días
          </Button>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiendas Totales</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalMetrics.totalStores}</div>
            <p className="text-xs text-muted-foreground">
              {globalMetrics.activeStores} activas • {globalMetrics.inactiveStores} inactivas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Totales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalMetrics.totalOrders.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              En los últimos {timeRange === '7d' ? '7 días' : timeRange === '30d' ? '30 días' : '90 días'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Mensuales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${globalMetrics.monthlyRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Revenue total del ecosistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retención Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalMetrics.averageRetention}%</div>
            <Progress value={globalMetrics.averageRetention} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Alertas y Notificaciones */}
      {globalMetrics.pendingSupport > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Atención Requerida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700">
              Tienes {globalMetrics.pendingSupport} tickets de soporte pendientes que requieren atención.
            </p>
            <Button className="mt-2" variant="outline">
              Ver Tickets de Soporte
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs de Contenido */}
      <Tabs defaultValue="stores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stores">Tiendas Registradas</TabsTrigger>
          <TabsTrigger value="analytics">Analytics Globales</TabsTrigger>
          <TabsTrigger value="subscriptions">Suscripciones</TabsTrigger>
        </TabsList>

        <TabsContent value="stores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Listado de Tiendas</CardTitle>
              <CardDescription>
                Todas las tiendas registradas en la plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {storesList.map((store) => (
                  <div key={store.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(store.status)}`} />
                      <div>
                        <h3 className="font-semibold">{store.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {store.monthlyOrders} pedidos • ${store.monthlyRevenue.toLocaleString()} ingresos
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getSubscriptionBadge(store.subscriptionStatus)}
                      {store.supportTickets > 0 && (
                        <Badge variant="outline" className="text-orange-600">
                          {store.supportTickets} tickets
                        </Badge>
                      )}
                      <Button variant="outline" size="sm">
                        Gestionar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Crecimiento de Tiendas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Gráfico de crecimiento de tiendas a implementar
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue por Región</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Distribución geográfica de ingresos
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estado de Suscripciones</CardTitle>
              <CardDescription>
                Resumen del estado de todas las suscripciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">
                    {storesList.filter(s => s.subscriptionStatus === 'active').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Activas</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Clock className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">
                    {storesList.filter(s => s.subscriptionStatus === 'trial').length}
                  </div>
                  <div className="text-sm text-muted-foreground">En Prueba</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <AlertTriangle className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">
                    {storesList.filter(s => s.subscriptionStatus === 'expired').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Vencidas</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">
                    {storesList.filter(s => s.subscriptionStatus === 'cancelled').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Canceladas</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}