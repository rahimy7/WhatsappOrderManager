import { Link, useLocation } from "wouter";
import { ChartLine, ShoppingCart, MessageCircle, Users, Package, BarChart3, Settings, Menu, X, Smartphone, Bot, UserPlus, Zap, Bell, Wrench, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@shared/auth";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [location] = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useAuth();
  
  // Check if mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: orders = [] } = useQuery({
    queryKey: ["/api/orders"],
    enabled: !!user && hasPermission(user.role, 'view_orders'),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["/api/conversations"],
    enabled: !!user && hasPermission(user.role, 'view_conversations'),
  });

  // Fetch notification counts for the current user
  const { data: notificationCounts = { total: 0, unread: 0 } } = useQuery({
    queryKey: ["/api/notifications/count", { userId: user?.id }],
    queryFn: () => apiRequest("GET", `/api/notifications/count?userId=${user?.id}`),
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!user && hasPermission(user.role, 'view_notifications'),
  });

  const pendingOrders = Array.isArray(orders) ? orders.filter((order: any) => order.status === "pending").length : 0;
  const activeConversations = Array.isArray(conversations) ? conversations.filter((conv: any) => conv.unreadCount > 0).length : 0;
  const unreadNotifications = notificationCounts.unread || 0;

  // Configurar elementos del menú basado en el rol del usuario
  const allNavItems = [
    // Items básicos para todos los roles
    {
      href: "/dashboard",
      icon: ChartLine,
      label: "Dashboard",
      badge: null,
      permission: "view_dashboard",
    },
    {
      href: "/orders",
      icon: ShoppingCart,
      label: "Pedidos",
      badge: pendingOrders > 0 ? pendingOrders : null,
      permission: "view_orders",
    },
    {
      href: "/conversations",
      icon: MessageCircle,
      label: "Conversaciones",
      badge: activeConversations > 0 ? activeConversations : null,
      permission: "view_conversations",
    },
    {
      href: "/notifications",
      icon: Bell,
      label: "Notificaciones",
      badge: unreadNotifications > 0 ? unreadNotifications : null,
      permission: "view_notifications",
    },
    // Items específicos para técnicos
    {
      href: "/technician-dashboard",
      icon: Wrench,
      label: "Mi Trabajo",
      badge: null,
      permission: "technician_work",
      roles: ["technician"],
    },
    // Items para managers y admins
    {
      href: "/team",
      icon: Users,
      label: "Equipo",
      badge: null,
      permission: "manage_users",
    },
    {
      href: "/customers",
      icon: UserPlus,
      label: "Clientes",
      badge: null,
      permission: "view_customers",
    },
    {
      href: "/employees",
      icon: UserPlus,
      label: "Empleados",
      badge: null,
      permission: "manage_users",
    },
    {
      href: "/products",
      icon: Package,
      label: "Productos",
      badge: null,
      permission: "view_products",
    },
    {
      href: "/reports",
      icon: BarChart3,
      label: "Reportes",
      badge: null,
      permission: "view_reports",
    },
    // Items solo para admins
    {
      href: "/settings",
      icon: Settings,
      label: "Configuración",
      badge: null,
      permission: "manage_settings",
    },
    {
      href: "/whatsapp-settings",
      icon: Smartphone,
      label: "WhatsApp API",
      badge: null,
      permission: "manage_settings",
    },
    {
      href: "/auto-responses",
      icon: Bot,
      label: "Respuestas Automáticas",
      badge: null,
      permission: "manage_settings",
    },
    {
      href: "/assignment-rules",
      icon: Zap,
      label: "Asignación Automática",
      badge: null,
      permission: "manage_assignments",
    },
  ];

  // Filtrar elementos del menú según permisos del usuario
  const navItems = allNavItems.filter(item => {
    if (!user) return false;
    
    // Si el item tiene roles específicos, verificar si el usuario tiene ese rol
    if (item.roles && !item.roles.includes(user.role)) {
      return false;
    }
    
    // Verificar permisos
    return hasPermission(user.role, item.permission);
  });

  if (isMobile && !isOpen) return null;

  return (
    <div className="relative">
      {/* Mobile backdrop */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`w-72 bg-white shadow-lg border-r border-gray-200 flex flex-col ${
        isMobile 
          ? 'fixed left-0 top-0 h-full z-50 transform transition-transform duration-300' 
          : 'relative'
      } ${
        isMobile && !isOpen ? '-translate-x-full' : 'translate-x-0'
      } md:w-72 md:relative md:transform-none`}>
        {/* Mobile close button */}
        {isMobile && (
          <div className="flex justify-end p-4 md:hidden">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="p-2"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Logo Header */}
        <div className="p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 md:w-10 h-8 md:h-10 whatsapp-bg rounded-lg flex items-center justify-center">
              <MessageCircle className="text-white h-5 md:h-6 w-5 md:w-6" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-base md:text-lg">OrderManager</h1>
              <p className="text-xs md:text-sm text-gray-500">WhatsApp Business</p>
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
    </div>
  );
}
