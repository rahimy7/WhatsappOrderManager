import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders";
import Conversations from "@/pages/conversations";
import Team from "@/pages/team";
import Products from "@/pages/products";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import WhatsAppSettings from "@/pages/whatsapp-settings";
import AutoResponses from "@/pages/auto-responses";
import Employees from "@/pages/employees";
import Customers from "@/pages/customers";
import AssignmentRules from "@/pages/assignment-rules";
import Notifications from "@/pages/notifications";
import AppLayout from "@/components/layout/app-layout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/orders" component={Orders} />
      <Route path="/conversations" component={Conversations} />
      <Route path="/team" component={Team} />
      <Route path="/products" component={Products} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route path="/whatsapp-settings" component={WhatsAppSettings} />
      <Route path="/auto-responses" component={AutoResponses} />
      <Route path="/employees" component={Employees} />
      <Route path="/customers" component={Customers} />
      <Route path="/assignment-rules" component={AssignmentRules} />
      <Route path="/notifications" component={Notifications} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppLayout>
          <Router />
        </AppLayout>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
