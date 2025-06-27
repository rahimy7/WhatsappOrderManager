import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@shared/auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
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

function ProtectedRoute({ component: Component, permission }: { component: React.ComponentType, permission?: string }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (permission && !hasPermission(user.role, permission)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Acceso Denegado
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            No tienes permisos para acceder a esta página.
          </p>
        </div>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} permission="view_dashboard" />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} permission="view_dashboard" />} />
      <Route path="/orders" component={() => <ProtectedRoute component={Orders} permission="view_orders" />} />
      <Route path="/conversations" component={() => <ProtectedRoute component={Conversations} permission="view_conversations" />} />
      <Route path="/team" component={() => <ProtectedRoute component={Team} permission="manage_users" />} />
      <Route path="/products" component={() => <ProtectedRoute component={Products} permission="view_products" />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} permission="view_reports" />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} permission="manage_settings" />} />
      <Route path="/whatsapp-settings" component={() => <ProtectedRoute component={WhatsAppSettings} permission="manage_settings" />} />
      <Route path="/auto-responses" component={() => <ProtectedRoute component={AutoResponses} permission="manage_settings" />} />
      <Route path="/employees" component={() => <ProtectedRoute component={Employees} permission="manage_users" />} />
      <Route path="/customers" component={() => <ProtectedRoute component={Customers} permission="view_customers" />} />
      <Route path="/assignment-rules" component={() => <ProtectedRoute component={AssignmentRules} permission="manage_assignments" />} />
      <Route path="/notifications" component={() => <ProtectedRoute component={Notifications} permission="view_notifications" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppWithAuth() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Si no hay usuario autenticado, mostrar login sin layout
  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  // Si hay usuario autenticado, mostrar app con layout
  return (
    <AppLayout>
      <Router />
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AppWithAuth />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
