import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle, AlertCircle, MapPin, Phone, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Order } from "@shared/schema";

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

function StatusBadge({ status }: { status: string }) {
  const variants = {
    'pending': 'secondary',
    'confirmed': 'default',
    'assigned': 'outline',
    'in_progress': 'default',
    'completed': 'default',
    'cancelled': 'destructive'
  } as const;

  const colors = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'confirmed': 'bg-blue-100 text-blue-800',
    'assigned': 'bg-purple-100 text-purple-800',
    'in_progress': 'bg-green-100 text-green-800',
    'completed': 'bg-gray-100 text-gray-800',
    'cancelled': 'bg-red-100 text-red-800'
  };

  return (
    <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  );
}

export default function TechnicianDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);

  // Obtener órdenes asignadas al técnico
  const { data: orders = [], isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ['/api/technician/orders'],
    enabled: !!user?.id,
  });

  // Mutation para actualizar estado de orden
  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      return apiRequest('PATCH', `/api/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders/technician'] });
      setSelectedOrder(null);
    },
  });

  // Mutation para actualizar estado del técnico
  const updateUserStatus = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest('PATCH', `/api/users/${user?.id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const myOrders = orders.filter(order => order.assignedTo === user?.id);
  const pendingOrders = myOrders.filter(order => order.status === 'assigned');
  const inProgressOrders = myOrders.filter(order => order.status === 'in_progress');
  const completedToday = myOrders.filter(order => 
    order.status === 'completed' && 
    new Date(order.updatedAt).toDateString() === new Date().toDateString()
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Panel de Técnico
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Bienvenido, {user?.name}
          </p>
        </div>
        
        <div className="flex gap-2 mt-4 md:mt-0">
          <Button
            variant={user?.status === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateUserStatus.mutate('active')}
            disabled={updateUserStatus.isPending}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Disponible
          </Button>
          <Button
            variant={user?.status === 'busy' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateUserStatus.mutate('busy')}
            disabled={updateUserStatus.isPending}
          >
            <Clock className="w-4 h-4 mr-2" />
            Ocupado
          </Button>
          <Button
            variant={user?.status === 'break' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateUserStatus.mutate('break')}
            disabled={updateUserStatus.isPending}
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            En Descanso
          </Button>
        </div>
      </div>

      {/* Estadísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders.length}</div>
            <p className="text-xs text-muted-foreground">
              Asignadas a ti
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressOrders.length}</div>
            <p className="text-xs text-muted-foreground">
              Trabajos activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas Hoy</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedToday.length}</div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Órdenes de Trabajo */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">Pendientes ({pendingOrders.length})</TabsTrigger>
          <TabsTrigger value="progress">En Progreso ({inProgressOrders.length})</TabsTrigger>
          <TabsTrigger value="completed">Completadas ({completedToday.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <div className="grid gap-4">
            {pendingOrders.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-500">No tienes órdenes pendientes</p>
                </CardContent>
              </Card>
            ) : (
              pendingOrders.map((order) => (
                <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">#{order.orderNumber}</CardTitle>
                        <CardDescription>{order.product.name}</CardDescription>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{order.customer.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{order.customer.phone}</span>
                      </div>
                      {order.customer.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">{order.customer.address}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">
                          Creado: {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button 
                        size="sm"
                        onClick={() => updateOrderStatus.mutate({ orderId: order.id, status: 'in_progress' })}
                        disabled={updateOrderStatus.isPending}
                      >
                        Iniciar Trabajo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
          <div className="grid gap-4">
            {inProgressOrders.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-500">No tienes trabajos en progreso</p>
                </CardContent>
              </Card>
            ) : (
              inProgressOrders.map((order) => (
                <Card key={order.id} className="border-l-4 border-l-green-500">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">#{order.orderNumber}</CardTitle>
                        <CardDescription>{order.product.name}</CardDescription>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{order.customer.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{order.customer.phone}</span>
                      </div>
                      {order.customer.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">{order.customer.address}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => updateOrderStatus.mutate({ orderId: order.id, status: 'completed' })}
                        disabled={updateOrderStatus.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Marcar Completado
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <div className="grid gap-4">
            {completedToday.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-500">No has completado trabajos hoy</p>
                </CardContent>
              </Card>
            ) : (
              completedToday.map((order) => (
                <Card key={order.id} className="border-l-4 border-l-gray-500">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">#{order.orderNumber}</CardTitle>
                        <CardDescription>{order.product.name}</CardDescription>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{order.customer.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm">
                          Completado: {new Date(order.updatedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}