import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart,
  Users,
  Building2,
  Calendar,
  Download,
  Eye,
  Filter
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useState } from "react";

interface GlobalMetrics {
  totalRevenue: number;
  totalOrders: number;
  totalStores: number;
  totalUsers: number;
  avgOrderValue: number;
  revenueGrowth: number;
  orderGrowth: number;
  storeGrowth: number;
  userGrowth: number;
}

interface RevenueData {
  month: string;
  revenue: number;
  orders: number;
  stores: number;
}

interface StorePerformance {
  storeId: number;
  storeName: string;
  revenue: number;
  orders: number;
  customers: number;
  growth: number;
  status: 'growing' | 'stable' | 'declining';
}

interface CategoryData {
  category: string;
  revenue: number;
  orders: number;
  percentage: number;
}

export default function Reports() {
  const [timeRange, setTimeRange] = useState("6months");
  const [reportType, setReportType] = useState("revenue");

  const { data: metrics, isLoading: metricsLoading } = useQuery<GlobalMetrics>({
    queryKey: ["/api/super-admin/global-metrics"],
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueData[]>({
    queryKey: ["/api/super-admin/revenue-trends", timeRange],
  });

  const { data: storePerformance, isLoading: storeLoading } = useQuery<StorePerformance[]>({
    queryKey: ["/api/super-admin/store-performance"],
  });

  const { data: categoryData, isLoading: categoryLoading } = useQuery<CategoryData[]>({
    queryKey: ["/api/super-admin/category-analysis"],
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  if (metricsLoading || revenueLoading || storeLoading || categoryLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">6️⃣ Reportes / Estadísticas</h1>
          <p className="text-muted-foreground">Análisis y métricas del ecosistema completo</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button>
            <Eye className="h-4 w-4 mr-2" />
            Dashboard Completo
          </Button>
        </div>
      </div>

      {/* Controles de tiempo y tipo de reporte */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Reportes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="3months">Últimos 3 meses</option>
              <option value="6months">Últimos 6 meses</option>
              <option value="year">Último año</option>
              <option value="2years">Últimos 2 años</option>
            </select>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="revenue">Ingresos</option>
              <option value="orders">Pedidos</option>
              <option value="stores">Tiendas</option>
              <option value="users">Usuarios</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(metrics?.totalRevenue || 0).toLocaleString()}</div>
            <div className="flex items-center space-x-2">
              {(metrics?.revenueGrowth || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <p className={`text-xs ${(metrics?.revenueGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(metrics?.revenueGrowth || 0).toFixed(1)}% vs mes anterior
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metrics?.totalOrders || 0).toLocaleString()}</div>
            <div className="flex items-center space-x-2">
              {(metrics?.orderGrowth || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <p className={`text-xs ${(metrics?.orderGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(metrics?.orderGrowth || 0).toFixed(1)}% vs mes anterior
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiendas Activas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalStores || 0}</div>
            <div className="flex items-center space-x-2">
              {(metrics?.storeGrowth || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <p className={`text-xs ${(metrics?.storeGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(metrics?.storeGrowth || 0).toFixed(1)}% vs mes anterior
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
            <div className="flex items-center space-x-2">
              {(metrics?.userGrowth || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <p className={`text-xs ${(metrics?.userGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(metrics?.userGrowth || 0).toFixed(1)}% vs mes anterior
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencias de ingresos */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencias de Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value?.toLocaleString()}`, 'Ingresos']} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pedidos por mes */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="orders" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Análisis por categorías */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Categorías</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({category, percentage}) => `${category} (${percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {categoryData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${value?.toLocaleString()}`, 'Ingresos']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Análisis de Categorías</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryData?.map((category, index) => (
                <div key={category.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{backgroundColor: COLORS[index % COLORS.length]}}
                    ></div>
                    <div>
                      <h4 className="font-medium">{category.category}</h4>
                      <p className="text-sm text-muted-foreground">{category.orders} pedidos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${category.revenue.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">{category.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rendimiento de tiendas */}
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento de Tiendas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {storePerformance?.map((store) => (
              <div key={store.storeId} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h3 className="font-semibold">{store.storeName}</h3>
                        <p className="text-sm text-muted-foreground">ID: {store.storeId}</p>
                      </div>
                    </div>
                    <Badge 
                      className={
                        store.status === 'growing' ? 'bg-green-100 text-green-800' :
                        store.status === 'stable' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }
                    >
                      {store.status === 'growing' && 'Creciendo'}
                      {store.status === 'stable' && 'Estable'}
                      {store.status === 'declining' && 'Declinando'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <div className="font-semibold text-lg">${store.revenue.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Ingresos</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-lg">{store.orders}</div>
                      <div className="text-sm text-muted-foreground">Pedidos</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-lg">{store.customers}</div>
                      <div className="text-sm text-muted-foreground">Clientes</div>
                    </div>
                    <div className="text-center">
                      <div className={`font-semibold text-lg flex items-center ${store.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {store.growth >= 0 ? (
                          <TrendingUp className="h-4 w-4 mr-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 mr-1" />
                        )}
                        {Math.abs(store.growth).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Crecimiento</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Métricas adicionales */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas Adicionales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">${(metrics?.avgOrderValue || 0).toFixed(0)}</div>
              <div className="text-sm text-muted-foreground">Valor Promedio de Pedido</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{((metrics?.totalOrders || 0) / (metrics?.totalStores || 1)).toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Pedidos por Tienda</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{((metrics?.totalRevenue || 0) / (metrics?.totalStores || 1)).toFixed(0)}</div>
              <div className="text-sm text-muted-foreground">Ingresos por Tienda</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}