import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Eye, Package, Image, Upload, X, ShoppingCart, Folder, FolderPlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";

// Esquemas de validación
const productFormSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().transform(val => val === "" ? null : val).nullable(),
  category: z.string().min(1, "La categoría es obligatoria"),
  price: z.string().min(1, "El precio es obligatorio"),
  brand: z.string().transform(val => val === "" ? null : val).nullable(),
  model: z.string().transform(val => val === "" ? null : val).nullable(),
  sku: z.string().transform(val => val === "" ? null : val).nullable(),
  status: z.string().default("active"),
  availability: z.string().default("available"),
  stockQuantity: z.number().min(0).default(0),
  minQuantity: z.number().min(0).default(0),
  maxQuantity: z.number().nullable().default(null),
  weight: z.string().transform(val => val === "" ? null : val).nullable(),
  warranty: z.string().transform(val => val === "" ? null : val).nullable(),
  features: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  imageUrl: z.string().transform(val => val === "" ? null : val).nullable(),
  salePrice: z.string().transform(val => val === "" ? null : val).nullable(),
  isPromoted: z.boolean().default(false),
  promotionText: z.string().transform(val => val === "" ? null : val).nullable()
});

const categoryFormSchema = z.object({
  name: z.string().min(1, "El nombre de la categoría es obligatorio"),
  description: z.string().nullable().default("")
});

type ProductFormData = z.infer<typeof productFormSchema>;
type CategoryFormData = z.infer<typeof categoryFormSchema>;

interface Product {
  id: number;
  name: string;
  description: string | null;
  category: string;
  price: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
  status: string;
  availability: string;
  stockQuantity: number;
  minQuantity: number;
  maxQuantity: number | null;
  weight: string | null;
  warranty: string | null;
  features: string[] | null;
  tags: string[] | null;
  images: string[] | null;
  imageUrl: string | null;
  salePrice: string | null;
  isPromoted: boolean;
  promotionText: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface Category {
  id: number;
  name: string;
  description: string | null;
}

export default function ProductManagement() {
  const [activeTab, setActiveTab] = useState("products");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Estados para categorías
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [selectedCategoryEdit, setSelectedCategoryEdit] = useState<Category | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Formularios
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      price: "",
      brand: "",
      model: "",
      sku: "",
      status: "active",
      availability: "available",
      stockQuantity: 0,
      minQuantity: 0,
      maxQuantity: null,
      weight: "",
      warranty: "",
      features: [],
      tags: [],
      images: [],
      imageUrl: "",
      salePrice: "",
      isPromoted: false,
      promotionText: ""
    }
  });

  const categoryForm = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      description: ""
    }
  });

  // Queries
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => apiRequest("GET", "/api/products")
  });

  const { data: categories = [], isLoading: isLoadingCategories, refetch: refetchCategories } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories", {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 0, // Siempre considerar datos como obsoletos
    gcTime: 0,    // TanStack Query v5 usa gcTime en lugar de cacheTime
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Asegurar que los datos sean arrays
  const productsList = Array.isArray(products) ? products : [];
  const categoriesList = Array.isArray(categories) ? categories : [];

  // Mutations para productos
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      return apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Producto creado",
        description: "El producto se ha creado exitosamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el producto",
        variant: "destructive"
      });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async (data: ProductFormData & { id: number }) => {
      console.log('updateProductMutation called with data:', data);
      const result = await apiRequest("PUT", `/api/products/${data.id}`, data);
      console.log('updateProductMutation result:', result);
      return result;
    },
    onSuccess: () => {
      console.log('updateProductMutation success');
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsEditDialogOpen(false);
      setSelectedProduct(null);
      form.reset();
      toast({
        title: "Producto actualizado",
        description: "El producto se ha actualizado exitosamente."
      });
    },
    onError: (error: any) => {
      console.log('updateProductMutation error:', error);
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el producto",
        variant: "destructive"
      });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Producto eliminado",
        description: "El producto se ha eliminado exitosamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el producto",
        variant: "destructive"
      });
    }
  });

  // Mutations para categorías
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      return apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      refetchCategories(); // Forzar recarga inmediata
      setIsCategoryDialogOpen(false);
      categoryForm.reset();
      toast({
        title: "Categoría creada",
        description: "La categoría se ha creado exitosamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear la categoría",
        variant: "destructive"
      });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      return apiRequest("PUT", `/api/categories/${selectedCategoryEdit?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsCategoryDialogOpen(false);
      setSelectedCategoryEdit(null);
      categoryForm.reset();
      toast({
        title: "Categoría actualizada",
        description: "La categoría se ha actualizado exitosamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la categoría",
        variant: "destructive"
      });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Categoría eliminada",
        description: "La categoría se ha eliminado exitosamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar la categoría",
        variant: "destructive"
      });
    }
  });

  // Funciones auxiliares
  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    form.reset({
      name: product.name,
      description: product.description || "",
      category: product.category,
      price: product.price,
      brand: product.brand || "",
      model: product.model || "",
      sku: product.sku || "",
      status: product.status,
      availability: product.availability,
      stockQuantity: product.stockQuantity,
      minQuantity: product.minQuantity,
      maxQuantity: product.maxQuantity,
      weight: product.weight || "",
      warranty: product.warranty || "",
      features: product.features || [],
      tags: product.tags || [],
      images: product.images || [],
      salePrice: product.salePrice || "",
      isPromoted: product.isPromoted,
      promotionText: product.promotionText || ""
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (product: Product) => {
    setSelectedProduct(product);
    setIsViewDialogOpen(true);
  };

  const openCategoryCreateDialog = () => {
    setSelectedCategoryEdit(null);
    categoryForm.reset();
    setIsCategoryDialogOpen(true);
  };

  const openCategoryEditDialog = (category: Category) => {
    setSelectedCategoryEdit(category);
    categoryForm.reset({
      name: category.name,
      description: category.description || ""
    });
    setIsCategoryDialogOpen(true);
  };

  const resetCategoryForm = () => {
    setIsCategoryDialogOpen(false);
    setSelectedCategoryEdit(null);
    categoryForm.reset();
  };

  // Filtros
  const filteredProducts = productsList.filter((product: Product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesCategory = !selectedCategory || selectedCategory === "all" || product.category === selectedCategory;
    const matchesStatus = !selectedStatus || selectedStatus === "all_status" || product.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const onSubmit = (data: ProductFormData) => {
    console.log('onSubmit called with data:', data);
    console.log('selectedProduct:', selectedProduct);
    
    if (selectedProduct) {
      console.log('Updating product with ID:', selectedProduct.id);
      updateProductMutation.mutate({ ...data, id: selectedProduct.id });
    } else {
      console.log('Creating new product');
      createProductMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Productos</h1>
          <p className="text-muted-foreground">
            Gestiona tu catálogo de productos, servicios y categorías
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/simple-catalog" target="_blank">
            <Button variant="outline">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Ver Catálogo
            </Button>
          </Link>
          {activeTab === "products" && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Producto
            </Button>
          )}
          {activeTab === "categories" && (
            <Button onClick={openCategoryCreateDialog}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Crear Categoría
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Folder className="w-4 h-4" />
            Categorías
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categoriesList.map((category: Category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_status">Todos los estados</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista de productos */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product: Product) => (
              <Card key={product.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {product.description}
                      </CardDescription>
                    </div>
                    <Badge variant={product.status === "active" ? "default" : "secondary"}>
                      {product.status === "active" ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Galería de imágenes */}
                    {product.images && product.images.length > 0 && (
                      <div className="space-y-2">
                        <div className="w-full h-32 rounded-md overflow-hidden bg-gray-100">
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                        {product.images.length > 1 && (
                          <div className="flex gap-1">
                            {product.images.slice(1).map((url: string, index: number) => (
                              <div key={index} className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 border">
                                <img
                                  src={url}
                                  alt={`${product.name} ${index + 2}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              </div>
                            ))}
                            {product.images.length > 3 && (
                              <div className="w-12 h-12 rounded-md bg-gray-200 border flex items-center justify-center text-xs text-gray-600">
                                +{product.images.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Categoría:</span>
                        <span>{product.category}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Precio:</span>
                        <span className="font-medium">${product.price}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Stock:</span>
                        <span>{product.stockQuantity}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openViewDialog(product)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(product)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteProductMutation.mutate(product.id)}
                        disabled={deleteProductMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <Card className="p-8 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay productos</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primer producto para empezar a gestionar tu catálogo
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Primer Producto
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categoriesList.map((category: Category) => (
              <Card key={category.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Folder className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCategoryEditDialog(category)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteCategoryMutation.mutate(category.id)}
                      disabled={deleteCategoryMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {categoriesList.length === 0 && (
            <Card className="p-8 text-center">
              <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay categorías</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primera categoría para organizar tus productos
              </p>
              <Button onClick={openCategoryCreateDialog}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Crear Primera Categoría
              </Button>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Diálogo para crear/editar productos */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setSelectedProduct(null);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? "Editar Producto" : "Crear Nuevo Producto"}
            </DialogTitle>
            <DialogDescription>
              Completa la información del producto. Los campos marcados con * son obligatorios.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Producto *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Mini Split 12,000 BTU" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoriesList.map((category: Category) => (
                            <SelectItem key={category.id} value={category.name}>
                              {category.name}
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
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Samsung, LG, Carrier" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: AR12KVSPBSN" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU / Código</FormLabel>
                      <FormControl>
                        <Input placeholder="Código único del producto" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stockQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inventario</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descripción del producto..."
                        className="min-h-[80px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="images"
                render={({ field }) => {
                  const images = field.value || [];
                  const addImage = (url: string) => {
                    if (url && images.length < 3 && !images.includes(url)) {
                      field.onChange([...images, url]);
                    }
                  };
                  const removeImage = (index: number) => {
                    const newImages = images.filter((_: string, i: number) => i !== index);
                    field.onChange(newImages);
                  };

                  return (
                    <FormItem>
                      <FormLabel>Imágenes del Producto (máximo 3)</FormLabel>
                      <div className="space-y-3">
                        {/* Mostrar imágenes existentes */}
                        {images.length > 0 && (
                          <div className="grid grid-cols-3 gap-3">
                            {images.map((url: string, index: number) => (
                              <div key={index} className="relative">
                                <div className="w-full h-24 rounded-md overflow-hidden bg-gray-100 border">
                                  <img
                                    src={url}
                                    alt={`Imagen ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                    }}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0"
                                  onClick={() => removeImage(index)}
                                >
                                  ×
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Campo para agregar nueva imagen */}
                        {images.length < 3 && (
                          <div className="flex gap-2">
                            <Input
                              type="url"
                              placeholder="https://ejemplo.com/imagen.jpg"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const input = e.target as HTMLInputElement;
                                  addImage(input.value);
                                  input.value = '';
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                addImage(input.value);
                                input.value = '';
                              }}
                            >
                              Agregar
                            </Button>
                          </div>
                        )}
                        
                        <p className="text-sm text-muted-foreground">
                          {images.length}/3 imágenes. Presiona Enter o haz clic en "Agregar" para añadir una imagen.
                        </p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setIsEditDialogOpen(false);
                    setSelectedProduct(null);
                    form.reset();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                  onClick={() => {
                    console.log('Button clicked!');
                    console.log('Form errors:', form.formState.errors);
                    console.log('Form values:', form.getValues());
                    console.log('Selected product:', selectedProduct);
                  }}
                >
                  {selectedProduct
                    ? (updateProductMutation.isPending ? "Actualizando..." : "Actualizar Producto")
                    : (createProductMutation.isPending ? "Creando..." : "Crear Producto")
                  }
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para gestionar categorías */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCategoryEdit ? "Editar Categoría" : "Crear Nueva Categoría"}
            </DialogTitle>
            <DialogDescription>
              {selectedCategoryEdit
                ? "Modifica la información de la categoría"
                : "Completa la información de la nueva categoría"
              }
            </DialogDescription>
          </DialogHeader>

          <Form {...categoryForm}>
            <form
              onSubmit={categoryForm.handleSubmit(
                selectedCategoryEdit
                  ? (data) => updateCategoryMutation.mutate(data)
                  : (data) => createCategoryMutation.mutate(data)
              )}
              className="space-y-4"
            >
              <FormField
                control={categoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Categoría *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Aires Acondicionados" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={categoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descripción opcional de la categoría"
                        className="min-h-[80px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetCategoryForm}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                >
                  {selectedCategoryEdit
                    ? (updateCategoryMutation.isPending ? "Actualizando..." : "Actualizar")
                    : (createCategoryMutation.isPending ? "Creando..." : "Crear")
                  }
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de vista del producto */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Producto</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-6">
              {/* Galería de imágenes */}
              {selectedProduct.images && selectedProduct.images.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Imágenes</h3>
                  <div className="grid gap-4">
                    {/* Imagen principal */}
                    <div className="w-full h-64 rounded-lg overflow-hidden bg-gray-100 border">
                      <img
                        src={selectedProduct.images[0]}
                        alt={selectedProduct.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                    {/* Miniaturas */}
                    {selectedProduct.images.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {selectedProduct.images.slice(1).map((url: string, index: number) => (
                          <div key={index} className="aspect-square rounded-md overflow-hidden bg-gray-100 border">
                            <img
                              src={url}
                              alt={`${selectedProduct.name} ${index + 2}`}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                // Intercambiar imagen principal con la seleccionada
                                const newImages = [...selectedProduct.images!];
                                [newImages[0], newImages[index + 1]] = [newImages[index + 1], newImages[0]];
                                setSelectedProduct({ ...selectedProduct, images: newImages });
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Información del producto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Información General</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nombre:</span>
                        <span className="font-medium">{selectedProduct.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Categoría:</span>
                        <span>{selectedProduct.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Precio:</span>
                        <span className="font-medium text-green-600">${selectedProduct.price}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estado:</span>
                        <Badge variant={selectedProduct.status === "active" ? "default" : "secondary"}>
                          {selectedProduct.status === "active" ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      {selectedProduct.sku && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SKU:</span>
                          <span>{selectedProduct.sku}</span>
                        </div>
                      )}
                      {selectedProduct.brand && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Marca:</span>
                          <span>{selectedProduct.brand}</span>
                        </div>
                      )}
                      {selectedProduct.model && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Modelo:</span>
                          <span>{selectedProduct.model}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Inventario</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stock:</span>
                        <span>{selectedProduct.stockQuantity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Disponibilidad:</span>
                        <span>{selectedProduct.availability}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cantidad mínima:</span>
                        <span>{selectedProduct.minQuantity}</span>
                      </div>
                      {selectedProduct.maxQuantity && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cantidad máxima:</span>
                          <span>{selectedProduct.maxQuantity}</span>
                        </div>
                      )}
                      {selectedProduct.weight && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Peso:</span>
                          <span>{selectedProduct.weight} kg</span>
                        </div>
                      )}
                      {selectedProduct.warranty && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Garantía:</span>
                          <span>{selectedProduct.warranty}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {selectedProduct.description && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Descripción</h3>
                  <p className="text-muted-foreground">{selectedProduct.description}</p>
                </div>
              )}

              {selectedProduct.features && selectedProduct.features.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Características</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedProduct.features.map((feature: string, index: number) => (
                      <li key={index} className="text-muted-foreground">{feature}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Etiquetas</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.tags.map((tag: string, index: number) => (
                      <Badge key={index} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}