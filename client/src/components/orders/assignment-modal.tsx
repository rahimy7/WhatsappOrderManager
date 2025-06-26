import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { OrderWithDetails, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface AssignmentModalProps {
  order: OrderWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AssignmentModal({ order, isOpen, onClose }: AssignmentModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");
  const [notes, setNotes] = useState<string>("");
  const { toast } = useToast();

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!order || !selectedUserId) throw new Error("Datos faltantes");
      
      // First update the order with priority and notes
      await apiRequest("PATCH", `/api/orders/${order.id}`, {
        priority,
        notes,
      });

      // Then assign the order
      return apiRequest("POST", `/api/orders/${order.id}/assign`, {
        userId: parseInt(selectedUserId),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Pedido asignado",
        description: "El pedido ha sido asignado exitosamente.",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo asignar el pedido.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setSelectedUserId("");
    setPriority("normal");
    setNotes("");
    onClose();
  };

  const handleAssign = () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Por favor selecciona un técnico o vendedor.",
        variant: "destructive",
      });
      return;
    }
    assignMutation.mutate();
  };

  // Filter available team members (technicians and sellers)
  const availableUsers = users?.filter((user: User) => 
    user.role === "technician" || user.role === "seller"
  ) || [];

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Disponible";
      case "busy":
        return "Ocupado";
      case "break":
        return "Descanso";
      case "offline":
        return "Desconectado";
      default:
        return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Pedido</DialogTitle>
        </DialogHeader>
        
        {order && (
          <div className="space-y-4">
            {/* Order Info */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">{order.orderNumber}</p>
              <p className="text-sm text-gray-600">{order.customer.name}</p>
              <p className="text-sm text-gray-600">${parseFloat(order.totalAmount).toLocaleString('es-MX')}</p>
            </div>

            {/* User Selection */}
            <div className="space-y-2">
              <Label htmlFor="user-select">Seleccionar Técnico/Vendedor</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user: User) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} - {user.role} ({getStatusText(user.status)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Selection */}
            <div className="space-y-2">
              <Label htmlFor="priority-select">Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas Internas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instrucciones especiales..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAssign}
                disabled={assignMutation.isPending}
              >
                {assignMutation.isPending ? "Asignando..." : "Asignar Pedido"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
