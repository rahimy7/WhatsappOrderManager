import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, DollarSign, Receipt, Calendar, FileText, Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Billing() {
  const { toast } = useToast();

  // Obtener datos de facturación
  const { data: billingData = [], isLoading } = useQuery({
    queryKey: ["/api/billing"],
  });

  // Obtener resumen de facturación
  const { data: billingSummary = {}, isLoading: loadingSummary } = useQuery({
    queryKey: ["/api/billing/summary"],
  });

  if (isLoading || loadingSummary) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const handleViewInvoice = (invoiceId: string) => {
    toast({
      title: "Abriendo factura",
      description: `Factura ${invoiceId} se abrirá en una nueva ventana`,
    });
    // Aquí se abriría la factura en una nueva ventana
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    toast({
      title: "Descargando factura",
      description: `Factura ${invoiceId} se está descargando`,
    });
    // Aquí se descargaría la factura
    const link = document.createElement('a');
    link.href = `/api/invoices/${invoiceId}/download`;
    link.download = `factura-${invoiceId}.pdf`;
    link.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Facturación</h1>
          <p className="text-gray-600 mt-2">
            Consulta y gestiona tus datos de facturación
          </p>
        </div>
      </div>

      {/* Resumen de Facturación */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Facturado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(billingSummary.totalBilled || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              En los últimos 12 meses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturas Emitidas</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {billingSummary.totalInvoices || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Este año
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio Mensual</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(billingSummary.monthlyAverage || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos 6 meses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Facturas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Historial de Facturas</span>
          </CardTitle>
          <CardDescription>
            Consulta todas las facturas emitidas para tu tienda
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Array.isArray(billingData) && billingData.length > 0 ? (
            <div className="space-y-4">
              {billingData.map((invoice: any) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                      <Receipt className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">
                        Factura #{invoice.invoiceNumber || invoice.id}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(invoice.date || invoice.createdAt).toLocaleDateString('es-MX')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        {formatCurrency(invoice.amount || 0)}
                      </div>
                      <Badge 
                        variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                        className={
                          invoice.status === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                      </Badge>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewInvoice(invoice.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadInvoice(invoice.id)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay facturas disponibles
              </h3>
              <p className="text-gray-600">
                Las facturas aparecerán aquí cuando se generen automáticamente por las ventas realizadas
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información de Facturación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Información de Facturación</span>
          </CardTitle>
          <CardDescription>
            Datos fiscales para la emisión de facturas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">RFC</label>
                <Input 
                  value={billingSummary.rfc || "No configurado"} 
                  readOnly 
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Razón Social</label>
                <Input 
                  value={billingSummary.businessName || "No configurado"} 
                  readOnly 
                  className="mt-1"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Dirección Fiscal</label>
                <Input 
                  value={billingSummary.address || "No configurado"} 
                  readOnly 
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email de Facturación</label>
                <Input 
                  value={billingSummary.billingEmail || "No configurado"} 
                  readOnly 
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> Para actualizar tu información fiscal, contacta al soporte técnico. 
              Las facturas se generan automáticamente cuando se completan las órdenes de servicio.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}