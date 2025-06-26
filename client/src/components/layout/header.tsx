import { useState } from "react";
import { Plus, Bell, Settings, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CreateOrderModal from "@/components/orders/create-order-modal";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export default function Header({ 
  title = "Dashboard Principal", 
  subtitle = "Gestión de pedidos y conversaciones de WhatsApp",
  onMenuClick,
  showMenuButton = false
}: HeaderProps) {
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 px-3 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {showMenuButton && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onMenuClick}
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h2 className="text-lg md:text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm md:text-base text-gray-600 hidden sm:block">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4">
          <Button 
            className="whatsapp-bg hover:bg-green-600 text-white text-sm md:text-base px-3 md:px-4"
            onClick={() => setIsCreateOrderModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-0 md:mr-2" />
            <span className="hidden sm:inline">Nuevo Pedido</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
          <div className="flex items-center space-x-1 md:space-x-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 md:h-5 w-4 md:w-5" />
              <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs h-4 md:h-5 w-4 md:w-5 rounded-full flex items-center justify-center p-0">
                3
              </Badge>
            </Button>
            <Button variant="ghost" size="icon" className="hidden md:flex">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <CreateOrderModal
        isOpen={isCreateOrderModalOpen}
        onClose={() => setIsCreateOrderModalOpen(false)}
      />
    </header>
  );
}
