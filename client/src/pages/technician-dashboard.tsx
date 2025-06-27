import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, User, Phone, MapPin, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  assignedTo: number | null;
  customer: {
    id: number;
    name: string;
    phone: string;
    address: string | null;
  };
  product: {
    id: number;
    name: string;
    type: string;
  };
};

type OrderWithDetails = Order & {
  customer: {
    id: number;
    name: string;
    phone: string;
    address: string | null;
  };
  product: {
    id: number;
    name: string;
    type: string;
  };
};

type TechnicianMetrics = {
  ordersToday: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  todayIncome: number;
};

type User = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

function StatusBadge({ status }: { status: string }) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Pendiente', variant: 'secondary' as const };
      case 'confirmed':
        return { label: 'Confirmado', variant: 'default' as const };
      case 'assigned':
        return { label: 'Asignado', variant: 'default' as const };
      case 'in_progress':
        return { label: 'En Progreso', variant: 'default' as const };
      case 'completed':
        return { label: 'Completado', variant: 'default' as const };
      case 'cancelled':
        return { label: 'Cancelado', variant: 'destructive' as const };
      default:
        return { label: status, variant: 'secondary' as const };
    }
  };

  const config = getStatusConfig(status);
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function TechnicianDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  // Fetch technician orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders/technician"],
  });

  // Fetch technician metrics
  const { data: technicianMetrics = {} as TechnicianMetrics } = useQuery<TechnicianMetrics>({
    queryKey: ["/api/dashboard/technician/metrics"],
  });

  // Update user status mutation
  const updateUserStatus = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PATCH", `/api/users/${user?.id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Estado actualizado",
        description: "Tu estado ha sido actualizado correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      });
    },
  });

  // Update order status mutation
  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      return apiRequest("PATCH", `/api/orders/${orderId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/technician"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/technician/metrics"] });
      toast({
        title: "Orden actualizada",
        description: "El estado de la orden ha sido actualizado",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la orden",
        variant: "destructive",
      });
    },
  });

  // Filter orders by status
  const pendingOrders = orders.filter(order => order.status === 'assigned' || order.status === 'pending');
  const inProgressOrders = orders.filter(order => order.status === 'in_progress');
  const completedOrders = orders.filter(order => order.status === 'completed');
  
  // Calculate completed today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedToday = completedOrders.filter(order => {
    const orderDate = new Date(order.updatedAt);
    orderDate.setHours(0, 0, 0, 0);
    return order.status === 'completed' && orderDate.getTime() === today.getTime();
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header móvil optimizado */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Panel de Técnico
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {user?.name}
            </p>
          </div>
          
          {/* Estado del técnico - Compacto para móvil */}
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 hidden sm:block">Estado:</div>
            <div className="flex gap-1">
              <Button
                variant={user?.status === 'active' ? 'default' : 'ghost'}
                size="sm"
                className="px-2 py-1 text-xs"
                onClick={() => updateUserStatus.mutate('active')}
                disabled={updateUserStatus.isPending}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Disponible</span>
              </Button>
              <Button
                variant={user?.status === 'busy' ? 'default' : 'ghost'}
                size="sm"
                className="px-2 py-1 text-xs"
                onClick={() => updateUserStatus.mutate('busy')}
                disabled={updateUserStatus.isPending}
              >
                <Clock className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Ocupado</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Métricas del técnico - Optimizadas para móvil */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="bg-white dark:bg-gray-800 shadow-sm border-0 rounded-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Pendientes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingOrders.length}</p>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 shadow-sm border-0 rounded-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">En Progreso</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{inProgressOrders.length}</p>
                </div>
                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 shadow-sm border-0 rounded-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Hoy</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedToday.length}</p>
                </div>
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 shadow-sm border-0 rounded-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Total</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedOrders.length}</p>
                </div>
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 shadow-sm border-0 rounded-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Ingresos</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">${technicianMetrics.todayIncome || 0}</p>
                </div>
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Órdenes de Trabajo */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm border-0 rounded-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Mis Órdenes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg m-4 mb-0">
                <TabsTrigger value="pending" className="text-sm font-medium">
                  Pendientes ({pendingOrders.length})
                </TabsTrigger>
                <TabsTrigger value="progress" className="text-sm font-medium">
                  En Progreso ({inProgressOrders.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="text-sm font-medium">
                  Historial ({completedOrders.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="p-4 space-y-3">
                {pendingOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No tienes órdenes pendientes</p>
                  </div>
                ) : (
                  pendingOrders.map((order) => (
                    <div key={order.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border-l-4 border-l-blue-500">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">#{order.orderNumber}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{order.product.name}</p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-gray-500" />
                          <span>{order.customer.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span>{order.customer.phone}</span>
                        </div>
                        {order.customer.address && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="truncate">{order.customer.address}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          className="flex-1"
                          onClick={() => updateOrderStatus.mutate({ orderId: order.id, status: 'in_progress' })}
                          disabled={updateOrderStatus.isPending}
                        >
                          Iniciar Trabajo
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="progress" className="p-4 space-y-3">
                {inProgressOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No tienes órdenes en progreso</p>
                  </div>
                ) : (
                  inProgressOrders.map((order) => (
                    <div key={order.id} className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border-l-4 border-l-orange-500">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">#{order.orderNumber}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{order.product.name}</p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-gray-500" />
                          <span>{order.customer.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span>{order.customer.phone}</span>
                        </div>
                        {order.customer.address && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="truncate">{order.customer.address}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          className="flex-1"
                          onClick={() => updateOrderStatus.mutate({ orderId: order.id, status: 'completed' })}
                          disabled={updateOrderStatus.isPending}
                        >
                          Completar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="completed" className="p-4 space-y-3">
                {completedOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Aún no has completado órdenes</p>
                  </div>
                ) : (
                  completedOrders.slice(0, 10).map((order) => (
                    <div key={order.id} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border-l-4 border-l-green-500">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">#{order.orderNumber}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{order.product.name}</p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-gray-500" />
                          <span>{order.customer.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Completado: {new Date(order.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}