import MetricsCards from "@/components/dashboard/metrics-cards";
import RecentOrders from "@/components/dashboard/recent-orders";
import ActiveConversations from "@/components/dashboard/active-conversations";
import TeamStatus from "@/components/dashboard/team-status";
import QuickActions from "@/components/dashboard/quick-actions";

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <MetricsCards />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentOrders />
        </div>
        
        <div className="space-y-6">
          <ActiveConversations />
          <TeamStatus />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
