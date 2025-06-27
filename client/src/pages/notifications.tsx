import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, CheckCircle, Clock, Trash2, Users, Settings, AlertTriangle, MessageSquare } from "lucide-react";
import type { Notification } from "@shared/schema";

export default function NotificationsPage() {
  const [selectedUser, setSelectedUser] = useState<number>(1); // For demo purposes, would get from auth
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["/api/notifications", { userId: selectedUser }],
    queryFn: () => apiRequest("GET", `/api/notifications?userId=${selectedUser}`)
  });

  // Fetch unread notifications
  const { data: unreadNotifications = [] } = useQuery({
    queryKey: ["/api/notifications/unread", { userId: selectedUser }],
    queryFn: () => apiRequest("GET", `/api/notifications/unread?userId=${selectedUser}`)
  });

  // Fetch notification counts
  const { data: counts = { total: 0, unread: 0 } } = useQuery({
    queryKey: ["/api/notifications/count", { userId: selectedUser }],
    queryFn: () => apiRequest("GET", `/api/notifications/count?userId=${selectedUser}`)
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PUT", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo marcar la notificación como leída",
        variant: "destructive",
      });
    }
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/notifications/read-all", { userId: selectedUser }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
      toast({
        title: "Notificaciones actualizadas",
        description: "Todas las notificaciones han sido marcadas como leídas",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron actualizar las notificaciones",
        variant: "destructive",
      });
    }
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
      toast({
        title: "Notificación eliminada",
        description: "La notificación ha sido eliminada exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la notificación",
        variant: "destructive",
      });
    }
  });

  // Create test notification
  const createTestNotificationMutation = useMutation({
    mutationFn: (type: string) => apiRequest("POST", "/api/notifications", {
      userId: selectedUser,
      title: getTestNotificationTitle(type),
      message: getTestNotificationMessage(type),
      type: type,
      priority: type === "urgent" ? "urgent" : "normal"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
      toast({
        title: "Notificación de prueba creada",
        description: "Se ha generado una nueva notificación para testing",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la notificación de prueba",
        variant: "destructive",
      });
    }
  });

  function getTestNotificationTitle(type: string): string {
    switch (type) {
      case "order": return "Nueva Orden Asignada";
      case "message": return "Nuevo Mensaje WhatsApp";
      case "system": return "Actualización del Sistema";
      case "assignment": return "Asignación Automática";
      case "urgent": return "🚨 Alerta Urgente";
      default: return "Notificación de Prueba";
    }
  }

  function getTestNotificationMessage(type: string): string {
    switch (type) {
      case "order": return "Se te ha asignado la orden #ORD-1234 para instalación de aire acondicionado en Av. Reforma 123";
      case "message": return "Cliente María López envió un mensaje: '¿A qué hora llega el técnico?'";
      case "system": return "El sistema ha sido actualizado a la versión 2.1.0 con nuevas funcionalidades";
      case "assignment": return "Orden #ORD-5678 asignada automáticamente basada en tu especialización y ubicación";
      case "urgent": return "Emergencia técnica reportada - Cliente sin servicio de aire acondicionado - Requiere atención inmediata";
      default: return "Esta es una notificación de prueba para verificar el funcionamiento del sistema";
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case "order": return <Settings className="h-4 w-4" />;
      case "message": return <MessageSquare className="h-4 w-4" />;
      case "system": return <Bell className="h-4 w-4" />;
      case "assignment": return <Users className="h-4 w-4" />;
      case "urgent": return <AlertTriangle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  }

  function getNotificationColor(type: string, priority: string) {
    if (priority === "urgent") return "destructive";
    switch (type) {
      case "order": return "default";
      case "message": return "secondary";
      case "system": return "outline";
      case "assignment": return "default";
      default: return "default";
    }
  }

  function formatTimeAgo(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Ahora";
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  }

  const filteredNotifications = {
    all: notifications,
    unread: notifications.filter((n: Notification) => !n.isRead),
    order: notifications.filter((n: Notification) => n.type === "order"),
    message: notifications.filter((n: Notification) => n.type === "message"),
    system: notifications.filter((n: Notification) => n.type === "system"),
    urgent: notifications.filter((n: Notification) => n.priority === "urgent")
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          <p className="text-muted-foreground">
            {counts.total} total • {counts.unread} sin leer
          </p>
        </div>
        <div className="flex items-center gap-2">
          {counts.unread > 0 && (
            <Button
              variant="outline"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar todas como leídas
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{counts.total}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sin leer</p>
                <p className="text-2xl font-bold text-blue-600">{counts.unread}</p>
              </div>
              <BellOff className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgentes</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredNotifications.urgent.length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mensajes</p>
                <p className="text-2xl font-bold text-green-600">
                  {filteredNotifications.message.length}
                </p>
              </div>
              <MessageSquare className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Crear Notificaciones de Prueba</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {["order", "message", "system", "assignment", "urgent"].map((type) => (
              <Button
                key={type}
                variant="outline"
                size="sm"
                onClick={() => createTestNotificationMutation.mutate(type)}
                disabled={createTestNotificationMutation.isPending}
              >
                {getNotificationIcon(type)}
                <span className="ml-2 capitalize">{type}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>Todas las Notificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">
                Todas ({filteredNotifications.all.length})
              </TabsTrigger>
              <TabsTrigger value="unread">
                Sin leer ({filteredNotifications.unread.length})
              </TabsTrigger>
              <TabsTrigger value="order">
                Órdenes ({filteredNotifications.order.length})
              </TabsTrigger>
              <TabsTrigger value="message">
                Mensajes ({filteredNotifications.message.length})
              </TabsTrigger>
              <TabsTrigger value="system">
                Sistema ({filteredNotifications.system.length})
              </TabsTrigger>
              <TabsTrigger value="urgent">
                Urgentes ({filteredNotifications.urgent.length})
              </TabsTrigger>
            </TabsList>

            {Object.entries(filteredNotifications).map(([key, notificationList]) => (
              <TabsContent key={key} value={key} className="space-y-4 mt-4">
                {notificationList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay notificaciones en esta categoría
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notificationList.map((notification: Notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border rounded-lg ${
                          !notification.isRead ? "bg-blue-50 border-blue-200" : "bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="mt-1">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm">{notification.title}</h4>
                                <Badge variant={getNotificationColor(notification.type, notification.priority)}>
                                  {notification.type}
                                </Badge>
                                {notification.priority === "urgent" && (
                                  <Badge variant="destructive">Urgente</Badge>
                                )}
                                {!notification.isRead && (
                                  <Badge variant="secondary">Nuevo</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatTimeAgo(notification.createdAt)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-4">
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsReadMutation.mutate(notification.id)}
                                disabled={markAsReadMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNotificationMutation.mutate(notification.id)}
                              disabled={deleteNotificationMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}