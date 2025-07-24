import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Badge,
} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Save,
  Plus,
  Upload,
  Link as LinkIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  Wand2,
  AlertCircle,
} from 'lucide-react';

// Schema de validación
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

interface Product {
  id: number;
  name: string;
  description?: string;
  price?: string;
  category?: string;
  type?: string;
  brand?: string;
  model?: string;
  sku?: string;
  isActive?: boolean;
  stock?: number;
  specifications?: string;
  installationCost?: string;
  warrantyMonths?: number;
  images?: string[];
  imageUrl?: string;
  features?: string;
  warranty?: string;
  availability?: string;
  stockQuantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  weight?: string;
  dimensions?: string;
  tags?: string;
  salePrice?: string;
  isPromoted?: boolean;
  promotionText?: string;
}

// Datos de ejemplo para demostración
const mockCategories: Category[] = [
  { id: 1, name: "Cámaras", description: "Cámaras de seguridad IP y análogas" },
  { id: 2, name: "Alarmas", description: "Sistemas de alarma y sensores" },
  { id: 3, name: "Servicios", description: "Servicios de instalación y mantenimiento" },
  { id: 4, name: "Accesorios", description: "Cables, soportes y accesorios" }
];

const mockBrands = ["Hikvision", "Dahua", "DSC", "Honeywell", "Bosch", "Axis", "Pelco"];

export default function EnhancedAddProduct() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados para determinar el modo (crear/editar)
  const [isEditMode, setIsEditMode] = useState(false);
  const [productId, setProductId] = useState<number | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  
  // Estados para gestión de imágenes
  const [productImages, setProductImages] = useState<ImageData[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  
  // Estados para manejo de marcas
  const [existingBrands, setExistingBrands] = useState<string[]>(mockBrands);
  const [brandInput, setBrandInput] = useState("");
  const [showBrandInput, setShowBrandInput] = useState(false);

  // Detectar modo desde URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const id = urlParams.get('id');
    
    console.log('🔍 Detectando modo desde URL:', { mode, id });
    
    if (mode === 'edit' && id) {
      setIsEditMode(true);
      setProductId(parseInt(id));
      console.log('✏️ Modo edición activado para producto ID:', parseInt(id));
    } else {
      console.log('➕ Modo creación activado');
    }
  }, []);

  // Usar datos mock para demostración
  const categories = mockCategories;
  const loadingCategories = false;

  // Simular producto para edición
  const mockProduct: Product = {
    id: 1,
    name: "Cámara de Seguridad IP 4K",
    description: "Cámara de alta resolución con visión nocturna y detección de movimiento",
    price: "2500",
    category: "Cámaras",
    type: "product",
    brand: "Hikvision",
    model: "DS-2CD2043G2",
    sku: "CAM-HIK-4K-001",
    isActive: true,
    stock: 15,
    specifications: "Resolución 4K, Visión nocturna 30m, IP67",
    installationCost: "500",
    warrantyMonths: 24,
    images: [
      "https://picsum.photos/400/300?random=1",
      "https://picsum.photos/400/300?random=2",
      "https://picsum.photos/400/300?random=3"
    ]
  };

  // Configurar formulario
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
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

  // Cargar datos del producto en modo edición
  useEffect(() => {
    if (isEditMode && productId) {
      setIsLoadingProduct(true);
      
      // Simular carga de datos
      setTimeout(() => {
        const product = mockProduct; // En producción sería una query real
        
        console.log('🔄 Cargando producto para edición:', product);
        console.log('📸 Imágenes del producto:', product.images);
        
        reset({
          name: product.name,
          description: product.description || "",
          price: product.price || "",
          category: product.category || "",
          type: product.type || "product",
          brand: product.brand || "",
          model: product.model || "",
          sku: product.sku || "",
          isActive: product.isActive ?? true,
          stock: product.stock || 0,
          specifications: product.specifications || "",
          installationCost: product.installationCost || "",
          warrantyMonths: product.warrantyMonths || 0,
          images: product.images || [],
        });

        // Cargar imágenes tanto del array images como del imageUrl
        const imagesToLoad = [];
        
        if (product.images && product.images.length > 0) {
          imagesToLoad.push(...product.images);
        }
        
        if (product.imageUrl && !imagesToLoad.includes(product.imageUrl)) {
          imagesToLoad.push(product.imageUrl);
        }
        
        console.log('📸 Imágenes a cargar:', imagesToLoad);
        
        if (imagesToLoad.length > 0) {
          loadExistingImages(imagesToLoad);
        } else {
          console.log('⚠️ No hay imágenes para cargar');
          setProductImages([]);
        }
        
        setIsLoadingProduct(false);
      }, 1000);
    }
  }, [isEditMode, productId, reset]);

  // Funciones para gestión de imágenes
  const loadExistingImages = (imageUrls: string[]) => {
    console.log('📸 loadExistingImages llamado con:', imageUrls);
    
    const existingImages: ImageData[] = imageUrls.map((url, index) => ({
      id: `existing-${index}-${Date.now()}-${Math.random()}`,
      url,
      isUploaded: true,
      source: 'url' as const,
      name: `imagen-${index + 1}`
    }));
    
    console.log('📸 Imágenes creadas:', existingImages);
    setProductImages(existingImages);
    setCurrentImageIndex(0); // Resetear el índice a la primera imagen
  };

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

  const handleAddImageUrl = () => {
    const url = prompt("Ingresa la URL de la imagen:");
    if (url && url.trim()) {
      // Validar que sea una URL válida
      try {
        new URL(url.trim());
        const id = `url-${Date.now()}-${Math.random()}`;
        console.log('🔗 Agregando imagen por URL:', url.trim());
        
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
        
        toast({
          title: "Imagen agregada",
          description: "La imagen se ha agregado correctamente",
        });
      } catch (error) {
        toast({
          title: "URL inválida",
          description: "Por favor ingresa una URL válida",
          variant: "destructive",
        });
      }
    }
  };

  const removeImage = (id: string) => {
    console.log('🗑️ Removiendo imagen con ID:', id);
    console.log('📸 Imágenes antes de remover:', productImages.length);
    
    setProductImages((prev) => {
      const imageToRemove = prev.find(img => img.id === id);
      if (imageToRemove?.file && imageToRemove.url.startsWith('blob:')) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      const newImages = prev.filter(img => img.id !== id);
      console.log('📸 Imágenes después de remover:', newImages.length);
      return newImages;
    });
    
    // Ajustar el índice actual si es necesario
    setCurrentImageIndex((prevIndex) => {
      const newLength = productImages.length - 1;
      if (newLength === 0) return 0;
      if (prevIndex >= newLength) return newLength - 1;
      return prevIndex;
    });
  };

  const nextImage = () => {
    if (productImages.length > 0) {
      const newIndex = (currentImageIndex + 1) % productImages.length;
      console.log('➡️ Navegando a imagen:', newIndex, productImages[newIndex]?.url);
      setCurrentImageIndex(newIndex);
    }
  };

  const prevImage = () => {
    if (productImages.length > 0) {
      const newIndex = (currentImageIndex - 1 + productImages.length) % productImages.length;
      console.log('⬅️ Navegando a imagen:', newIndex, productImages[newIndex]?.url);
      setCurrentImageIndex(newIndex);
    }
  };

  // Función para generar SKU automático
  const generateSKU = () => {
    const formValues = watch();
    const category = formValues.category;
    const name = formValues.name;
    const brand = formValues.brand || brandInput;
    
    if (!category || !name) {
      toast({
        title: "Campos requeridos",
        description: "Necesitas completar al menos el nombre y la categoría para generar un SKU",
        variant: "destructive",
      });
      return;
    }
    
    // Crear SKU: CATEGORIA-MARCA-NOMBRE-RANDOM
    const categoryCode = category.substring(0, 3).toUpperCase();
    const brandCode = brand ? brand.substring(0, 3).toUpperCase() : "GEN";
    const nameCode = name.substring(0, 3).toUpperCase();
    const randomCode = Math.random().toString(36).substring(2, 5).toUpperCase();
    
    const newSKU = `${categoryCode}-${brandCode}-${nameCode}-${randomCode}`;
    setValue("sku", newSKU);
    
    toast({
      title: "SKU generado",
      description: `Nuevo SKU: ${newSKU}`,
    });
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
      setExistingBrands((prev) => [...prev, newBrand].sort());
      setValue("brand", newBrand);
      setShowBrandInput(false);
      setBrandInput("");
      toast({
        title: "Marca agregada",
        description: `La marca "${newBrand}" ha sido agregada a la lista`,
      });
    }
  };

  // Mutations simuladas
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      setIsProcessingImages(true);
      
      // Simular proceso de creación
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Creando producto:', data);
      console.log('Imágenes:', productImages);
      
      setIsProcessingImages(false);
      return { id: Date.now(), ...data };
    },
    onSuccess: () => {
      toast({
        title: "Producto creado",
        description: "El producto se ha creado correctamente",
      });
      
      // Redireccionar a gestión de productos
      window.location.href = '/product-management';
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el producto",
        variant: "destructive",
      });
      setIsProcessingImages(false);
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      setIsProcessingImages(true);
      
      // Simular proceso de actualización
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Actualizando producto:', productId, data);
      console.log('Imágenes:', productImages);
      
      setIsProcessingImages(false);
      return { id: productId, ...data };
    },
    onSuccess: () => {
      toast({
        title: "Producto actualizado",
        description: "El producto se ha actualizado correctamente",
      });
      
      // Redireccionar a gestión de productos
      window.location.href = '/product-management';
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el producto",
        variant: "destructive",
      });
      setIsProcessingImages(false);
    }
  });

  // Función de envío del formulario
  const onSubmit = (data: ProductFormData) => {
    console.log('Enviando formulario:', data);
    
    if (isEditMode) {
      updateProductMutation.mutate(data);
    } else {
      createProductMutation.mutate(data);
    }
  };

  // Estados de carga
  if (isLoadingProduct) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Cargando datos del producto...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/product-management'}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditMode ? 'Editar Producto' : 'Agregar Nuevo Producto'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isEditMode 
                ? 'Modifica la información del producto existente' 
                : 'Completa la información para crear un nuevo producto'}
            </p>
          </div>
        </div>
        
        {isEditMode && (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            Modo Edición
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna principal: Información básica */}
          <div className="lg:col-span-2 space-y-6">
            {/* Información básica */}
            <Card>
              <CardHeader>
                <CardTitle>Información Básica</CardTitle>
                <CardDescription>
                  Datos principales del producto o servicio
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="name">Nombre del Producto *</Label>
                    <Input
                      id="name"
                      {...register("name")}
                      placeholder="Ej: Cámara de Seguridad IP 4K"
                    />
                    {errors.name && (
                      <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="description">Descripción *</Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Describe las características principales del producto..."
                      rows={3}
                    />
                    {errors.description && (
                      <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="category">Categoría *</Label>
                    <Select
                      value={watch("category")}
                      onValueChange={(value) => setValue("category", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.category && (
                      <p className="text-sm text-red-600 mt-1">{errors.category.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="type">Tipo</Label>
                    <Select
                      value={watch("type")}
                      onValueChange={(value) => setValue("type", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product">Producto</SelectItem>
                        <SelectItem value="service">Servicio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="price">Precio *</Label>
                    <Input
                      id="price"
                      {...register("price")}
                      placeholder="0.00"
                      type="number"
                      step="0.01"
                    />
                    {errors.price && (
                      <p className="text-sm text-red-600 mt-1">{errors.price.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="installationCost">Costo de Instalación</Label>
                    <Input
                      id="installationCost"
                      {...register("installationCost")}
                      placeholder="0.00"
                      type="number"
                      step="0.01"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Marca y SKU */}
            <Card>
              <CardHeader>
                <CardTitle>Marca y Código</CardTitle>
                <CardDescription>
                  Información de marca y código de identificación
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="brand">Marca</Label>
                    {!showBrandInput ? (
                      <Select
                        value={watch("brand") || ""}
                        onValueChange={handleBrandSelection}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar marca" />
                        </SelectTrigger>
                        <SelectContent>
                          {existingBrands.map((brand) => (
                            <SelectItem key={brand} value={brand}>
                              {brand}
                            </SelectItem>
                          ))}
                          <SelectItem value="new_brand">
                            <div className="flex items-center gap-2">
                              <Plus className="w-4 h-4" />
                              Agregar nueva marca
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={brandInput}
                          onChange={(e) => setBrandInput(e.target.value)}
                          placeholder="Nombre de la nueva marca"
                        />
                        <Button
                          type="button"
                          onClick={handleAddNewBrand}
                          size="sm"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowBrandInput(false)}
                          size="sm"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="model">Modelo</Label>
                    <Input
                      id="model"
                      {...register("model")}
                      placeholder="Ej: DS-2CD2043G2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sku">SKU (Código de Producto)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="sku"
                        {...register("sku")}
                        placeholder="Ej: CAM-HIK-4K-001"
                        disabled={isEditMode} // SKU solo lectura en modo edición
                        className={isEditMode ? "bg-gray-50" : ""}
                      />
                      {!isEditMode && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generateSKU}
                          size="sm"
                          className="px-3"
                        >
                          <Wand2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {isEditMode && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        El SKU no se puede modificar en modo edición
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="stock">Stock Inicial</Label>
                    <Input
                      id="stock"
                      type="number"
                      {...register("stock", { valueAsNumber: true })}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Especificaciones */}
            <Card>
              <CardHeader>
                <CardTitle>Especificaciones y Detalles</CardTitle>
                <CardDescription>
                  Información técnica y características adicionales
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="specifications">Especificaciones Técnicas</Label>
                  <Textarea
                    id="specifications"
                    {...register("specifications")}
                    placeholder="Describe las especificaciones técnicas del producto..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="warrantyMonths">Garantía (meses)</Label>
                    <Input
                      id="warrantyMonths"
                      type="number"
                      {...register("warrantyMonths", { valueAsNumber: true })}
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="weight">Peso</Label>
                    <Input
                      id="weight"
                      {...register("weight")}
                      placeholder="Ej: 0.5 kg"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dimensions">Dimensiones</Label>
                    <Input
                      id="dimensions"
                      {...register("dimensions")}
                      placeholder="Ej: 10x8x5 cm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="tags">Etiquetas</Label>
                    <Input
                      id="tags"
                      {...register("tags")}
                      placeholder="seguridad, cámara, ip, 4k"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Columna lateral: Imágenes y configuración */}
          <div className="space-y-6">
            {/* Gestión de imágenes */}
            <Card>
              <CardHeader>
                <CardTitle>Imágenes del Producto</CardTitle>
                <CardDescription>
                  Agrega imágenes para mostrar tu producto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Galería de imágenes */}
                {productImages.length > 0 ? (
                  <div className="space-y-4">
                    <div className="text-xs text-gray-500 mb-2">
                      {productImages.length} imagen{productImages.length !== 1 ? 'es' : ''} cargada{productImages.length !== 1 ? 's' : ''}
                    </div>
                    
                    {/* Imagen principal */}
                    <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={productImages[currentImageIndex]?.url}
                        alt={`Imagen ${currentImageIndex + 1}`}
                        className="w-full h-full object-cover"
                        onLoad={() => console.log('✅ Imagen cargada exitosamente:', productImages[currentImageIndex]?.url)}
                        onError={(e) => {
                          console.error('❌ Error cargando imagen:', productImages[currentImageIndex]?.url);
                          console.error('Error completo:', e);
                          // Reemplazar con imagen de placeholder si falla
                          e.currentTarget.src = 'https://via.placeholder.com/400x300/f3f4f6/9ca3af?text=Imagen+No+Disponible';
                        }}
                      />
                      
                      {/* Controles de navegación */}
                      {productImages.length > 1 && (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-80 hover:opacity-100"
                            onClick={prevImage}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-80 hover:opacity-100"
                            onClick={nextImage}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </>
                      )}

                      {/* Eliminar imagen actual */}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-80 hover:opacity-100"
                        onClick={() => {
                          console.log('🗑️ Eliminando imagen:', productImages[currentImageIndex]?.id);
                          removeImage(productImages[currentImageIndex]?.id);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>

                      {/* Indicador de posición */}
                      {productImages.length > 1 && (
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                          {currentImageIndex + 1} / {productImages.length}
                        </div>
                      )}
                    </div>

                    {/* Miniaturas */}
                    {productImages.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {productImages.map((image, index) => (
                          <button
                            key={image.id}
                            type="button"
                            className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                              index === currentImageIndex ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => {
                              console.log('🖼️ Cambiando a imagen:', index, image.url);
                              setCurrentImageIndex(index);
                            }}
                          >
                            <img
                              src={image.url}
                              alt={`Miniatura ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback para miniaturas también
                                e.currentTarget.src = 'https://via.placeholder.com/64x64/f3f4f6/9ca3af?text=?';
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Package className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">
                        {isEditMode ? 'No hay imágenes para este producto' : 'Sin imágenes'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {isEditMode ? 'Puedes agregar imágenes usando los botones de abajo' : 'Agrega imágenes para mostrar tu producto'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Controles para agregar imágenes */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('image-upload')?.click()}
                      className="flex items-center gap-2 flex-1"
                    >
                      <Upload className="w-4 h-4" />
                      Subir Imagen
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddImageUrl}
                      className="flex items-center gap-2 flex-1"
                    >
                      <LinkIcon className="w-4 h-4" />
                      Agregar URL
                    </Button>
                  </div>
                  
                  <input
                    id="image-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  
                  <p className="text-xs text-gray-500">
                    Formatos soportados: JPG, PNG, WEBP. Máximo 5MB por imagen.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Configuración del producto */}
            <Card>
              <CardHeader>
                <CardTitle>Configuración</CardTitle>
                <CardDescription>
                  Opciones de disponibilidad y promoción
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isActive">Producto Activo</Label>
                    <p className="text-sm text-gray-500">
                      El producto será visible en el catálogo
                    </p>
                  </div>
                  <Switch
                    id="isActive"
                    checked={watch("isActive")}
                    onCheckedChange={(checked) => setValue("isActive", checked)}
                  />
                </div>

                <div>
                  <Label htmlFor="availability">Disponibilidad</Label>
                  <Select
                    value={watch("availability")}
                    onValueChange={(value) => setValue("availability", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar disponibilidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_stock">En Stock</SelectItem>
                      <SelectItem value="out_of_stock">Agotado</SelectItem>
                      <SelectItem value="on_order">Por Encargo</SelectItem>
                      <SelectItem value="discontinued">Descontinuado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="isPromoted">Producto Promocionado</Label>
                    <p className="text-sm text-gray-500">
                      Destacar este producto en el catálogo
                    </p>
                  </div>
                  <Switch
                    id="isPromoted"
                    checked={watch("isPromoted")}
                    onCheckedChange={(checked) => setValue("isPromoted", checked)}
                  />
                </div>

                {watch("isPromoted") && (
                  <div>
                    <Label htmlFor="promotionText">Texto de Promoción</Label>
                    <Input
                      id="promotionText"
                      {...register("promotionText")}
                      placeholder="¡Oferta especial!"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minQuantity">Cantidad Mínima</Label>
                    <Input
                      id="minQuantity"
                      type="number"
                      {...register("minQuantity", { valueAsNumber: true })}
                      placeholder="1"
                      min="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxQuantity">Cantidad Máxima</Label>
                    <Input
                      id="maxQuantity"
                      type="number"
                      {...register("maxQuantity", { valueAsNumber: true })}
                      placeholder="Sin límite"
                      min="1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Información adicional en modo edición */}
            {isEditMode && (
              <Card>
                <CardHeader>
                  <CardTitle>Información del Sistema</CardTitle>
                  <CardDescription>
                    Datos internos del producto
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <span className="text-gray-600">ID del Producto:</span>
                    <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      #{productId}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">SKU:</span>
                    <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {watch("sku") || 'Sin SKU'}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600">Última actualización:</span>
                    <span className="ml-2 text-gray-500">
                      {new Date().toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer con botones de acción */}
        <div className="border-t bg-gray-50 -mx-6 -mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.href = '/product-management'}
              >
                Cancelar
              </Button>
              
              {isEditMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm('¿Deseas descartar los cambios?')) {
                      window.location.href = '/product-management';
                    }
                  }}
                  className="text-amber-600 hover:text-amber-700"
                >
                  Descartar Cambios
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {(isProcessingImages || isSubmitting) && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                  {isProcessingImages ? 'Procesando imágenes...' : 'Guardando...'}
                </div>
              )}
              
              <Button
                type="submit"
                disabled={isSubmitting || isProcessingImages}
                className="min-w-[120px]"
              >
                {isSubmitting || isProcessingImages ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    {isEditMode ? 'Actualizando...' : 'Creando...'}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {isEditMode ? 'Actualizar Producto' : 'Crear Producto'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
} 