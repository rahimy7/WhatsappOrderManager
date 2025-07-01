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
import PublicCatalogClean from "@/pages/public-catalog-clean";
import SimpleCatalog from "@/pages/simple-catalog";
import Cart from "@/pages/cart";
import Billing from "@/pages/billing";
import ProductManagement from "@/pages/product-management";
import StoreManagement from "@/pages/store-management";
import MultiTenantLogin from "@/pages/multi-tenant-login";
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import GlobalUsersManagement from "@/pages/global-users-management";
import GlobalDashboard from "@/pages/super-admin/global-dashboard";
import StoresManagement from "@/pages/super-admin/stores-management";
import GlobalSettings from "@/pages/super-admin/global-settings";
import Subscriptions from "@/pages/super-admin/subscriptions";
import GlobalOrders from "@/pages/super-admin/global-orders";
import SuperAdminUsers from "@/pages/super-admin/users";
import SuperAdminReports from "@/pages/super-admin/reports";
import Support from "@/pages/super-admin/support";
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
    return <MultiTenantLogin />;
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
  
  // Super administradores al Panel de Control General
  if (user?.role === 'super_admin') {
    return <ProtectedRoute component={GlobalDashboard} permission="super_admin" />;
  }
  
  // Administradores regulares al Dashboard Principal
  if (user?.role === 'admin') {
    return <ProtectedRoute component={Dashboard} permission="view_dashboard" />;
  }
  
  // Otros roles a conversaciones
  return <ProtectedRoute component={Conversations} permission="view_conversations" />;
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
      <Route path="/product-management" component={() => <ProtectedRoute component={ProductManagement} permission="manage_products" />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} permission="view_reports" />} />
      <Route path="/billing" component={() => <ProtectedRoute component={Billing} permission="view_reports" />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} permission="manage_settings" />} />
      <Route path="/whatsapp-settings" component={() => <ProtectedRoute component={WhatsAppSettings} permission="manage_settings" />} />
      <Route path="/auto-responses" component={() => <ProtectedRoute component={AutoResponses} permission="manage_settings" />} />
      <Route path="/employees" component={() => <ProtectedRoute component={Employees} permission="manage_users" />} />
      <Route path="/customers" component={() => <ProtectedRoute component={Customers} permission="manage_users" />} />
      <Route path="/assignment-rules" component={() => <ProtectedRoute component={AssignmentRules} permission="manage_assignments" />} />
      <Route path="/notifications" component={() => <ProtectedRoute component={Notifications} permission="view_notifications" />} />
      <Route path="/store-management" component={() => <ProtectedRoute component={StoreManagement} permission="manage_settings" />} />
      <Route path="/super-admin-dashboard" component={() => <ProtectedRoute component={SuperAdminDashboard} permission="super_admin" />} />
      <Route path="/global-users-management" component={() => <ProtectedRoute component={GlobalUsersManagement} permission="super_admin" />} />
      <Route path="/super-admin/dashboard" component={() => <ProtectedRoute component={GlobalDashboard} permission="super_admin" />} />
      <Route path="/super-admin/stores" component={() => <ProtectedRoute component={StoresManagement} permission="super_admin" />} />
      <Route path="/super-admin/subscriptions" component={() => <ProtectedRoute component={Subscriptions} permission="super_admin" />} />
      <Route path="/super-admin/global-orders" component={() => <ProtectedRoute component={GlobalOrders} permission="super_admin" />} />
      <Route path="/super-admin/users" component={() => <ProtectedRoute component={SuperAdminUsers} permission="super_admin" />} />
      <Route path="/super-admin/reports" component={() => <ProtectedRoute component={SuperAdminReports} permission="super_admin" />} />
      <Route path="/super-admin/support" component={() => <ProtectedRoute component={Support} permission="super_admin" />} />
      <Route path="/super-admin/settings" component={() => <ProtectedRoute component={GlobalSettings} permission="super_admin" />} />
      <Route path="/catalog" component={Catalog} />
      <Route path="/public-catalog" component={PublicCatalogClean} />
      <Route path="/cart" component={Cart} />
      <Route path="/user-settings" component={UserSettings} />
      <Route path="/login" component={MultiTenantLogin} />
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
      <Route path="/public-catalog" component={PublicCatalogClean} />
      <Route path="/simple-catalog" component={SimpleCatalog} />
      <Route path="/login" component={MultiTenantLogin} />
      <Route path="/multi-tenant-login" component={MultiTenantLogin} />
      
      {/* Rutas que requieren autenticación con layout */}
      <Route>
        {!user ? (
          <MultiTenantLogin />
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
