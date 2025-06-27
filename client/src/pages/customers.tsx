import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Phone, MapPin, Calendar, DollarSign, Search, Star, History, Edit, Trash2 } from "lucide-react";
import { Customer, insertCustomerSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// Form validation schema
const customerFormSchema = insertCustomerSchema.extend({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  phone: z.string().min(10, "El teléfono debe tener al menos 10 dígitos"),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

export default function CustomersPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Fetch customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["/api/customers"],
  });

  // Fetch VIP customers
  const { data: vipCustomers = [] } = useQuery({
    queryKey: ["/api/customers/vip"],
  });

  // Fetch customer details with history
  const { data: customerDetails } = useQuery({
    queryKey: ["/api/customers", selectedCustomer?.id, "details"],
    queryFn: () => selectedCustomer?.id ? fetch(`/api/customers/${selectedCustomer.id}/details`).then(res => res.json()) : null,
    enabled: !!selectedCustomer?.id,
  });

  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      return apiRequest("POST", "/api/customers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/vip"] });
      setShowCreateDialog(false);
      form.reset();
      toast({
        title: "Cliente creado",
        description: "El cliente ha sido registrado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el cliente",
        variant: "destructive",
      });
    },
  });

  // Edit customer mutation
  const editCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormData & { id: number }) => {
      return apiRequest("PUT", `/api/customers/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/vip"] });
      setShowEditDialog(false);
      setCustomerToEdit(null);
      editForm.reset();
      toast({
        title: "Cliente actualizado",
        description: "Los datos del cliente han sido actualizados exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el cliente",
        variant: "destructive",
      });
    },
  });

  // Delete customer mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/vip"] });
      setShowDeleteDialog(false);
      setCustomerToDelete(null);
      setSelectedCustomer(null);
      toast({
        title: "Cliente eliminado",
        description: "El cliente ha sido eliminado exitosamente",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting customer:', error);
      toast({
        title: "Error al eliminar cliente",
        description: error.message || "No se pudo eliminar el cliente. Es posible que tenga pedidos o conversaciones asociadas.",
        variant: "destructive",
      });
    },
  });

  // Form setup for creating customers
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      notes: "",
    },
  });

  // Form setup for editing customers
  const editForm = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      notes: "",
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    createCustomerMutation.mutate(data);
  };

  const onEditSubmit = (data: CustomerFormData) => {
    if (customerToEdit) {
      editCustomerMutation.mutate({ ...data, id: customerToEdit.id });
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setCustomerToEdit(customer);
    editForm.reset({
      name: customer.name,
      phone: customer.phone,
      address: customer.address || "",
      notes: customer.notes || "",
    });
    setShowEditDialog(true);
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setCustomerToDelete(customer);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (customerToDelete) {
      deleteCustomerMutation.mutate(customerToDelete.id);
    }
  };

  // Filter customers based on search term
  const filteredCustomers = customers.filter((customer: Customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  const formatDate = (date: string | null) => {
    if (!date) return "No registrado";
    return new Date(date).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600 mt-1">
            Gestiona la base de datos de clientes y su historial
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Pérez" {...field} />
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
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="+52 55 1234 5678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Calle 123, Colonia, Ciudad" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Información adicional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createCustomerMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {createCustomerMutation.isPending ? "Creando..." : "Crear Cliente"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Clientes</p>
                <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Phone className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Clientes VIP</p>
                <p className="text-2xl font-bold text-yellow-600">{vipCustomers.length}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Registrados Hoy</p>
                <p className="text-2xl font-bold text-green-600">
                  {customers.filter((c: Customer) => 
                    c.registrationDate && 
                    new Date(c.registrationDate).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Customers List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {filteredCustomers.map((customer: Customer) => (
                  <div
                    key={customer.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedCustomer?.id === customer.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900">{customer.name}</h3>
                          {customer.isVip && (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                              ⭐ VIP
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            {customer.phone}
                          </span>
                          {customer.totalOrders > 0 && (
                            <span className="flex items-center">
                              <DollarSign className="h-3 w-3 mr-1" />
                              {customer.totalOrders} pedidos
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCustomer(customer);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomer(customer);
                          }}
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No se encontraron clientes
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <History className="h-5 w-5 mr-2" />
              Detalles del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedCustomer ? (
              <div className="space-y-6">
                {/* Customer Info */}
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <h3 className="text-lg font-semibold">{selectedCustomer.name}</h3>
                    {selectedCustomer.isVip && (
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        ⭐ VIP
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                    
                    {selectedCustomer.address && (
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{selectedCustomer.address}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      <span>Registrado: {formatDate(selectedCustomer.registrationDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                {customerDetails && customerDetails.totalOrders > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-600 font-medium">Total Pedidos</p>
                      <p className="text-xl font-bold text-blue-900">{customerDetails.totalOrders}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-sm text-green-600 font-medium">Total Gastado</p>
                      <p className="text-xl font-bold text-green-900">${customerDetails.totalSpent}</p>
                    </div>
                  </div>
                )}

                {/* Recent History */}
                {customerDetails?.history && customerDetails.history.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Historial Reciente</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {customerDetails.history.slice(0, 10).map((entry: any) => (
                        <div key={entry.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <p className="text-sm font-medium">{entry.description}</p>
                            <p className="text-xs text-gray-500">
                              {formatDate(entry.timestamp)}
                            </p>
                          </div>
                          {entry.amount && (
                            <Badge variant="outline" className="text-xs">
                              ${entry.amount}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!customerDetails || customerDetails.totalOrders === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <History className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>Sin historial de pedidos</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Phone className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>Selecciona un cliente para ver sus detalles</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Pérez" {...field} />
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
                      <Input placeholder="+52 55 1234 5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Calle 123, Colonia, Ciudad" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Información adicional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={editCustomerMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {editCustomerMutation.isPending ? "Actualizando..." : "Actualizar Cliente"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Customer Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que quieres eliminar a <strong>{customerToDelete?.name}</strong>?
              Esta acción no se puede deshacer.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Advertencia:</strong> Si este cliente tiene pedidos o conversaciones asociadas, 
                también podrían verse afectadas.
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleteCustomerMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteCustomerMutation.isPending ? "Eliminando..." : "Eliminar Cliente"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}