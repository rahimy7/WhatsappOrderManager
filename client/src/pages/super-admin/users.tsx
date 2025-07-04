import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  AlertCircle,
  UserCheck,
  Key
} from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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

interface VirtualStore {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  subscription: string;
  subscriptionExpiry?: string;
}

// Esquema de validación para crear usuarios
const createUserSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email válido requerido"),
  phone: z.string().min(10, "Teléfono debe tener al menos 10 dígitos").optional(),
  role: z.enum(["store_owner", "store_admin"], {
    required_error: "Rol requerido",
  }),
  storeId: z.number({
    required_error: "Tienda requerida",
  }),
  sendInvitation: z.boolean().default(true),
  invitationMessage: z.string().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

// Schema para editar usuario
const editUserSchema = z.object({
  name: z.string().min(2, {
    message: "El nombre debe tener al menos 2 caracteres",
  }),
  email: z.string().email({
    message: "Email inválido",
  }),
  phone: z.string().min(10, {
    message: "Teléfono debe tener al menos 10 dígitos",
  }),
  role: z.enum(["store_admin", "store_owner", "super_admin"], {
    required_error: "Rol requerido",
  }),
  status: z.enum(["active", "inactive", "suspended"], {
    required_error: "Estado requerido",
  }),
  storeId: z.number({
    required_error: "Tienda requerida",
  }),
});

type EditUserForm = z.infer<typeof editUserSchema>;

export default function SuperAdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<StoreOwner | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [userCredentials, setUserCredentials] = useState<{
    name: string;
    email: string;
    username: string;
    tempPassword: string;
    storeName: string;
    role: string;
    invitationSent: boolean;
  } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Formulario para crear nuevo usuario
  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: "store_admin",
      sendInvitation: true,
      invitationMessage: "",
    },
  });

  // Formulario para editar usuario
  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: "store_admin",
      status: "active",
      storeId: 1,
    },
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<UserMetrics>({
    queryKey: ["/api/super-admin/user-metrics"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<StoreOwner[]>({
    queryKey: ["/api/super-admin/users"],
  });

  // Obtener tiendas disponibles para asignar usuarios
  const { data: stores, isLoading: storesLoading } = useQuery<VirtualStore[]>({
    queryKey: ["/api/super-admin/stores"],
  });

  // Mutación para crear nuevo usuario
  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserForm) => {
      return apiRequest("POST", "/api/super-admin/users", userData);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/user-metrics"] });
      setIsCreateDialogOpen(false);
      form.reset();
      
      // Guardar las credenciales y mostrar el diálogo
      setUserCredentials({
        name: data.name,
        email: data.email,
        username: data.username,
        tempPassword: data.tempPassword,
        storeName: data.storeName,
        role: data.role,
        invitationSent: data.invitationSent || false,
      });
      setIsCredentialsDialogOpen(true);
      
      toast({
        title: "Usuario creado exitosamente",
        description: "Las credenciales de acceso han sido generadas",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el usuario",
        variant: "destructive",
      });
    },
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

  // Función para manejar el envío del formulario
  const handleCreateUser = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };

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

  // Mutación para editar usuario
  const editUserMutation = useMutation({
    mutationFn: async (data: EditUserForm & { id: number }) => {
      return apiRequest("PUT", `/api/super-admin/users/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/user-metrics"] });
      setIsEditDialogOpen(false);
      editForm.reset();
      setSelectedUser(null);
      toast({
        title: "Usuario actualizado",
        description: "La información del usuario ha sido actualizada exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el usuario",
        variant: "destructive",
      });
    },
  });

  // Mutación para resetear contraseña
  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("POST", `/api/super-admin/users/${userId}/reset-password`);
    },
    onSuccess: (response: any) => {
      setUserCredentials({
        name: selectedUser?.name || "",
        email: selectedUser?.email || "",
        username: selectedUser?.username || "",
        tempPassword: response.newPassword,
        storeName: selectedUser?.storeName || "",
        role: selectedUser?.role || "",
        invitationSent: false,
      });
      setIsResetPasswordDialogOpen(false);
      setIsCredentialsDialogOpen(true);
      toast({
        title: "Contraseña restablecida",
        description: "Se ha generado una nueva contraseña temporal",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo restablecer la contraseña",
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

  const filteredUsers = users ? users.filter(user => {
    const matchesSearch = 
      (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.storeName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  }) : [];

  const handleViewDetails = (user: StoreOwner) => {
    setSelectedUser(user);
    setIsDetailsDialogOpen(true);
  };

  const handleEditUser = (user: StoreOwner) => {
    setSelectedUser(user);
    editForm.reset({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role as any,
      status: user.status as any,
      storeId: user.storeId || 1,
    });
    setIsEditDialogOpen(true);
  };

  const handleEditUserSubmit = (data: EditUserForm) => {
    if (selectedUser) {
      editUserMutation.mutate({ ...data, id: selectedUser.id });
    }
  };

  const handleResetPassword = (user: StoreOwner) => {
    setSelectedUser(user);
    setIsResetPasswordDialogOpen(true);
  };

  const confirmResetPassword = () => {
    if (selectedUser) {
      resetPasswordMutation.mutate(selectedUser.id);
    }
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
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Usuario</DialogTitle>
              <DialogDescription>
                Complete los datos para crear un nuevo propietario o administrador de tienda
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateUser)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Juan Carlos Pérez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="usuario@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: +52 55 1234 5678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="storeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tienda Asignada</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tienda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stores?.map((store) => (
                            <SelectItem key={store.id} value={store.id.toString()}>
                              {store.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol del Usuario</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="store_owner">
                            <div className="flex items-center">
                              <Crown className="h-4 w-4 mr-2 text-yellow-600" />
                              Propietario de Tienda
                            </div>
                          </SelectItem>
                          <SelectItem value="store_admin">
                            <div className="flex items-center">
                              <Shield className="h-4 w-4 mr-2 text-blue-600" />
                              Administrador de Tienda
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sendInvitation"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Enviar Invitación por Email</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Se enviará un email con las credenciales de acceso
                        </div>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch("sendInvitation") && (
                  <FormField
                    control={form.control}
                    name="invitationMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mensaje Personalizado (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Agrega un mensaje personalizado para la invitación..."
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createUserMutation.isPending}
                  >
                    {createUserMutation.isPending ? (
                      <>
                        <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 mr-2" />
                        Crear Usuario
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
                      <div className="font-semibold">${(user.monthlyRevenue || 0).toLocaleString()}/mes</div>
                      <div className="text-sm text-muted-foreground">
                        {user.totalOrders || 0} pedidos totales
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
                    <div className="font-medium">{(user.permissions || []).length} asignados</div>
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
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEditUser(user)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleResetPassword(user)}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Reset Contraseña
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
            <DialogDescription>
              Información completa del usuario seleccionado
            </DialogDescription>
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
                        <div className="font-semibold">${(selectedUser.monthlyRevenue || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Total de pedidos:</span>
                        <div className="font-semibold">{selectedUser.totalOrders || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Permisos</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.permissions && selectedUser.permissions.length > 0 ? 
                    selectedUser.permissions.map((permission, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {permission}
                      </Badge>
                    )) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Sin permisos especiales
                      </Badge>
                    )
                  }
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de edición de usuario */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica la información del usuario seleccionado
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditUserSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: María García López" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@ejemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="+52 555 123 4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="store_admin">Administrador de Tienda</SelectItem>
                        <SelectItem value="store_owner">Propietario de Tienda</SelectItem>
                        <SelectItem value="super_admin">Super Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                        <SelectItem value="suspended">Suspendido</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={editUserMutation.isPending}>
                  {editUserMutation.isPending ? "Actualizando..." : "Actualizar Usuario"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de reset de contraseña */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resetear Contraseña</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres resetear la contraseña de este usuario?
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{selectedUser.name}</div>
                <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
              </div>
              <div className="text-sm text-muted-foreground">
                Se generará una nueva contraseña temporal que deberás compartir con el usuario.
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={confirmResetPassword}
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? "Reseteando..." : "Resetear Contraseña"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Credenciales */}
      <Dialog open={isCredentialsDialogOpen} onOpenChange={setIsCredentialsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Credenciales de Acceso Generadas</DialogTitle>
            <DialogDescription>
              Se han generado las credenciales de acceso para el nuevo usuario
            </DialogDescription>
          </DialogHeader>
          {userCredentials && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-3">Usuario Creado Exitosamente</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Nombre:</span>
                    <div className="font-semibold">{userCredentials.name}</div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Email:</span>
                    <div className="font-semibold">{userCredentials.email}</div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Tienda:</span>
                    <div className="font-semibold">{userCredentials.storeName}</div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Rol:</span>
                    <Badge variant="outline">{userCredentials.role}</Badge>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-3">Credenciales de Acceso</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Usuario:</span>
                    <div className="font-mono bg-white border rounded px-3 py-2 text-sm">
                      {userCredentials.username}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Contraseña Temporal:</span>
                    <div className="font-mono bg-white border rounded px-3 py-2 text-sm">
                      {userCredentials.tempPassword}
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-xs text-yellow-800">
                    ⚠️ El usuario debe cambiar la contraseña en su primer acceso
                  </p>
                </div>
              </div>

              {userCredentials.invitationSent && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-green-800">
                      Invitación enviada por email exitosamente
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Usuario: ${userCredentials.username}\nContraseña: ${userCredentials.tempPassword}`
                    );
                    toast({
                      title: "Credenciales copiadas",
                      description: "Las credenciales han sido copiadas al portapapeles",
                    });
                  }}
                >
                  Copiar Credenciales
                </Button>
                <Button onClick={() => setIsCredentialsDialogOpen(false)}>
                  Continuar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}