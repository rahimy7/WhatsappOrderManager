import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Clock, 
  User, 
  Package, 
  DollarSign, 
  MapPin, 
  Phone, 
  MessageCircle,
  CheckCircle,
  XCircle,
  Play,
  Pause
} from "lucide-react";
import { OrderWithDetails, OrderHistory } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface OrderDetailModalProps {
  order: OrderWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function OrderDetailModal({ order, isOpen, onClose }: OrderDetailModalProps) {
  const [newStatus, setNewStatus] = useState<string>("");
  const [statusNotes, setStatusNotes] = useState("");
  const { toast } = useToast();

  const { data: orderHistory = [] } = useQuery<OrderHistory[]>({
    queryKey: ["/api/orders", order?.id, "history"],
    enabled: !!order?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, notes }: { orderId: number; status: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/orders/${orderId}/status`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order?.id, "history"] });
      toast({
        title: "Estado actualizado",
        description: "El estado del pedido ha sido actualizado correctamente",
      });
      setStatusNotes("");
    },
  });

  useEffect(() => {
    if (order) {
      setNewStatus(order.status);
    }
  }, [order]);

  if (!order) return null;

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

  const getActionIcon = (action: string) => {
    const icons: Record<string, any> = {
      created: Clock,
      assigned: User,
      started: Play,
      completed: CheckCircle,
      cancelled: XCircle,
      updated: Package,
    };
    return icons[action] || Clock;
  };

  const handleStatusUpdate = () => {
    if (newStatus !== order.status && order.id) {
      updateStatusMutation.mutate({
        orderId: order.id,
        status: newStatus,
        notes: statusNotes || undefined,
      });
    }
  };

  const calculateTotalCost = () => {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalle del Pedido - {order.orderNumber}</span>
            <Badge className={getStatusColor(order.status)}>
              {getStatusLabel(order.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Información del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium">{order.customer.name}</p>
                    <p className="text-sm text-gray-500 flex items-center mt-1">
                      <Phone className="h-4 w-4 mr-1" />
                      {order.customer.phone}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      <MessageCircle className="h-4 w-4 mr-1" />
                      WhatsApp
                    </Button>
                    <Button size="sm" variant="outline">
                      <Phone className="h-4 w-4 mr-1" />
                      Llamar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Items with Service Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Servicios y Productos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item, index) => {
                    const basePrice = parseFloat(item.unitPrice) * item.quantity;
                    const installationCost = parseFloat(item.installationCost || "0");
                    const partsCost = parseFloat(item.partsCost || "0");
                    const laborCost = parseFloat(item.laborHours || "0") * parseFloat(item.laborRate || "0");
                    const itemTotal = basePrice + installationCost + partsCost + laborCost;

                    return (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium">{item.product.name}</h4>
                            <p className="text-sm text-gray-500">Cantidad: {item.quantity}</p>
                            {item.product.category === "service" && (
                              <Badge variant="secondary" className="mt-1">Servicio</Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">${itemTotal.toLocaleString('es-MX')}</p>
                          </div>
                        </div>

                        {item.product.category === "service" && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-gray-50 p-3 rounded">
                            <div>
                              <p className="text-gray-600">Precio Base</p>
                              <p className="font-medium">${basePrice.toLocaleString('es-MX')}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Instalación</p>
                              <p className="font-medium">${installationCost.toLocaleString('es-MX')}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Piezas</p>
                              <p className="font-medium">${partsCost.toLocaleString('es-MX')}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Mano de Obra</p>
                              <p className="font-medium">${laborCost.toLocaleString('es-MX')}</p>
                              <p className="text-xs text-gray-500">
                                {item.laborHours}h × ${item.laborRate}/h
                              </p>
                            </div>
                          </div>
                        )}

                        {item.notes && (
                          <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                            <p className="text-blue-800">{item.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total del Pedido</span>
                    <span className="text-2xl font-bold text-green-600">
                      ${calculateTotalCost().toLocaleString('es-MX')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Description and Notes */}
            {(order.description || order.notes) && (
              <Card>
                <CardHeader>
                  <CardTitle>Detalles Adicionales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.description && (
                    <div>
                      <p className="font-medium text-sm text-gray-600">Descripción</p>
                      <p className="text-sm">{order.description}</p>
                    </div>
                  )}
                  {order.notes && (
                    <div>
                      <p className="font-medium text-sm text-gray-600">Notas</p>
                      <p className="text-sm">{order.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Management */}
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Estado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Cambiar Estado</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="assigned">Asignado</SelectItem>
                      <SelectItem value="in_progress">En Proceso</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Notas del Cambio</label>
                  <Textarea 
                    placeholder="Agregar notas sobre el cambio de estado..."
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleStatusUpdate}
                  disabled={newStatus === order.status || updateStatusMutation.isPending}
                  className="w-full"
                >
                  {updateStatusMutation.isPending ? "Actualizando..." : "Actualizar Estado"}
                </Button>
              </CardContent>
            </Card>

            {/* Assignment Info */}
            {order.assignedUser && (
              <Card>
                <CardHeader>
                  <CardTitle>Técnico Asignado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {order.assignedUser.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{order.assignedUser.name}</p>
                      <p className="text-sm text-gray-500 capitalize">{order.assignedUser.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Historial del Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orderHistory.map((entry) => {
                    const Icon = getActionIcon(entry.action);
                    return (
                      <div key={entry.id} className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <Icon className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {entry.statusTo && `Estado: ${getStatusLabel(entry.statusTo)}`}
                          </p>
                          {entry.notes && (
                            <p className="text-xs text-gray-500">{entry.notes}</p>
                          )}
                          <p className="text-xs text-gray-400">
                            {new Date(entry.timestamp).toLocaleString('es-MX')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}