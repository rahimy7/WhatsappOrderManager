import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, MessageCircle, Users, DollarSign, TrendingUp } from "lucide-react";

export default function MetricsCards() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Pedidos Hoy",
      value: metrics?.ordersToday || 0,
      change: "+12% vs ayer",
      icon: ShoppingCart,
      iconBg: "bg-primary bg-opacity-10",
      iconColor: "text-primary",
    },
    {
      title: "Conversaciones Activas", 
      value: metrics?.activeConversations || 0,
      change: "+3 nuevas",
      icon: MessageCircle,
      iconBg: "whatsapp-bg bg-opacity-10",
      iconColor: "whatsapp-text",
    },
    {
      title: "Técnicos Activos",
      value: metrics?.activeTechnicians || 0,
      change: "de 12 disponibles",
      icon: Users,
      iconBg: "success-bg bg-opacity-10",
      iconColor: "success-text",
    },
    {
      title: "Ingresos del Día",
      value: `$${metrics?.dailyRevenue?.toLocaleString('es-MX') || "0"}`,
      change: "+8.5%",
      icon: DollarSign,
      iconBg: "warning-bg bg-opacity-10", 
      iconColor: "warning-text",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className="border border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                  <p className="text-sm text-green-600 mt-1 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {card.change}
                  </p>
                </div>
                <div className={`w-12 h-12 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${card.iconColor} h-6 w-6`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
