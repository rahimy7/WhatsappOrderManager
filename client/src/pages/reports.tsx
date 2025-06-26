import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, Calendar, DollarSign } from "lucide-react";

export default function Reports() {
  const { data: orders } = useQuery({
    queryKey: ["/api/orders"],
  });

  const { data: metrics } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
  });

  // Calculate report data
  const totalOrders = orders?.length || 0;
  const completedOrders = orders?.filter((order: any) => order.status === "completed").length || 0;
  const totalRevenue = orders?.reduce((sum: number, order: any) => 
    order.status === "completed" ? sum + parseFloat(order.totalAmount) : sum, 0) || 0;
  
  const completionRate = totalOrders > 0 ? (completedOrders / totalOrders * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <Header 
        title="Reportes y Análisis"
        subtitle="Monitorea el rendimiento de tu negocio"
      />

      {/* Report Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Pedidos Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-sm text-gray-500 mt-1">Todos los tiempos</p>
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
            <p className="text-sm text-gray-500 mt-1">MXN</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Ingresos Hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.dailyRevenue?.toLocaleString('es-MX') || "0"}</div>
            <p className="text-sm text-green-600 mt-1">+8.5% vs ayer</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Exportar Reportes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Reporte de Pedidos (Excel)
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Reporte de Ingresos (PDF)
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Reporte de Equipo (CSV)
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Conversaciones WhatsApp (JSON)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estadísticas por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {["pending", "assigned", "in_progress", "completed", "cancelled"].map((status) => {
                const count = orders?.filter((order: any) => order.status === status).length || 0;
                const percentage = totalOrders > 0 ? (count / totalOrders * 100).toFixed(1) : "0";
                
                const statusLabels: Record<string, string> = {
                  pending: "Pendiente",
                  assigned: "Asignado", 
                  in_progress: "En Proceso",
                  completed: "Completado",
                  cancelled: "Cancelado"
                };

                const statusColors: Record<string, string> = {
                  pending: "bg-red-100 text-red-800",
                  assigned: "bg-blue-100 text-blue-800",
                  in_progress: "bg-yellow-100 text-yellow-800", 
                  completed: "bg-green-100 text-green-800",
                  cancelled: "bg-gray-100 text-gray-800"
                };

                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status]}`}>
                        {statusLabels[status]}
                      </span>
                      <span className="text-sm text-gray-600">{count} pedidos</span>
                    </div>
                    <span className="text-sm font-medium">{percentage}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
