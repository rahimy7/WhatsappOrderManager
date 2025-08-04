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
import { Plus, Search, Edit, Trash2, Eye, UserCheck, Clock, CheckCircle, XCircle, Package, MapPin, Phone, User as UserIcon } from "lucide-react";
import type { User } from "@shared/schema";
import AssignmentModal from "@/components/orders/assignment-modal";

type OrderWithDetails = {
  id: number;
  orderNumber: string;
  customerId: number;
  assignedUserId: number | null;
  status: string;
  priority: string; // ✅ Agregado para coherencia
  totalAmount: string;
  deliveryCost: string; // ✅ Agregado
  deliveryAddress?: string | null; // ✅ Agregado
  contactNumber?: string | null; // ✅ Agregado
  estimatedDelivery?: string | null; // ✅ Agregado
  estimatedDeliveryTime?: string | null; // ✅ Agregado
  paymentMethod?: string | null; // ✅ Agregado
  paymentStatus?: string; // ✅ Agregado
  notes: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  lastStatusUpdate?: string | null; // ✅ Agregado
  customerLastInteraction?: string | null; // ✅ Agregado
  modificationCount?: number; // ✅ Agregado
  storeId: number; // ✅ Agregado
  
  // ✅ Información expandida del cliente (coherente con backend)
  customer: {
    longitude: any;
   
    latitude: any;
    id: number;
    name: string;
    phone: string;
    email?: string | null; // ✅ Agregado
    address: string | null;
  };
  
  // ✅ Usuario asignado expandido (coherente con backend)
  assignedUser?: {
    id: number;
    name: string;
    role: string;
  } | null;
  
  // ✅ Items de la orden
  items: Array<{
    id: number;
    orderId: number;
    productId: number;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    installationCost?: string; // ✅ Opcional
    partsCost?: string; // ✅ Opcional
    laborHours?: string; // ✅ Opcional
    laborRate?: string; // ✅ Opcional
    deliveryCost?: string; // ✅ Opcional
    deliveryDistance?: string; // ✅ Opcional
    notes: string | null;
    product: {
      id: number;
      name: string;
      description?: string; // ✅ Opcional
      price: string;
      category?: string; // ✅ Opcional
      status?: string; // ✅ Opcional
    };
  }>;
  
  // ✅ Información adicional del backend
  totalItems?: number; // ✅ Agregado para mostrar conteo
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
    return apiRequest("PUT", `/api/orders/${id}`, data); // ✅ Cambiar a PUT
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

const assignOrderMutation = useMutation({
  mutationFn: async ({ orderId, userId }: { orderId: number; userId: number | null }) => {
    return apiRequest("PUT", `/api/orders/${orderId}`, { 
      assignedUserId: userId,
      lastStatusUpdate: new Date().toISOString()
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    setIsAssignDialogOpen(false);
    setSelectedOrder(null);
    toast({
      title: "Orden asignada",
      description: "La orden ha sido asignada exitosamente.",
    });
  },
  onError: (error) => {
    toast({
      title: "Error",
      description: "No se pudo asignar la orden.",
      variant: "destructive",
    });
    console.error("Error assigning order:", error);
  },
});

const handleAssignOrder = (userId: number | null) => {
  if (selectedOrder) {
    assignOrderMutation.mutate({ 
      orderId: selectedOrder.id, 
      userId 
    });
  }
};

const handleCloseAssignModal = (assigned: boolean = false) => {
  setIsAssignDialogOpen(false);
  setSelectedOrder(null);
  
  if (assigned) {
    // Refrescar datos si se realizó una asignación
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
  }
};

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



const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; variant: any; color: string }> = {
    pending: { 
      label: 'Pendiente', 
      variant: 'default',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    },
    confirmed: { 
      label: 'Confirmado', 
      variant: 'default',
      color: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    assigned: { 
      label: 'Asignado', 
      variant: 'default',
      color: 'bg-purple-100 text-purple-800 border-purple-200'
    },
    preparing: { 
      label: 'Preparando', 
      variant: 'default',
      color: 'bg-orange-100 text-orange-800 border-orange-200'
    },
    ready: { 
      label: 'Listo', 
      variant: 'default',
      color: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    },
    in_transit: { 
      label: 'En Tránsito', 
      variant: 'default',
      color: 'bg-cyan-100 text-cyan-800 border-cyan-200'
    },
    delivered: { 
      label: 'Entregado', 
      variant: 'default',
      color: 'bg-green-100 text-green-800 border-green-200'
    },
    completed: { 
      label: 'Completado', 
      variant: 'default',
      color: 'bg-green-100 text-green-800 border-green-200'
    },
    cancelled: { 
      label: 'Cancelado', 
      variant: 'destructive',
      color: 'bg-red-100 text-red-800 border-red-200'
    },
    returned: { 
      label: 'Devuelto', 
      variant: 'secondary',
      color: 'bg-gray-100 text-gray-800 border-gray-200'
    }
  };
  
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <Badge variant={config.variant} className={config.color}>
      {config.label}
    </Badge>
  );
};

const getPriorityBadge = (priority: string) => {
  const priorityConfig: Record<string, { label: string; color: string }> = {
    low: { label: 'Baja', color: 'bg-gray-100 text-gray-600' },
    normal: { label: 'Normal', color: 'bg-blue-100 text-blue-600' },
    high: { label: 'Alta', color: 'bg-orange-100 text-orange-600' },
    urgent: { label: 'Urgente', color: 'bg-red-100 text-red-600' }
  };
  
  const config = priorityConfig[priority] || priorityConfig.normal;
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  );
};

const filteredOrders = orders.filter((order) => {
  const matchesSearch = 
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer?.phone.includes(searchTerm) ||
    (order.deliveryAddress && order.deliveryAddress.toLowerCase().includes(searchTerm.toLowerCase()));
  
  const matchesStatus = statusFilter === "all" || order.status === statusFilter;
  
  return matchesSearch && matchesStatus;
});

// ✅ FUNCIÓN NUEVA: Estadísticas de órdenes más detalladas
const orderStats = {
  total: orders.length,
  pending: orders.filter(order => order.status === 'pending').length,
  confirmed: orders.filter(order => order.status === 'confirmed').length,
  assigned: orders.filter(order => order.status === 'assigned').length,
  in_progress: orders.filter(order => order.status === 'in_progress').length,
  completed: orders.filter(order => order.status === 'completed').length,
  cancelled: orders.filter(order => order.status === 'cancelled').length,
  // ✅ Estadísticas adicionales
  unassigned: orders.filter(order => !order.assignedUserId).length,
  highPriority: orders.filter(order => ['high', 'urgent'].includes(order.priority)).length,
  recentOrders: orders.filter(order => {
    const orderDate = new Date(order.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
    return daysDiff <= 1; // Órdenes del último día
  }).length
};

// ✅ FUNCIÓN HELPER: Formatear moneda
const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('es-MX', { 
    style: 'currency', 
    currency: 'MXN' 
  }).format(num);
};

// ✅ FUNCIÓN HELPER: Formatear fecha relativa
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Ahora';
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
  if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d`;
  
  return date.toLocaleDateString('es-MX');
};

// ✅ FUNCIÓN HELPER: Obtener color de prioridad
const getPriorityColor = (priority: string) => {
  const colors = {
    low: 'text-gray-500',
    normal: 'text-blue-500',
    high: 'text-orange-500',
    urgent: 'text-red-500'
  };
  return colors[priority as keyof typeof colors] || colors.normal;
};

  // Function to generate Google Maps link from address or coordinates
  const generateGoogleMapsLink = (address: string, latitude?: string, longitude?: string): string => {
    if (latitude && longitude) {
      // Use coordinates for more precise location
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const query = address ? encodeURIComponent(address) : `${lat},${lng}`;
      return `https://www.google.com/maps/@${lat},${lng},15z?q=${query}`;
    } else if (address) {
      // Use address only
      return `https://www.google.com/maps/search/${encodeURIComponent(address)}`;
    }
    return '';
  };



  const handleViewOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setIsViewDialogOpen(true);
  };

const handleUpdateOrder = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (!selectedOrder) return;

  const formData = new FormData(e.currentTarget);
  
  // ✅ Construir objeto de actualización coherente con backend
  const updates = {
    status: formData.get("status") as string,
    priority: formData.get("priority") as string,
    notes: formData.get("notes") as string,
    description: formData.get("description") as string,
    deliveryAddress: formData.get("deliveryAddress") as string,
    contactNumber: formData.get("contactNumber") as string,
    paymentMethod: formData.get("paymentMethod") as string,
    paymentStatus: formData.get("paymentStatus") as string,
    // ✅ Agregar timestamp de actualización
    lastStatusUpdate: new Date().toISOString()
  };

  // ✅ Filtrar campos vacíos para evitar sobrescribir con null
  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, value]) => value !== null && value !== "")
  );

  updateOrderMutation.mutate({ 
    id: selectedOrder.id, 
    ...filteredUpdates 
  });
};

// ✅ FUNCIÓN MEJORADA: handleEditOrder
const handleEditOrder = (order: OrderWithDetails) => {
  setSelectedOrder(order);
  setIsEditDialogOpen(true);
};

// ✅ FUNCIÓN MEJORADA: handleAssignOrder (para el botón de asignación rápida)
const handleQuickAssign = (order: OrderWithDetails) => {
  setSelectedOrder(order);
  setIsAssignDialogOpen(true);
};

// ✅ FUNCIÓN NUEVA: handleAutoAssign (para asignación automática)
const autoAssignMutation = useMutation({
  mutationFn: (orderId: number) => apiRequest("POST", `/api/orders/${orderId}/auto-assign`),
  onSuccess: (data: any) => {
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    toast({
      title: "Asignación automática exitosa",
      description: data.message || "La orden ha sido asignada automáticamente.",
    });
  },
  onError: (error: any) => {
    toast({
      title: "Error en asignación automática",
      description: error.message || "No se pudo asignar la orden automáticamente.",
      variant: "destructive",
    });
  },
});

const handleAutoAssign = (orderId: number) => {
  autoAssignMutation.mutate(orderId);
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
   // client/src/pages/orders.tsx - Formulario de edición mejorado para el Dialog

{/* ✅ EDIT ORDER DIALOG MEJORADO */}
<Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
  <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
    <form onSubmit={handleUpdateOrder}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Edit className="w-5 h-5" />
          Editar Orden #{selectedOrder?.orderNumber}
        </DialogTitle>
        <DialogDescription>
          Modifica los detalles de la orden. Los campos marcados con * son obligatorios.
        </DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-6 py-6">
        {/* Información básica */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status">Estado *</Label>
            <Select name="status" defaultValue={selectedOrder?.status}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="assigned">Asignado</SelectItem>
                <SelectItem value="preparing">Preparando</SelectItem>
                <SelectItem value="ready">Listo</SelectItem>
                <SelectItem value="in_transit">En Tránsito</SelectItem>
                <SelectItem value="delivered">Entregado</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="returned">Devuelto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Prioridad *</Label>
            <Select name="priority" defaultValue={selectedOrder?.priority || 'normal'}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Información de contacto y entrega */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contactNumber">Número de Contacto</Label>
            <Input
              name="contactNumber"
              type="tel"
              placeholder="Ej: +1234567890"
              defaultValue={selectedOrder?.contactNumber || selectedOrder?.customer?.phone || ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliveryAddress">Dirección de Entrega</Label>
            <Input
              name="deliveryAddress"
              placeholder="Dirección completa"
              defaultValue={selectedOrder?.deliveryAddress || selectedOrder?.customer?.address || ''}
            />
          </div>
        </div>

        {/* Información de pago */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Método de Pago</Label>
            <Select name="paymentMethod" defaultValue={selectedOrder?.paymentMethod || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin especificar</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta de Crédito/Débito</SelectItem>
                <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                <SelectItem value="check">Cheque</SelectItem>
                <SelectItem value="financing">Financiamiento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentStatus">Estado del Pago</Label>
            <Select name="paymentStatus" defaultValue={selectedOrder?.paymentStatus || 'pending'}>
              <SelectTrigger>
                <SelectValue placeholder="Estado del pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="processing">Procesando</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="failed">Fallido</SelectItem>
                <SelectItem value="refunded">Reembolsado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Descripción y notas */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              name="description"
              placeholder="Descripción general de la orden..."
              rows={3}
              defaultValue={selectedOrder?.description || ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Internas</Label>
            <Textarea
              name="notes"
              placeholder="Notas internas para el equipo..."
              rows={3}
              defaultValue={selectedOrder?.notes || ''}
            />
          </div>
        </div>

        {/* Información del cliente (solo lectura) */}
        {selectedOrder?.customer && (
          <Card className="bg-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{selectedOrder.customer.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500" />
                <span>{selectedOrder.customer.phone}</span>
              </div>
              {selectedOrder.customer.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">{selectedOrder.customer.address}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Información de items (solo lectura) */}
        {selectedOrder?.items && selectedOrder.items.length > 0 && (
          <Card className="bg-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4" />
                Items de la Orden ({selectedOrder.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedOrder.items.slice(0, 3).map((item, index) => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div>
                      <p className="font-medium text-sm">{item.product.name}</p>
                      <p className="text-xs text-gray-500">
                        Cantidad: {item.quantity} | Precio: {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">
                        {formatCurrency(item.totalPrice)}
                      </p>
                    </div>
                  </div>
                ))}
                {selectedOrder.items.length > 3 && (
                  <p className="text-sm text-gray-500 text-center">
                    ... y {selectedOrder.items.length - 3} items más
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      <DialogFooter className="gap-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setIsEditDialogOpen(false)}
          disabled={updateOrderMutation.isPending}
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={updateOrderMutation.isPending}
        >
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
                  {(() => {
                    const address = selectedOrder.customer?.address || selectedOrder.description || "No especificada";
                    const latitude = selectedOrder.customer?.latitude;
                    const longitude = selectedOrder.customer?.longitude;
                    const mapLink = generateGoogleMapsLink(address, latitude, longitude);
                    
                    if (mapLink && address !== "No especificada") {
                      return (
                        <div className="flex items-center gap-2">
                          <a 
                            href={mapLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                          >
                            <MapPin className="h-4 w-4" />
                            {address}
                          </a>
                        </div>
                      );
                    } else {
                      return <p className="text-sm">{address}</p>;
                    }
                  })()}
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