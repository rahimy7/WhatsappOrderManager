import { Link, useLocation } from "wouter";
import { ChartLine, ShoppingCart, MessageCircle, Users, Package, BarChart3, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function Sidebar() {
  const [location] = useLocation();
  
  const { data: orders = [] } = useQuery({
    queryKey: ["/api/orders"],
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["/api/conversations"],
  });

  const pendingOrders = Array.isArray(orders) ? orders.filter((order: any) => order.status === "pending").length : 0;
  const activeConversations = Array.isArray(conversations) ? conversations.filter((conv: any) => conv.unreadCount > 0).length : 0;

  const navItems = [
    {
      href: "/dashboard",
      icon: ChartLine,
      label: "Dashboard",
      badge: null,
    },
    {
      href: "/orders",
      icon: ShoppingCart,
      label: "Pedidos",
      badge: pendingOrders > 0 ? pendingOrders : null,
    },
    {
      href: "/conversations",
      icon: MessageCircle,
      label: "Conversaciones",
      badge: activeConversations > 0 ? activeConversations : null,
    },
    {
      href: "/team",
      icon: Users,
      label: "Equipo",
      badge: null,
    },
    {
      href: "/products",
      icon: Package,
      label: "Productos",
      badge: null,
    },
    {
      href: "/reports",
      icon: BarChart3,
      label: "Reportes",
      badge: null,
    },
    {
      href: "/settings",
      icon: Settings,
      label: "Configuración",
      badge: null,
    },
  ];

  return (
    <aside className="w-72 bg-white shadow-lg border-r border-gray-200 flex flex-col">
      {/* Logo Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 whatsapp-bg rounded-lg flex items-center justify-center">
            <MessageCircle className="text-white h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg">OrderManager</h1>
            <p className="text-sm text-gray-500">WhatsApp Business</p>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">AM</span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 text-sm">Ana Martínez</p>
            <p className="text-xs text-gray-500">Administradora</p>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <ChartLine className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                isActive
                  ? "bg-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
              {item.badge && (
                <Badge 
                  variant={item.href === "/conversations" ? "default" : "destructive"}
                  className={`ml-auto text-xs px-2 py-1 ${
                    item.href === "/conversations" ? "whatsapp-bg text-white" : ""
                  }`}
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 success-bg rounded-full"></div>
          <span className="text-sm text-gray-600">WhatsApp API Conectado</span>
        </div>
      </div>
    </aside>
  );
}
