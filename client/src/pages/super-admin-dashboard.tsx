import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Building2, Users, Database, TrendingUp, AlertTriangle } from "lucide-react";

interface SystemMetrics {
  totalStores: number;
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  ordersToday: number;
  totalRevenue: string;
  storageUsed: string;
  systemStatus: "healthy" | "warning" | "critical";
}

export default function SuperAdminDashboard() {
  const { data: metrics, isLoading, error } = useQuery<SystemMetrics>({
    queryKey: ["/api/super-admin/metrics"],
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Shield className="w-8 h-8 text-red-600" />
          <h1 className="text-3xl font-bold">Dashboard Global</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Error al cargar las métricas del sistema. Verifique su conexión.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-green-600";
      case "warning": return "text-yellow-600";
      case "critical": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "healthy": return "Saludable";
      case "warning": return "Advertencia";
      case "critical": return "Crítico";
      default: return "Desconocido";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-red-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard Global
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Administración del sistema completo
            </p>
          </div>
        </div>
        <div className={`flex items-center space-x-2 ${getStatusColor(metrics?.systemStatus || "healthy")}`}>
          <div className="w-3 h-3 rounded-full bg-current animate-pulse"></div>
          <span className="font-medium">
            Sistema: {getStatusText(metrics?.systemStatus || "healthy")}
          </span>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiendas Activas</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics?.totalStores || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Empresas registradas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics?.totalUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.activeUsers || 0} activos
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {metrics?.totalOrders || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.ordersToday || 0} hoy
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${metrics?.totalRevenue || "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              Todas las tiendas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas del sistema */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Estado del Sistema</span>
            </CardTitle>
            <CardDescription>
              Información técnica del sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Almacenamiento usado:</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {metrics?.storageUsed || "0 MB"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Estado del sistema:</span>
              <span className={`text-sm font-semibold ${getStatusColor(metrics?.systemStatus || "healthy")}`}>
                {getStatusText(metrics?.systemStatus || "healthy")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Última actualización:</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {new Date().toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Rendimiento Global</span>
            </CardTitle>
            <CardDescription>
              Métricas de rendimiento del sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Tiendas activas:</span>
              <span className="text-sm font-semibold text-green-600">
                {metrics?.totalStores || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Usuarios activos:</span>
              <span className="text-sm font-semibold text-blue-600">
                {metrics?.activeUsers || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Órdenes del día:</span>
              <span className="text-sm font-semibold text-purple-600">
                {metrics?.ordersToday || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Acciones rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Administración y herramientas del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
              <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <h3 className="font-medium">Gestión de Usuarios</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Administrar usuarios globales
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <h3 className="font-medium">Gestión de Tiendas</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Administrar empresas
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
              <Database className="w-8 h-8 mx-auto mb-2 text-purple-600" />
              <h3 className="font-medium">Configuración</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configuración del sistema
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}