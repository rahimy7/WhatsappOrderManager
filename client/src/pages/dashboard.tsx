import MetricsCards from "@/components/dashboard/metrics-cards";
import RecentOrders from "@/components/dashboard/recent-orders";
import ActiveConversations from "@/components/dashboard/active-conversations";
import TeamStatus from "@/components/dashboard/team-status";
import QuickActions from "@/components/dashboard/quick-actions";

export default function Dashboard() {
  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8">
      <MetricsCards />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 order-2 lg:order-1">
          <RecentOrders />
        </div>
        
        <div className="space-y-4 md:space-y-6 order-1 lg:order-2">
          <ActiveConversations />
          <TeamStatus />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
