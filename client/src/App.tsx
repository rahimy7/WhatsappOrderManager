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
import TechnicianDashboard from "@/pages/technician-dashboard";
import UserSettings from "@/pages/user-settings";
import Catalog from "@/pages/catalog";
import PublicCatalog from "@/pages/public-catalog";
import SimpleCatalog from "@/pages/simple-catalog";
import Cart from "@/pages/cart";
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

function RoleDashboard() {
  const { user } = useAuth();
  
  // Redireccionar técnicos a su dashboard específico
  if (user?.role === 'technician') {
    return <ProtectedRoute component={TechnicianDashboard} permission="technician_work" />;
  }
  
  // Administradores y otros roles al dashboard principal
  return <ProtectedRoute component={Dashboard} permission="view_dashboard" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RoleDashboard} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} permission="view_dashboard" />} />
      <Route path="/technician-dashboard" component={() => <ProtectedRoute component={TechnicianDashboard} permission="technician_work" />} />
      <Route path="/orders" component={() => <ProtectedRoute component={Orders} permission="manage_orders" />} />
      <Route path="/conversations" component={() => <ProtectedRoute component={Conversations} permission="view_conversations" />} />
      <Route path="/team" component={() => <ProtectedRoute component={Team} permission="manage_users" />} />
      <Route path="/products" component={() => <ProtectedRoute component={Products} permission="manage_orders" />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} permission="view_reports" />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} permission="manage_settings" />} />
      <Route path="/whatsapp-settings" component={() => <ProtectedRoute component={WhatsAppSettings} permission="manage_settings" />} />
      <Route path="/auto-responses" component={() => <ProtectedRoute component={AutoResponses} permission="manage_settings" />} />
      <Route path="/employees" component={() => <ProtectedRoute component={Employees} permission="manage_users" />} />
      <Route path="/customers" component={() => <ProtectedRoute component={Customers} permission="manage_users" />} />
      <Route path="/assignment-rules" component={() => <ProtectedRoute component={AssignmentRules} permission="manage_assignments" />} />
      <Route path="/notifications" component={() => <ProtectedRoute component={Notifications} permission="view_notifications" />} />
      <Route path="/catalog" component={Catalog} />
      <Route path="/public-catalog" component={PublicCatalog} />
      <Route path="/cart" component={Cart} />
      <Route path="/user-settings" component={UserSettings} />
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

  return (
    <Switch>
      {/* Rutas públicas sin layout */}
      <Route path="/public-catalog" component={PublicCatalog} />
      <Route path="/simple-catalog" component={SimpleCatalog} />
      <Route path="/login" component={Login} />
      
      {/* Rutas que requieren autenticación con layout */}
      <Route>
        {!user ? (
          <Login />
        ) : (
          <AppLayout>
            <Router />
          </AppLayout>
        )}
      </Route>
    </Switch>
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
