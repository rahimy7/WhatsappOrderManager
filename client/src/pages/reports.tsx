import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { DatePickerWithRange } from "@/components/ui/date-picker";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Download, TrendingUp, Calendar, DollarSign, Users, Package, FileBarChart, Filter } from "lucide-react";
import { addDays, format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [selectedPeriod, setSelectedPeriod] = useState("thisMonth");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const { data: orders } = useQuery({
    queryKey: ["/api/orders"],
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
  });

  const { data: products } = useQuery({
    queryKey: ["/api/products"],
  });

  const { data: metrics } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
  });

  // Filter data based on selected criteria
  const filteredOrders = React.useMemo(() => {
    if (!Array.isArray(orders)) return [];
    
    let filtered = orders;
    
    // Filter by status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((order: any) => order.status === selectedStatus);
    }
    
    // Filter by date range
    if (dateRange.from && dateRange.to) {
      filtered = filtered.filter((order: any) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= dateRange.from && orderDate <= dateRange.to;
      });
    }
    
    return filtered;
  }, [orders, selectedStatus, dateRange]);

  // Calculate analytics data
  const totalOrders = filteredOrders.length;
  const completedOrders = filteredOrders.filter((order: any) => order.status === "completed").length;
  const totalRevenue = filteredOrders.reduce((sum: number, order: any) => 
    order.status === "completed" ? sum + parseFloat(order.totalAmount || 0) : sum, 0);
  const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;
  const completionRate = totalOrders > 0 ? (completedOrders / totalOrders * 100).toFixed(1) : "0";

  // Performance by technician
  const technicianPerformance = React.useMemo(() => {
    if (!Array.isArray(users) || !Array.isArray(filteredOrders)) return [];
    
    const technicians = users.filter((user: any) => user.role === "technician");
    return technicians.map((tech: any) => {
      const techOrders = filteredOrders.filter((order: any) => order.assignedUserId === tech.id);
      const completed = techOrders.filter((order: any) => order.status === "completed").length;
      const revenue = techOrders.reduce((sum: number, order: any) => 
        order.status === "completed" ? sum + parseFloat(order.totalAmount || 0) : sum, 0);
      
      return {
        name: tech.name,
        orders: techOrders.length,
        completed,
        revenue,
        completionRate: techOrders.length > 0 ? (completed / techOrders.length * 100).toFixed(1) : "0"
      };
    });
  }, [users, filteredOrders]);

  // Orders by status chart data
  const statusChartData = React.useMemo(() => {
    const statuses = ["pending", "assigned", "in_progress", "completed", "cancelled"];
    return statuses.map((status) => {
      const count = filteredOrders.filter((order: any) => order.status === status).length;
      const statusLabels: Record<string, string> = {
        pending: "Pendiente",
        assigned: "Asignado", 
        in_progress: "En Proceso",
        completed: "Completado",
        cancelled: "Cancelado"
      };
      
      return {
        name: statusLabels[status],
        value: count,
        color: getStatusColor(status)
      };
    });
  }, [filteredOrders]);

  // Revenue trend data (last 7 days)
  const revenueTrendData = React.useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(new Date(), -6 + i);
      const dayOrders = filteredOrders.filter((order: any) => {
        const orderDate = new Date(order.createdAt);
        return format(orderDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      });
      const dayRevenue = dayOrders.reduce((sum: number, order: any) => 
        order.status === "completed" ? sum + parseFloat(order.totalAmount || 0) : sum, 0);
      
      return {
        date: format(date, 'MMM dd'),
        revenue: dayRevenue,
        orders: dayOrders.length
      };
    });
    
    return last7Days;
  }, [filteredOrders]);

  // Product performance
  const productPerformance = React.useMemo(() => {
    if (!Array.isArray(products) || !Array.isArray(filteredOrders)) return [];
    
    return products.map((product: any) => {
      const productOrders = filteredOrders.filter((order: any) => 
        order.items?.some((item: any) => item.productId === product.id)
      );
      const revenue = productOrders.reduce((sum: number, order: any) => 
        order.status === "completed" ? sum + parseFloat(order.totalAmount || 0) : sum, 0);
      
      return {
        name: product.name,
        orders: productOrders.length,
        revenue,
        category: product.category
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [products, filteredOrders]);

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      pending: "#ef4444",
      assigned: "#3b82f6",
      in_progress: "#f59e0b",
      completed: "#10b981",
      cancelled: "#6b7280"
    };
    return colors[status] || "#6b7280";
  }

  function handlePeriodChange(period: string) {
    setSelectedPeriod(period);
    const now = new Date();
    
    switch (period) {
      case "today":
        setDateRange({ from: now, to: now });
        break;
      case "thisWeek":
        setDateRange({ 
          from: addDays(now, -7), 
          to: now 
        });
        break;
      case "thisMonth":
        setDateRange({
          from: startOfMonth(now),
          to: endOfMonth(now)
        });
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        setDateRange({
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth)
        });
        break;
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileBarChart className="h-5 w-5 mr-2" />
            Reportes y Analytics Avanzados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="thisWeek">Esta Semana</SelectItem>
                  <SelectItem value="thisMonth">Este Mes</SelectItem>
                  <SelectItem value="lastMonth">Mes Anterior</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="assigned">Asignado</SelectItem>
                  <SelectItem value="in_progress">En Proceso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" className="w-full md:w-auto md:ml-auto">
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Exportar Datos</span>
              <span className="sm:hidden">Exportar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Total Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-sm text-gray-500 mt-1">Período seleccionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Tasa de Completitud
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <p className="text-sm text-gray-500 mt-1">{completedOrders} completados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <DollarSign className="h-4 w-4 mr-2" />
              Ingresos Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString('es-MX')}</div>
            <p className="text-sm text-green-600 mt-1">Período seleccionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Valor Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${averageOrderValue.toLocaleString('es-MX')}</div>
            <p className="text-sm text-gray-500 mt-1">Por pedido completado</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Tendencia de Ingresos (7 días)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, 'Ingresos']} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Desglose por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statusChartData.map((status) => {
                  const percentage = totalOrders > 0 ? (status.value / totalOrders * 100).toFixed(1) : "0";
                  return (
                    <div key={status.name} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="font-medium">{status.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{status.value}</div>
                        <div className="text-sm text-gray-500">{percentage}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento por Técnico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {technicianPerformance.map((tech) => (
                  <div key={tech.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {tech.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{tech.name}</h3>
                        <p className="text-sm text-gray-500">{tech.orders} pedidos asignados</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${tech.revenue.toLocaleString('es-MX')}</div>
                      <div className="text-sm text-gray-500">{tech.completionRate}% completitud</div>
                      <Badge variant={parseFloat(tech.completionRate) >= 80 ? "default" : "secondary"}>
                        {tech.completed} completados
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento por Producto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {productPerformance.slice(0, 10).map((product) => (
                  <div key={product.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{product.name}</h3>
                        <p className="text-sm text-gray-500">{product.orders} pedidos</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${product.revenue.toLocaleString('es-MX')}</div>
                      <Badge variant={product.category === "service" ? "secondary" : "default"}>
                        {product.category === "service" ? "Servicio" : "Producto"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tendencias de Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={revenueTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="orders" fill="#3b82f6" name="Pedidos" />
                  <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Ingresos ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle>Exportar Reportes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" className="justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Reporte Excel
                </Button>
                <Button variant="outline" className="justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Reporte PDF
                </Button>
                <Button variant="outline" className="justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Datos CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
