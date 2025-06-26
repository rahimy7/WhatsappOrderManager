import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { OrderWithDetails, User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, User as UserIcon, Package, Clock, DollarSign, Eye } from "lucide-react";
import CreateOrderModal from "@/components/orders/create-order-modal";
import OrderDetailModal from "@/components/orders/order-detail-modal";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Orders() {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const { data: orders = [], isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const assignOrderMutation = useMutation({
    mutationFn: async ({ orderId, userId }: { orderId: number; userId: number }) => {
      return apiRequest("POST", `/api/orders/${orderId}/assign`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Pedido asignado",
        description: "El pedido ha sido asignado correctamente",
      });
    },
  });

  const handleAssignOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order);
  };

  const handleViewOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-red-100 text-red-800",
      assigned: "bg-blue-100 text-blue-800",
      in_progress: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-gray-100 text-gray-800",
    };
    return colors[status] || colors.pending;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendiente",
      assigned: "Asignado",
      in_progress: "En Proceso",
      completed: "Completado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const calculateOrderTotal = (order: OrderWithDetails) => {
    let total = 0;
    order.items.forEach(item => {
      const basePrice = parseFloat(item.unitPrice) * item.quantity;
      const installationCost = parseFloat(item.installationCost || "0");
      const partsCost = parseFloat(item.partsCost || "0");
      const laborCost = parseFloat(item.laborHours || "0") * parseFloat(item.laborRate || "0");
      total += basePrice + installationCost + partsCost + laborCost;
    });
    return total;
  };

  const technicians = users.filter(user => user.role === "technician" && user.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Pedidos</h1>
        <Button onClick={() => setIsCreateModalOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Pedido
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="block lg:hidden space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{order.orderNumber}</h3>
                      <p className="text-sm text-gray-600">{order.customer.name}</p>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Package className="h-4 w-4 mr-2" />
                      {order.items.length} {order.items.length === 1 ? "producto" : "productos"}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <DollarSign className="h-4 w-4 mr-2" />
                      ${calculateOrderTotal(order).toLocaleString('es-MX')}
                    </div>
                    {order.assignedUser && (
                      <div className="flex items-center text-sm text-gray-600">
                        <UserIcon className="h-4 w-4 mr-2" />
                        {order.assignedUser.name}
                      </div>
                    )}
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2" />
                      {new Date(order.createdAt).toLocaleDateString('es-MX')}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewOrder(order)}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    {order.status === "pending" && (
                      <Select
                        onValueChange={(userId) => 
                          assignOrderMutation.mutate({ 
                            orderId: order.id, 
                            userId: parseInt(userId) 
                          })
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          {technicians.map((tech) => (
                            <SelectItem key={tech.id} value={tech.id.toString()}>
                              {tech.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4">Pedido</th>
                        <th className="text-left p-4">Cliente</th>
                        <th className="text-left p-4">Estado</th>
                        <th className="text-left p-4">Productos</th>
                        <th className="text-left p-4">Total</th>
                        <th className="text-left p-4">Técnico</th>
                        <th className="text-left p-4">Fecha</th>
                        <th className="text-left p-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-gray-50">
                          <td className="p-4 font-medium">{order.orderNumber}</td>
                          <td className="p-4">{order.customer.name}</td>
                          <td className="p-4">
                            <Badge className={getStatusColor(order.status)}>
                              {getStatusLabel(order.status)}
                            </Badge>
                          </td>
                          <td className="p-4">{order.items.length}</td>
                          <td className="p-4 font-medium">
                            ${calculateOrderTotal(order).toLocaleString('es-MX')}
                          </td>
                          <td className="p-4">
                            {order.assignedUser ? order.assignedUser.name : "Sin asignar"}
                          </td>
                          <td className="p-4">
                            {new Date(order.createdAt).toLocaleDateString('es-MX')}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewOrder(order)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {order.status === "pending" && (
                                <Select
                                  onValueChange={(userId) => 
                                    assignOrderMutation.mutate({ 
                                      orderId: order.id, 
                                      userId: parseInt(userId) 
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue placeholder="Asignar" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {technicians.map((tech) => (
                                      <SelectItem key={tech.id} value={tech.id.toString()}>
                                        {tech.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <CreateOrderModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <OrderDetailModal 
        order={selectedOrder}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}
