import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Save,
  Upload,
  X,
  Plus,
  Package,
  DollarSign,
  Tag,
  Settings,
  RefreshCw,
} from "lucide-react";

// Función personalizada para manejar FormData
const apiRequestFormData = async (method: string, url: string, formData: FormData) => {
  const token = localStorage.getItem("auth_token");
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      // NO establecer Content-Type para FormData - el navegador lo hace automáticamente
    },
    body: formData,
  };

  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  console.log(`🔗 ${method} ${fullUrl} (FormData)`);
  
  // Log del FormData (sin iterar)
  console.log('📦 FormData preparado para envío');

  const response = await fetch(fullUrl, options);

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      message = errJson?.message || errJson?.error || JSON.stringify(errJson);
    } catch {
      // Si no es JSON, usar el statusText
    }
    throw new Error(message);
  }

  return response.json();
};

// Schema de validación para el formulario
const productSchema = z.object({
  name: z.string().min(1, "El nombre del producto es requerido"),
  description: z.string().min(1, "La descripción es requerida"),
  price: z.string().min(1, "El precio es requerido"),
  category: z.string().min(1, "La categoría es requerida"),
  type: z.string().default("product"),
  brand: z.string().optional(),
  model: z.string().optional(),
  sku: z.string().optional(),
  isActive: z.boolean().default(true),
  stock: z.number().min(0, "El stock no puede ser negativo").default(0),
  specifications: z.string().optional(),
  installationCost: z.string().optional(),
  warrantyMonths: z.number().min(0).default(0),
  imageUrl: z.string().optional(),
  images: z.array(z.string()).default([]),
  features: z.string().optional(),
  warranty: z.string().optional(),
  availability: z.string().default("in_stock"),
  stockQuantity: z.number().min(0).default(0),
  minQuantity: z.number().min(1).default(1),
  maxQuantity: z.number().optional(),
  weight: z.string().optional(),
  dimensions: z.string().optional(),
  tags: z.string().optional(),
  salePrice: z.string().optional(),
  isPromoted: z.boolean().default(false),
  promotionText: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ImageData {
  id: string;
  url: string;
  file?: File;
  isUploaded: boolean;
  source: 'file' | 'url';
  name: string;
}

interface Category {
  id: number;
  name: string;
  description?: string;
}

export default function AddProductPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth(); // Obtener usuario autenticado
  const [productImages, setProductImages] = useState<ImageData[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  
  // Estados para manejo de marcas
  const [existingBrands, setExistingBrands] = useState<string[]>([]);
  const [brandInput, setBrandInput] = useState("");
  const [showBrandInput, setShowBrandInput] = useState(false);

  // Verificar que el usuario tenga storeId
  if (!user?.storeId) {
    toast({
      title: "Error de autenticación",
      description: "No se pudo identificar la tienda del usuario",
      variant: "destructive",
    });
    setLocation("/dashboard");
    return null;
  }

  // Obtener categorías
  const { data: categories = [], isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Obtener productos existentes
  const { data: products = [] } = useQuery({
    queryKey: ["/api/products"],
  });

  // Extraer marcas únicas usando useEffect para evitar bucles infinitos
  useEffect(() => {
    if (products && Array.isArray(products) && products.length > 0) {
      const uniqueBrands = new Set(
        products
          .map((product: any) => product.brand)
          .filter((brand: string) => brand && typeof brand === 'string' && brand.trim() !== "")
      );
      const brands = Array.from(uniqueBrands).sort() as string[];
      setExistingBrands(brands);
    }
  }, [products]);

  // Log para debugging de categorías
  console.log('📂 Categorías cargadas:', categories);
  console.log('📂 Número de categorías:', Array.isArray(categories) ? categories.length : 0);
  console.log('📂 Marcas existentes:', existingBrands);

  // Función para generar SKU automático
  const generateSKU = () => {
    const formValues = watch();
    const category = formValues.category;
    const name = formValues.name;
    const brand = formValues.brand || brandInput;
    
    if (!category || !name) {
      return "";
    }
    
    // Crear SKU: CATEGORIA-MARCA-NOMBRE-RANDOM
    const categoryCode = category.substring(0, 3).toUpperCase();
    const brandCode = brand ? brand.substring(0, 3).toUpperCase() : "GEN";
    const nameCode = name.substring(0, 3).toUpperCase();
    const randomCode = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    return `${categoryCode}-${brandCode}-${nameCode}-${randomCode}`;
  };

  // Función para manejar selección/creación de marca
  const handleBrandSelection = (value: string) => {
    if (value === "new_brand") {
      setShowBrandInput(true);
      setBrandInput("");
      setValue("brand", "");
    } else {
      setShowBrandInput(false);
      setBrandInput("");
      setValue("brand", value);
    }
  };

  // Función para agregar nueva marca
  const handleAddNewBrand = () => {
    if (brandInput.trim()) {
      const newBrand = brandInput.trim();
      setExistingBrands((prev: string[]) => [...prev, newBrand].sort());
      setValue("brand", newBrand);
      setShowBrandInput(false);
      setBrandInput("");
      toast({
        title: "Marca agregada",
        description: `La marca "${newBrand}" ha sido agregada a la lista`,
      });
    }
  };

  // Configurar el formulario con react-hook-form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      type: "product",
      isActive: true,
      stock: 0,
      warrantyMonths: 0,
      availability: "in_stock",
      stockQuantity: 0,
      minQuantity: 1,
      isPromoted: false,
      images: [],
    },
  });

  // Observar valores del formulario
  const watchedValues = watch();

  // Mutation para crear producto
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      console.log('🔄 Iniciando mutation con datos:', data);
      setIsProcessingImages(true);

      try {
        // TEMPORAL: Enviar como JSON en lugar de FormData para debugging
        const productData = {
          // Campos básicos (REQUERIDOS por el backend)
          name: data.name,
          description: data.description,
          price: data.price,
          category: data.category,
          
          // Campos del backend según routes.ts
          status: "active", // backend espera 'status', no 'isActive'
          availability: data.availability || "in_stock",
          stockQuantity: data.stockQuantity || 0,
          minQuantity: data.minQuantity || 1,
          maxQuantity: data.maxQuantity || null,
          
          // Campos opcionales
          type: data.type || "product",
          brand: data.brand || null,
          model: data.model || null,
          sku: data.sku || null,
          specifications: data.specifications || null,
          installationCost: data.installationCost || null,
          warrantyMonths: data.warrantyMonths || 0,
          features: data.features || null,
          warranty: data.warranty || null,
          weight: data.weight || null,
          dimensions: data.dimensions || null,
          tags: data.tags || null,
          salePrice: data.salePrice || null,
          isPromoted: data.isPromoted || false,
          promotionText: data.promotionText || null,
          
          // Imágenes (por ahora vacío)
          imageUrl: null,
          images: null
        };

        console.log('📦 Datos que se enviarán como JSON:', productData);
        
        // Verificar que el token esté presente
        const token = localStorage.getItem("auth_token");
        if (!token) {
          throw new Error("No hay token de autenticación");
        }

        console.log('🔑 Enviando con token de autenticación');
        
        try {
          const response = await apiRequest("POST", "/api/products", productData);
          console.log('✅ Respuesta del servidor:', response);
          return response;
        } catch (error) {
          console.error('❌ Error detallado en la petición:', error);
          console.error('❌ Mensaje del error:', error.message);
          
          // Si el error contiene información de JSON, intentar parsearlo
          if (error.message.includes('{')) {
            try {
              const errorJson = JSON.parse(error.message);
              console.error('❌ Error JSON parseado:', errorJson);
            } catch (parseError) {
              console.error('❌ No se pudo parsear el error como JSON');
            }
          }
          
          throw error;
        }
      } catch (error) {
        console.error('❌ Error en mutation:', error);
        throw error;
      } finally {
        setIsProcessingImages(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "✅ Producto creado",
        description: "El producto se ha creado exitosamente.",
      });
      setLocation("/product-management");
    },
    onError: (error: any) => {
      console.error('🔥 Error en la mutation:', error);
      console.error('🔥 Tipo de error:', typeof error);
      console.error('🔥 Error stack:', error.stack);
      
      let errorMessage = "Error al crear el producto";
      
      if (error.message) {
        errorMessage = error.message;
        
        // Si contiene JSON, intentar extraer el mensaje
        if (error.message.includes('error')) {
          try {
            const errorData = JSON.parse(error.message);
            errorMessage = errorData.error || errorData.message || error.message;
          } catch (parseError) {
            // Usar el mensaje original si no se puede parsear
          }
        }
      }
      
      toast({
        title: "❌ Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Función para manejar la subida de imágenes
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const id = `file-${Date.now()}-${Math.random()}`;
      const url = URL.createObjectURL(file);
      
      setProductImages((prev) => [
        ...prev,
        {
          id,
          url,
          file,
          isUploaded: false,
          source: 'file',
          name: file.name,
        },
      ]);
    });
  };

  // Función para agregar imagen por URL
  const handleAddImageUrl = () => {
    const url = prompt("Ingresa la URL de la imagen:");
    if (url && url.trim()) {
      const id = `url-${Date.now()}-${Math.random()}`;
      setProductImages((prev) => [
        ...prev,
        {
          id,
          url: url.trim(),
          isUploaded: true,
          source: 'url',
          name: 'Imagen externa',
        },
      ]);
    }
  };

  // Función para eliminar imagen
  const removeImage = (id: string) => {
    setProductImages((prev) => {
      const imageToRemove = prev.find(img => img.id === id);
      if (imageToRemove?.file && imageToRemove.url.startsWith('blob:')) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  // Handler para el click del botón
  const handleCreateProduct = async () => {
    console.log('🔘 Botón "Crear Producto" clickeado');
    
    // Verificar autenticación
    const token = localStorage.getItem("auth_token");
    console.log('🔑 Token presente:', !!token);
    console.log('👤 Usuario autenticado:', !!user);
    console.log('🏪 StoreId del usuario:', user?.storeId);
    
    if (!token) {
      toast({
        title: "Error de autenticación",
        description: "No hay token de autenticación",
        variant: "destructive",
      });
      return;
    }
    
    if (!user?.storeId) {
      toast({
        title: "Error de autenticación", 
        description: "Usuario sin storeId",
        variant: "destructive",
      });
      return;
    }
    
    // Obtener valores actuales del formulario
    const formValues = watch();
    console.log('📝 Valores del formulario:', formValues);
    
    // Verificar errores del formulario
    const hasErrors = Object.keys(errors).length > 0;
    console.log('❌ Errores del formulario:', errors);
    
    if (hasErrors) {
      console.error('🚫 Formulario tiene errores, no se puede enviar');
      toast({
        title: "Error en el formulario",
        description: "Por favor corrige los errores antes de continuar",
        variant: "destructive",
      });
      return;
    }
    
    // Llamar a handleSubmit de react-hook-form
    await handleSubmit(onSubmit)();
  };

  // Función para enviar el formulario
  const onSubmit = (data: ProductFormData) => {
    console.log('🚀 onSubmit llamado con datos:', data);
    console.log('📂 Categoría en data:', data.category);
    console.log('📂 Todas las categorías disponibles:', categories.map(c => c.name));

    // Validaciones adicionales antes de enviar
    if (!user?.storeId) {
      console.error('❌ No hay storeId del usuario');
      toast({
        title: "Error de autenticación",
        description: "No se pudo identificar la tienda del usuario",
        variant: "destructive",
      });
      return;
    }

    if (!data.name || !data.name.trim()) {
      console.error('❌ Nombre vacío o inválido:', data.name);
      toast({
        title: "Error de validación",
        description: "El nombre del producto es requerido",
        variant: "destructive",
      });
      return;
    }

    if (!data.description || !data.description.trim()) {
      console.error('❌ Descripción vacía o inválida:', data.description);
      toast({
        title: "Error de validación", 
        description: "La descripción del producto es requerida",
        variant: "destructive",
      });
      return;
    }

    if (!data.price || !data.price.trim()) {
      console.error('❌ Precio vacío o inválido:', data.price);
      toast({
        title: "Error de validación",
        description: "El precio del producto es requerido", 
        variant: "destructive",
      });
      return;
    }

    if (!data.category || !data.category.trim()) {
      console.error('❌ Categoría vacía o inválida:', data.category);
      toast({
        title: "Error de validación",
        description: "La categoría del producto es requerida",
        variant: "destructive", 
      });
      return;
    }

    // Preparar datos finales
    const finalData = {
      ...data,
      // Asegurar que los campos básicos estén presentes
      name: data.name.trim(),
      description: data.description.trim(),
      price: data.price.trim(),
      category: data.category.trim(),
      type: data.type || "product",
      isActive: data.isActive !== undefined ? data.isActive : true,
      stock: data.stock || 0,
      stockQuantity: data.stockQuantity || 0,
      minQuantity: data.minQuantity || 1,
      warrantyMonths: data.warrantyMonths || 0,
      isPromoted: data.isPromoted || false,
      availability: data.availability || "in_stock"
    };

    console.log('✅ Validación pasada, datos finales:', finalData);
    console.log('📋 Resumen:', {
      storeId: user.storeId,
      name: finalData.name,
      category: finalData.category,
      price: finalData.price,
      imagesCount: productImages.length
    });
    
    try {
      createProductMutation.mutate(finalData);
    } catch (error) {
      console.error('❌ Error en mutate:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation("/product-management")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agregar Nuevo Producto</h1>
          <p className="text-gray-600">Completa la información del producto</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda - Información básica */}
          <div className="lg:col-span-2 space-y-6">
            {/* Información básica */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Información Básica
                </CardTitle>
                <CardDescription>
                  Datos principales del producto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="name">Nombre del producto *</Label>
                    <Input
                      id="name"
                      {...register("name")}
                      placeholder="Ej: iPhone 15 Pro Max"
                      className={errors.name ? "border-red-500" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="description">Descripción *</Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Describe las características principales del producto..."
                      rows={4}
                      className={errors.description ? "border-red-500" : ""}
                    />
                    {errors.description && (
                      <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      {...register("brand")}
                      placeholder="Ej: Apple, Samsung, etc."
                    />
                  </div>

                  <div>
                    <Label htmlFor="model">Modelo</Label>
                    <Input
                      id="model"
                      {...register("model")}
                      placeholder="Ej: A2345, SM-G998B, etc."
                    />
                  </div>

                  <div>
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      {...register("sku")}
                      placeholder="Código único del producto"
                    />
                  </div>

                  <div>
                    <Label htmlFor="category">Categoría *</Label>
                    <Select 
                      value={watchedValues.category || ""} 
                      onValueChange={(value) => {
                        console.log('📝 Categoría seleccionada:', value);
                        setValue("category", value, { shouldValidate: true });
                      }}
                    >
                      <SelectTrigger className={errors.category ? "border-red-500" : ""}>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(categories) && categories.map((category: Category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.category && (
                      <p className="text-sm text-red-500 mt-1">{errors.category.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Precios y Stock */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Precios y Stock
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="price">Precio *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      {...register("price")}
                      placeholder="0.00"
                      className={errors.price ? "border-red-500" : ""}
                    />
                    {errors.price && (
                      <p className="text-sm text-red-500 mt-1">{errors.price.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="salePrice">Precio de oferta</Label>
                    <Input
                      id="salePrice"
                      type="number"
                      step="0.01"
                      {...register("salePrice")}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="installationCost">Costo de instalación</Label>
                    <Input
                      id="installationCost"
                      type="number"
                      step="0.01"
                      {...register("installationCost")}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="stockQuantity">Stock actual</Label>
                    <Input
                      id="stockQuantity"
                      type="number"
                      {...register("stockQuantity", { valueAsNumber: true })}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="minQuantity">Cantidad mínima</Label>
                    <Input
                      id="minQuantity"
                      type="number"
                      {...register("minQuantity", { valueAsNumber: true })}
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="maxQuantity">Cantidad máxima</Label>
                    <Input
                      id="maxQuantity"
                      type="number"
                      {...register("maxQuantity", { valueAsNumber: true })}
                      placeholder="Sin límite"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="availability">Disponibilidad</Label>
                  <Select onValueChange={(value) => setValue("availability", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar disponibilidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_stock">En stock</SelectItem>
                      <SelectItem value="out_of_stock">Agotado</SelectItem>
                      <SelectItem value="pre_order">Pre-orden</SelectItem>
                      <SelectItem value="discontinued">Descontinuado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Especificaciones técnicas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Especificaciones Técnicas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="specifications">Especificaciones</Label>
                    <Textarea
                      id="specifications"
                      {...register("specifications")}
                      placeholder="Especificaciones técnicas detalladas..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="features">Características</Label>
                    <Textarea
                      id="features"
                      {...register("features")}
                      placeholder="Características principales..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="weight">Peso</Label>
                    <Input
                      id="weight"
                      {...register("weight")}
                      placeholder="Ej: 200g, 1.5kg"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dimensions">Dimensiones</Label>
                    <Input
                      id="dimensions"
                      {...register("dimensions")}
                      placeholder="Ej: 15x10x5 cm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="warranty">Garantía</Label>
                    <Input
                      id="warranty"
                      {...register("warranty")}
                      placeholder="Ej: 12 meses, 2 años"
                    />
                  </div>

                  <div>
                    <Label htmlFor="warrantyMonths">Garantía (meses)</Label>
                    <Input
                      id="warrantyMonths"
                      type="number"
                      {...register("warrantyMonths", { valueAsNumber: true })}
                      placeholder="12"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="tags">Etiquetas</Label>
                    <Input
                      id="tags"
                      {...register("tags")}
                      placeholder="Separadas por comas: nuevo, popular, oferta"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Columna derecha - Imágenes y configuración */}
          <div className="space-y-6">
            {/* Gestión de imágenes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Imágenes del Producto
                </CardTitle>
                <CardDescription>
                  Sube o agrega URLs de imágenes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Botones para agregar imágenes */}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => document.getElementById('image-upload')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Subir desde archivo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleAddImageUrl}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar por URL
                  </Button>
                  <input
                    id="image-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                {/* Vista previa de imágenes */}
                {productImages.length > 0 && (
                  <div className="space-y-2">
                    <Label>Vista previa ({productImages.length})</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {productImages.map((image) => (
                        <div key={image.id} className="relative group">
                          <img
                            src={image.url}
                            alt={image.name}
                            className="w-full h-20 object-cover rounded border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(image.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configuración del producto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Configuración
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Producto activo</Label>
                    <p className="text-sm text-gray-600">
                      El producto será visible en el catálogo
                    </p>
                  </div>
                  <Switch
                    checked={watchedValues.isActive}
                    onCheckedChange={(checked) => setValue("isActive", checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Producto promocionado</Label>
                    <p className="text-sm text-gray-600">
                      Destacar este producto
                    </p>
                  </div>
                  <Switch
                    checked={watchedValues.isPromoted}
                    onCheckedChange={(checked) => setValue("isPromoted", checked)}
                  />
                </div>

                {watchedValues.isPromoted && (
                  <div>
                    <Label htmlFor="promotionText">Texto de promoción</Label>
                    <Input
                      id="promotionText"
                      {...register("promotionText")}
                      placeholder="¡Oferta especial!"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="type">Tipo de producto</Label>
                  <Select onValueChange={(value) => setValue("type", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Producto físico</SelectItem>
                      <SelectItem value="service">Servicio</SelectItem>
                      <SelectItem value="digital">Producto digital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Botones de acción */}
            <div className="space-y-2">
              <Button
                type="button"
                className="w-full"
                disabled={isSubmitting || isProcessingImages}
                onClick={handleCreateProduct}
              >
                {isSubmitting || isProcessingImages ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    {isProcessingImages ? "Procesando imágenes..." : "Creando producto..."}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Crear Producto
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/product-management")}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}