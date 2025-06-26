import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import { User } from "@shared/schema";

export default function Team() {
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: string }) => {
      return apiRequest("PATCH", `/api/users/${userId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "busy":
        return "bg-yellow-100 text-yellow-800";
      case "break":
        return "bg-gray-100 text-gray-800";
      case "offline":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Activo";
      case "busy":
        return "Ocupado";
      case "break":
        return "Descanso";
      case "offline":
        return "Desconectado";
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <UserCheck className="h-4 w-4" />;
      case "busy":
        return <UserX className="h-4 w-4" />;
      case "break":
        return <Clock className="h-4 w-4" />;
      case "offline":
        return <UserX className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const technicians = users?.filter((user: User) => user.role === "technician") || [];
  const sellers = users?.filter((user: User) => user.role === "seller") || [];
  const admins = users?.filter((user: User) => user.role === "admin") || [];

  return (
    <div className="space-y-6">

      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Técnicos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{technicians.length}</div>
            <p className="text-sm text-gray-500 mt-1">
              {technicians.filter(t => t.status === "active").length} activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Vendedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sellers.length}</div>
            <p className="text-sm text-gray-500 mt-1">
              {sellers.filter(s => s.status === "active").length} activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Administradores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{admins.length}</div>
            <p className="text-sm text-gray-500 mt-1">
              {admins.filter(a => a.status === "active").length} activos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Miembros del Equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users?.map((user: User) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{user.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                    {user.phone && (
                      <p className="text-xs text-gray-400">{user.phone}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Badge className={getStatusColor(user.status)}>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(user.status)}
                      <span>{getStatusText(user.status)}</span>
                    </div>
                  </Badge>

                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant={user.status === "active" ? "default" : "outline"}
                      onClick={() => updateStatusMutation.mutate({ userId: user.id, status: "active" })}
                      disabled={updateStatusMutation.isPending}
                    >
                      Activo
                    </Button>
                    <Button
                      size="sm"
                      variant={user.status === "busy" ? "default" : "outline"}
                      onClick={() => updateStatusMutation.mutate({ userId: user.id, status: "busy" })}
                      disabled={updateStatusMutation.isPending}
                    >
                      Ocupado
                    </Button>
                    <Button
                      size="sm"
                      variant={user.status === "break" ? "default" : "outline"}
                      onClick={() => updateStatusMutation.mutate({ userId: user.id, status: "break" })}
                      disabled={updateStatusMutation.isPending}
                    >
                      Descanso
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
