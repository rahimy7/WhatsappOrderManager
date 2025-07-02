import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Search, Package, Plus, Edit3, Trash2, Eye, DollarSign, Tag, Image, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  categoryId: number;
  isActive: boolean;
  images: string[];
  sku?: string;
  brand?: string;
  model?: string;
  weight?: string;
  dimensions?: string;
  categoryName?: string;
  storeId: number;
}

interface Category {
  id: number;
  name: string;
  description?: string;
  storeId: number;
}

export default function StoreProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Get store ID from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');
    if (storeParam) {
      setStoreId(parseInt(storeParam));
    }
  }, []);

  // Fetch store info
  const { data: store } = useQuery({
    queryKey: [`/api/super-admin/stores`],
    enabled: !!storeId,
    select: (data: any[]) => data?.find((s: any) => s.id === storeId)
  });

  // Fetch products for specific store
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products"],
    enabled: !!storeId,
  });

  // Fetch categories for specific store
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/categories"],
    enabled: !!storeId,
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/super-admin/store-products/${storeId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/store-products", storeId] });
      setShowCreateDialog(false);
      toast({
        title: "Producto creado",
        description: "El producto se ha creado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo crear el producto",
        variant: "destructive",
      });
    },
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/super-admin/store-products/${storeId}/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/store-products", storeId] });
      setShowEditDialog(false);
      setSelectedProduct(null);
      toast({
        title: "Producto actualizado",
        description: "Los cambios se han guardado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo actualizar el producto",
        variant: "destructive",
      });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/super-admin/store-products/${storeId}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/store-products", storeId] });
      toast({
        title: "Producto eliminado",
        description: "El producto se ha eliminado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo eliminar el producto",
        variant: "destructive",
      });
    },
  });

  // Toggle product status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      apiRequest("PATCH", `/api/super-admin/store-products/${storeId}/${id}/status`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/store-products", storeId] });
      toast({
        title: "Estado actualizado",
        description: "El estado del producto se ha actualizado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo actualizar el estado",
        variant: "destructive",
      });
    },
  });

  const handleCreateProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Parse images array
    const imagesString = formData.get("images") as string;
    const images = imagesString ? imagesString.split('\n').filter(url => url.trim()) : [];
    
    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: parseFloat(formData.get("price") as string),
      categoryId: parseInt(formData.get("categoryId") as string),
      sku: formData.get("sku") as string || null,
      brand: formData.get("brand") as string || null,
      model: formData.get("model") as string || null,
      weight: formData.get("weight") as string || null,
      dimensions: formData.get("dimensions") as string || null,
      images: images,
      isActive: true,
      storeId: storeId,
    };
    
    createProductMutation.mutate(data);
  };

  const handleUpdateProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct) return;
    
    const formData = new FormData(e.currentTarget);
    
    // Parse images array
    const imagesString = formData.get("images") as string;
    const images = imagesString ? imagesString.split('\n').filter(url => url.trim()) : [];
    
    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      price: parseFloat(formData.get("price") as string),
      categoryId: parseInt(formData.get("categoryId") as string),
      sku: formData.get("sku") as string || null,
      brand: formData.get("brand") as string || null,
      model: formData.get("model") as string || null,
      weight: formData.get("weight") as string || null,
      dimensions: formData.get("dimensions") as string || null,
      images: images,
    };
    
    updateProductMutation.mutate({ id: selectedProduct.id, data });
  };

  // Filter products
  const filteredProducts = Array.isArray(products) ? products.filter((product: Product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || 
                           product.categoryId.toString() === selectedCategory;
    
    return matchesSearch && matchesCategory;
  }) : [];

  if (!storeId) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600">No se especificó una tienda válida</p>
          <Button onClick={() => window.history.back()} className="mt-4">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (productsLoading || categoriesLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Productos de Tienda</h1>
          <p className="text-gray-600 mt-2">
            {store?.name || "Tienda"} • Gestiona el catálogo de productos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.history.back()} variant="outline">
            Volver
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Producto</DialogTitle>
                <DialogDescription>
                  Completa la información para crear un nuevo producto
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre del Producto</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div>
                    <Label htmlFor="price">Precio</Label>
                    <Input id="price" name="price" type="number" step="0.01" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="categoryId">Categoría</Label>
                    <Select name="categoryId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(categories) && categories.map((category: Category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sku">SKU</Label>
                    <Input id="sku" name="sku" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="brand">Marca</Label>
                    <Input id="brand" name="brand" />
                  </div>
                  <div>
                    <Label htmlFor="model">Modelo</Label>
                    <Input id="model" name="model" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="weight">Peso</Label>
                    <Input id="weight" name="weight" placeholder="ej: 2.5 kg" />
                  </div>
                  <div>
                    <Label htmlFor="dimensions">Dimensiones</Label>
                    <Input id="dimensions" name="dimensions" placeholder="ej: 30x20x15 cm" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea id="description" name="description" required />
                </div>
                <div>
                  <Label htmlFor="images">URLs de Imágenes (una por línea)</Label>
                  <Textarea 
                    id="images" 
                    name="images" 
                    placeholder="https://ejemplo.com/imagen1.jpg&#10;https://ejemplo.com/imagen2.jpg"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createProductMutation.isPending}>
                    {createProductMutation.isPending ? "Creando..." : "Crear Producto"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(products) ? products.length : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
            <Eye className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Array.isArray(products) ? products.filter((p: Product) => p.isActive).length : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(categories) ? categories.length : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Array.isArray(products) ? products.reduce((sum: number, p: Product) => sum + p.price, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : "0.00"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {Array.isArray(categories) && categories.map((category: Category) => (
              <SelectItem key={category.id} value={category.id.toString()}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product: Product) => (
          <Card key={product.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <CardDescription>
                    {product.categoryName} • SKU: {product.sku || "N/A"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={product.isActive ? "default" : "secondary"}>
                    {product.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                  <Switch
                    checked={product.isActive}
                    onCheckedChange={(checked) => 
                      toggleStatusMutation.mutate({ id: product.id, isActive: checked })
                    }
                    disabled={toggleStatusMutation.isPending}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Product Image */}
              {product.images && product.images.length > 0 && (
                <div className="mb-4">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-48 object-cover rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                
                {product.brand && (
                  <p className="text-sm"><strong>Marca:</strong> {product.brand}</p>
                )}
                
                {product.model && (
                  <p className="text-sm"><strong>Modelo:</strong> {product.model}</p>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-green-600">
                    ${product.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                  {product.images && product.images.length > 1 && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Image className="h-3 w-3" />
                      {product.images.length} fotos
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProduct(product);
                    setShowEditDialog(true);
                  }}
                  className="flex items-center gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("¿Estás seguro de que quieres eliminar este producto?")) {
                      deleteProductMutation.mutate(product.id);
                    }
                  }}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700"
                  disabled={deleteProductMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron productos</h3>
          <p className="text-gray-600">
            {searchTerm || selectedCategory !== "all" 
              ? "No hay productos que coincidan con los filtros seleccionados"
              : "Esta tienda no tiene productos registrados"
            }
          </p>
        </div>
      )}

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Modifica la información del producto
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Nombre del Producto</Label>
                  <Input 
                    id="edit-name" 
                    name="name" 
                    defaultValue={selectedProduct.name}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit-price">Precio</Label>
                  <Input 
                    id="edit-price" 
                    name="price" 
                    type="number" 
                    step="0.01"
                    defaultValue={selectedProduct.price}
                    required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-categoryId">Categoría</Label>
                  <Select name="categoryId" defaultValue={selectedProduct.categoryId.toString()}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(categories) && categories.map((category: Category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-sku">SKU</Label>
                  <Input 
                    id="edit-sku" 
                    name="sku"
                    defaultValue={selectedProduct.sku || ""}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-brand">Marca</Label>
                  <Input 
                    id="edit-brand" 
                    name="brand"
                    defaultValue={selectedProduct.brand || ""}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-model">Modelo</Label>
                  <Input 
                    id="edit-model" 
                    name="model"
                    defaultValue={selectedProduct.model || ""}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-weight">Peso</Label>
                  <Input 
                    id="edit-weight" 
                    name="weight"
                    defaultValue={selectedProduct.weight || ""}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-dimensions">Dimensiones</Label>
                  <Input 
                    id="edit-dimensions" 
                    name="dimensions"
                    defaultValue={selectedProduct.dimensions || ""}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea 
                  id="edit-description" 
                  name="description"
                  defaultValue={selectedProduct.description}
                  required 
                />
              </div>
              <div>
                <Label htmlFor="edit-images">URLs de Imágenes (una por línea)</Label>
                <Textarea 
                  id="edit-images" 
                  name="images"
                  defaultValue={selectedProduct.images ? selectedProduct.images.join('\n') : ""}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateProductMutation.isPending}>
                  {updateProductMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}