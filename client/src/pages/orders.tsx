import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Search, Edit, Trash2, Eye, UserCheck, Clock, CheckCircle, XCircle, Package, MapPin } from "lucide-react";
import type { User } from "@shared/schema";
import AssignmentModal from "@/components/orders/assignment-modal";

type OrderWithDetails = {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: string;
  notes: string | null;
  description: string | null;
  priority: string;
  createdAt: string;
  updatedAt: string;
  assignedUserId: number | null;
  customer: {
    id: number;
    name: string;
    phone: string;
    address: string | null;
  };
  items: Array<{
    id: number;
    orderId: number;
    productId: number;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    installationCost: string;
    partsCost: string;
    laborHours: string;
    laborRate: string;
    deliveryCost: string;
    deliveryDistance: string;
    notes: string | null;
    product: {
      id: number;
      name: string;
      description: string;
      price: string;
      category: string;
      status: string;
    };
  }>;
};

export default function OrdersPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  // Fetch users for assignment
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Effect to handle URL parameters from dashboard
  useEffect(() => {
    const params = new URLSearchParams(search);
    const viewId = params.get('view');
    const editId = params.get('edit');
    const assignId = params.get('assign');

    if (orders.length > 0) {
      if (viewId) {
        const order = orders.find(o => o.id === parseInt(viewId));
        if (order) {
          setSelectedOrder(order);
          setIsViewDialogOpen(true);
          // Clear URL parameter
          setLocation('/orders');
        }
      } else if (editId) {
        const order = orders.find(o => o.id === parseInt(editId));
        if (order) {
          setSelectedOrder(order);
          setIsEditDialogOpen(true);
          // Clear URL parameter
          setLocation('/orders');
        }
      } else if (assignId) {
        const order = orders.find(o => o.id === parseInt(assignId));
        if (order) {
          setSelectedOrder(order);
          setIsAssignDialogOpen(true);
          // Clear URL parameter
          setLocation('/orders');
        }
      }
    }
  }, [orders, search, setLocation]);

  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<OrderWithDetails>) => {
      return apiRequest("PATCH", `/api/orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsEditDialogOpen(false);
      setSelectedOrder(null);
      toast({
        title: "Orden actualizada",
        description: "Los cambios se han guardado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la orden.",
        variant: "destructive",
      });
      console.error("Error updating order:", error);
    },
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Orden eliminada",
        description: "La orden se ha eliminado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la orden.",
        variant: "destructive",
      });
      console.error("Error deleting order:", error);
    },
  });

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.phone?.includes(searchTerm);
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      "pending": { variant: "secondary" as const, text: "Pendiente", icon: Clock },
      "confirmed": { variant: "default" as const, text: "Confirmado", icon: CheckCircle },
      "in_progress": { variant: "default" as const, text: "En Progreso", icon: Package },
      "completed": { variant: "default" as const, text: "Completado", icon: CheckCircle },
      "cancelled": { variant: "destructive" as const, text: "Cancelado", icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(numAmount);
  };

  const handleEditOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setIsEditDialogOpen(true);
  };

  const handleViewOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setIsViewDialogOpen(true);
  };

  const handleAssignOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setIsAssignDialogOpen(true);
  };

  const handleCloseAssignModal = () => {
    setIsAssignDialogOpen(false);
    setSelectedOrder(null);
  };

  const handleUpdateOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const formData = new FormData(e.currentTarget);
    const assignedUserIdValue = formData.get("assignedUserId") as string;
    const updates = {
      id: selectedOrder.id,
      status: formData.get("status") as string,
      assignedUserId: assignedUserIdValue === "0" ? null : Number(assignedUserIdValue),
      notes: formData.get("notes") as string,
    };

    updateOrderMutation.mutate(updates);
  };

  const assignedUser = (userId: number | null) => {
    if (!userId) return "Sin asignar";
    const user = users.find(u => u.id === userId);
    return user ? user.name : "Usuario no encontrado";
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Calculate statistics by status
  const orderStats = {
    total: orders.length,
    pending: orders.filter(order => order.status === 'pending').length,
    confirmed: orders.filter(order => order.status === 'confirmed').length,
    assigned: orders.filter(order => order.status === 'assigned').length,
    in_progress: orders.filter(order => order.status === 'in_progress').length,
    completed: orders.filter(order => order.status === 'completed').length,
    cancelled: orders.filter(order => order.status === 'cancelled').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Órdenes</h1>
          <p className="text-muted-foreground">
            Administra todas las órdenes y pedidos del sistema
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total</p>
                <p className="text-2xl font-bold text-blue-800">{orderStats.total}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-800">{orderStats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Confirmados</p>
                <p className="text-2xl font-bold text-purple-800">{orderStats.confirmed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Asignados</p>
                <p className="text-2xl font-bold text-orange-800">{orderStats.assigned}</p>
              </div>
              <UserCheck className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-600">En Progreso</p>
                <p className="text-2xl font-bold text-indigo-800">{orderStats.in_progress}</p>
              </div>
              <Clock className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Completados</p>
                <p className="text-2xl font-bold text-green-800">{orderStats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Cancelados</p>
                <p className="text-2xl font-bold text-red-800">{orderStats.cancelled}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número de orden, cliente o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="in_progress">En Progreso</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No se encontraron órdenes</h3>
              <p className="text-muted-foreground text-center">
                {searchTerm || statusFilter !== "all"
                  ? "Intenta ajustar los filtros de búsqueda"
                  : "Aún no hay órdenes en el sistema"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{order.orderNumber}</h3>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4" />
                        <span>{order.customer?.name || "Cliente no especificado"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>📞</span>
                        <span>{order.customer?.phone || "Teléfono no disponible"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{order.customer?.address || order.description || "Dirección no especificada"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>👷</span>
                        <span>{assignedUser(order.assignedUserId)}</span>
                      </div>
                    </div>
                    
                    {/* Products/Services Section */}
                    {order.items && order.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Productos/Servicios:
                        </h4>
                        <div className="space-y-1">
                          {order.items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-blue-500" />
                                <span className="font-medium">{item.product.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {item.product.category === 'product' ? 'Producto' : 'Servicio'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span>Cant: {item.quantity}</span>
                                <span>•</span>
                                <span>{formatCurrency(item.unitPrice)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(order.totalAmount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.createdAt || '').toLocaleDateString('es-MX')}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewOrder(order);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditOrder(order);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteOrderMutation.mutate(order.id);
                        }}
                        disabled={deleteOrderMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Order Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdateOrder}>
            <DialogHeader>
              <DialogTitle>Editar Orden</DialogTitle>
              <DialogDescription>
                Modifica los detalles de la orden {selectedOrder?.orderNumber}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="status">Estado</Label>
                <Select name="status" defaultValue={selectedOrder?.status}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="in_progress">En Progreso</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="assignedUserId">Asignar a</Label>
                <Select name="assignedUserId" defaultValue={selectedOrder?.assignedUserId?.toString() || "0"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar técnico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sin asignar</SelectItem>
                    {users.filter(user => user.role === 'technician' || user.role === 'admin').map(user => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  name="notes"
                  placeholder="Notas adicionales..."
                  defaultValue={selectedOrder?.notes || ""}
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateOrderMutation.isPending}>
                {updateOrderMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Detalles de la Orden {selectedOrder?.orderNumber}
            </DialogTitle>
            <DialogDescription>
              Información completa de la orden incluyendo productos, servicios y costos
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                  <p className="text-sm">{selectedOrder.customer?.name || "No especificado"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Teléfono</Label>
                  <p className="text-sm">{selectedOrder.customer?.phone || "No disponible"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Estado</Label>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Total</Label>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(selectedOrder.totalAmount)}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">Dirección de Entrega</Label>
                  <p className="text-sm">{selectedOrder.customer?.address || selectedOrder.description || "No especificada"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Asignado a</Label>
                  <p className="text-sm">{assignedUser(selectedOrder.assignedUserId)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Fecha de Creación</Label>
                  <p className="text-sm">{new Date(selectedOrder.createdAt || '').toLocaleString('es-MX')}</p>
                </div>
                {selectedOrder.notes && (
                  <div className="col-span-2">
                    <Label className="text-sm font-medium text-muted-foreground">Notas</Label>
                    <p className="text-sm bg-gray-50 p-3 rounded-md mt-1">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>
              
              {/* Products/Services Section */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="mt-6">
                  <Label className="text-sm font-medium text-muted-foreground">Productos/Servicios</Label>
                  <div className="mt-3 space-y-3">
                    {selectedOrder.items.map((item, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-blue-500" />
                            <span className="font-medium">{item.product.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {item.product.category === 'product' ? 'Producto' : 'Servicio'}
                            </Badge>
                          </div>
                          <div className="text-sm font-medium text-green-600">
                            {formatCurrency(item.totalPrice)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div>Cantidad: {item.quantity}</div>
                          <div>Precio unitario: {formatCurrency(item.unitPrice)}</div>
                          {item.deliveryCost !== "0.00" && (
                            <>
                              <div>Costo de entrega: {formatCurrency(item.deliveryCost)}</div>
                              <div>Distancia: {item.deliveryDistance} km</div>
                            </>
                          )}
                        </div>
                        {item.product.description && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {item.product.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={() => {
              setIsViewDialogOpen(false);
              if (selectedOrder) handleEditOrder(selectedOrder);
            }}>
              Editar
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Assignment Modal */}
    <AssignmentModal 
      order={selectedOrder}
      isOpen={isAssignDialogOpen}
      onClose={handleCloseAssignModal}
    />

    </div>
  );
}