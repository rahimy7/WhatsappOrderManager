import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Users, 
  UserPlus, 
  Eye, 
  Edit, 
  Trash2,
  Building2,
  Mail,
  Phone,
  Calendar,
  Shield,
  Crown,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StoreOwner {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: 'store_owner' | 'super_admin';
  status: 'active' | 'inactive' | 'suspended';
  registrationDate: string;
  lastLogin: string;
  storeId?: number;
  storeName?: string;
  storeStatus?: 'active' | 'inactive' | 'trial' | 'suspended';
  subscriptionStatus?: 'active' | 'trial' | 'expired' | 'cancelled';
  totalOrders: number;
  monthlyRevenue: number;
  permissions: string[];
}

interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  storeOwners: number;
  superAdmins: number;
  suspendedUsers: number;
  newUsersThisMonth: number;
}

export default function SuperAdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<StoreOwner | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: metrics, isLoading: metricsLoading } = useQuery<UserMetrics>({
    queryKey: ["/api/super-admin/user-metrics"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<StoreOwner[]>({
    queryKey: ["/api/super-admin/users"],
  });

  const suspendUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("PUT", `/api/super-admin/users/${userId}/suspend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      toast({
        title: "Usuario suspendido",
        description: "El usuario ha sido suspendido exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo suspender el usuario",
        variant: "destructive",
      });
    },
  });

  const reactivateUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("PUT", `/api/super-admin/users/${userId}/reactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      toast({
        title: "Usuario reactivado",
        description: "El usuario ha sido reactivado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo reactivar el usuario",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800';
      case 'store_owner': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return <Crown className="h-4 w-4" />;
      case 'store_owner': return <Building2 className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'inactive': return <XCircle className="h-4 w-4" />;
      case 'suspended': return <AlertCircle className="h-4 w-4" />;
      default: return <XCircle className="h-4 w-4" />;
    }
  };

  const filteredUsers = users?.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.storeName && user.storeName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  }) || [];

  const handleViewDetails = (user: StoreOwner) => {
    setSelectedUser(user);
    setIsDetailsDialogOpen(true);
  };

  if (metricsLoading || usersLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">5️⃣ Usuarios (Propietarios)</h1>
          <p className="text-muted-foreground">Gestión de propietarios de tiendas y super administradores</p>
        </div>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">Usuarios registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeUsers || 0}</div>
            <p className="text-xs text-muted-foreground">Usuarios activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propietarios</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.storeOwners || 0}</div>
            <p className="text-xs text-muted-foreground">Propietarios de tiendas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.superAdmins || 0}</div>
            <p className="text-xs text-muted-foreground">Super administradores</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspendidos</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.suspendedUsers || 0}</div>
            <p className="text-xs text-muted-foreground">Usuarios suspendidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuevos este Mes</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.newUsersThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">Registros recientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Buscar por nombre, email, usuario o tienda..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">Todos los roles</option>
              <option value="store_owner">Propietarios de tienda</option>
              <option value="super_admin">Super administradores</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="suspended">Suspendidos</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de usuarios */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios Registrados ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(user.status)}
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {user.name}
                          {getRoleIcon(user.role)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          @{user.username} • {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Badge className={getStatusColor(user.status)}>
                        {user.status === 'active' && 'Activo'}
                        {user.status === 'inactive' && 'Inactivo'}
                        {user.status === 'suspended' && 'Suspendido'}
                      </Badge>
                      <Badge className={getRoleColor(user.role)}>
                        {user.role === 'super_admin' && 'Super Admin'}
                        {user.role === 'store_owner' && 'Propietario'}
                      </Badge>
                    </div>
                  </div>
                  
                  {user.role === 'store_owner' && (
                    <div className="text-right">
                      <div className="font-semibold">${user.monthlyRevenue.toLocaleString()}/mes</div>
                      <div className="text-sm text-muted-foreground">
                        {user.totalOrders} pedidos totales
                      </div>
                    </div>
                  )}
                </div>

                {user.storeName && (
                  <div className="mt-3 flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{user.storeName}</span>
                    {user.storeStatus && (
                      <Badge variant="outline" className="text-xs">
                        {user.storeStatus === 'active' && 'Tienda Activa'}
                        {user.storeStatus === 'trial' && 'En Prueba'}
                        {user.storeStatus === 'inactive' && 'Tienda Inactiva'}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Registro:</span>
                    <div className="font-medium">{new Date(user.registrationDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Último acceso:</span>
                    <div className="font-medium">{new Date(user.lastLogin).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Teléfono:</span>
                    <div className="font-medium">{user.phone || 'No registrado'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Permisos:</span>
                    <div className="font-medium">{user.permissions.length} asignados</div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewDetails(user)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Detalles
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  {user.status === 'active' ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => suspendUserMutation.mutate(user.id)}
                      disabled={suspendUserMutation.isPending}
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Suspender
                    </Button>
                  ) : user.status === 'suspended' ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => reactivateUserMutation.mutate(user.id)}
                      disabled={reactivateUserMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Reactivar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de detalles de usuario */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Usuario</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{selectedUser.name}</h2>
                  <p className="text-muted-foreground">@{selectedUser.username}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className={getStatusColor(selectedUser.status)}>
                      {selectedUser.status}
                    </Badge>
                    <Badge className={getRoleColor(selectedUser.role)}>
                      {selectedUser.role}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Información de Contacto</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedUser.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedUser.phone || 'No registrado'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Información de Acceso</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Registro: {new Date(selectedUser.registrationDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Último acceso: {new Date(selectedUser.lastLogin).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedUser.storeName && (
                <div>
                  <h3 className="font-semibold mb-2">Información de Tienda</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{selectedUser.storeName}</p>
                        <p className="text-sm text-muted-foreground">ID: {selectedUser.storeId}</p>
                      </div>
                      <Badge variant="outline">
                        {selectedUser.storeStatus}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Ingresos mensuales:</span>
                        <div className="font-semibold">${selectedUser.monthlyRevenue.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Total de pedidos:</span>
                        <div className="font-semibold">{selectedUser.totalOrders}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Permisos</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.permissions.map((permission, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}