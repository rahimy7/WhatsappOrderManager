import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import OrderTable from "@/components/orders/order-table";
import AssignmentModal from "@/components/orders/assignment-modal";
import { OrderWithDetails } from "@shared/schema";

export default function Orders() {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["/api/orders"],
  });

  const handleAssignOrder = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setIsAssignmentModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <Header 
        title="Gestión de Pedidos"
        subtitle="Administra y asigna pedidos a tu equipo de trabajo"
      />
      
      <OrderTable 
        orders={orders || []}
        isLoading={isLoading}
        onAssignOrder={handleAssignOrder}
      />

      <AssignmentModal
        order={selectedOrder}
        isOpen={isAssignmentModalOpen}
        onClose={() => {
          setIsAssignmentModalOpen(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}
