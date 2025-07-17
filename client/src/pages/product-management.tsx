// product-management.tsx - Errores corregidos
import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Imports correctos para tus componentes UI
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Implementación inline de apiRequest (reemplaza @/lib/api)
const apiRequest = async (method: string, url: string, data?: any) => {
  const token = localStorage.getItem('auth_token'); // ✅ CORRECTO
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' })
    },
  };

  if (data) {
    if (data instanceof FormData) {
      options.body = data;
    } else {
      options.body = JSON.stringify(data);
    }
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Error ${response.status}`);
  }

  return response.json();
};

// Hook de toast simplificado (implementación inline)
const useToast = () => {
  const toast = ({ title, description, variant }: { 
    title: string; 
    description?: string; 
    variant?: 'default' | 'destructive' 
  }) => {
    if (variant === 'destructive') {
      console.error(`❌ ${title}: ${description}`);
      alert(`❌ Error: ${title}\n${description || ''}`);
    } else {
      console.log(`✅ ${title}: ${description}`);
      alert(`✅ ${title}\n${description || ''}`);
    }
  };
  return { toast };
};

import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Tag,
  Image,
  Upload,
  Link,
  X,
  Eye,
  Loader2,
  CheckCircle,
  AlertCircle,
  Move,
  Filter,
  MoreHorizontal,
  DollarSign,
  BarChart3,
} from "lucide-react";

// Tipos e interfaces
interface ImageData {
  id: string;
  url: string;
  file?: File;
  isUploaded: boolean;
  isUploading?: boolean; // ← Agregar esto
  uploadError?: string;  // ← Agregar esto
  source: 'file' | 'url';
  name: string;
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
  imageUrl?: string;
  images?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface Category {
  id: number;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  category: string;
  type: string;
  brand: string;
  model: string;
  sku: string;
  isActive: boolean;
  stock: number;
  specifications: string;
  installationCost: string;
  warrantyMonths: number;
  imageUrl: string;
  images: string[];
}

interface CategoryFormData {
  name: string;
  description: string;
}

// Componente de carga de imágenes mejorado
const EnhancedImageUpload: React.FC<{
  images: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
  maxImages?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
}> = ({
  images,
  onImagesChange,
  maxImages = 5,
  maxFileSize = 5,
  allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Manejo de archivos
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    
    if (images.length + newFiles.length > maxImages) {
      toast({
        title: "⚠️ Límite de imágenes",
        description: `Solo puedes subir un máximo de ${maxImages} imágenes`,
        variant: "destructive",
      });
      return;
    }

    const processedFiles = newFiles.map(file => {
      if (file.size > maxFileSize * 1024 * 1024) {
        toast({
          title: "⚠️ Archivo muy grande",
          description: `${file.name} es mayor a ${maxFileSize}MB`,
          variant: "destructive",
        });
        return null;
      }

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "⚠️ Formato no válido",
          description: `${file.name} no es un formato permitido`,
          variant: "destructive",
        });
        return null;
      }

       return {
    id: `file-${Date.now()}-${Math.random()}`,
    url: URL.createObjectURL(file),
    file,
    isUploaded: false,    // ← Esto se queda igual
    isUploading: false,   // ← AGREGAR esto
    source: 'file' as const,
    name: file.name
  };
}).filter(Boolean) as ImageData[];

onImagesChange([...images, ...processedFiles]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Manejo de URL
  const handleUrlAdd = async () => {
    if (!urlInput.trim()) return;

    if (images.length >= maxImages) {
      toast({
        title: "⚠️ Límite de imágenes",
        description: `Solo puedes subir un máximo de ${maxImages} imágenes`,
        variant: "destructive",
      });
      return;
    }

    try {
      new URL(urlInput);
    } catch {
      toast({
        title: "⚠️ URL inválida",
        description: "Por favor ingresa una URL válida",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingUrl(true);

    try {
      const response = await fetch(urlInput, { method: 'HEAD' });
      
      if (!response.ok) {
        throw new Error('No se pudo acceder a la imagen');
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('La URL no apunta a una imagen válida');
      }

      if (!allowedTypes.includes(contentType)) {
        throw new Error('Formato de imagen no permitido');
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > maxFileSize * 1024 * 1024) {
        throw new Error(`La imagen es muy grande (máximo ${maxFileSize}MB)`);
      }

      const newImage: ImageData = {
        id: `url-${Date.now()}-${Math.random()}`,
        url: urlInput,
        isUploaded: false,
        source: 'url',
        name: urlInput.split('/').pop() || 'imagen-url'
      };

      onImagesChange([...images, newImage]);
      setUrlInput('');

      toast({
        title: "✅ Imagen agregada",
        description: "La imagen desde URL se agregó exitosamente",
      });

    } catch (error) {
      toast({
        title: "❌ Error",
        description: error instanceof Error ? error.message : "Error al cargar imagen desde URL",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const removeImage = (id: string) => {
    const updatedImages = images.filter(img => img.id !== id);
    onImagesChange(updatedImages);
    
    const imageToRemove = images.find(img => img.id === id);
    if (imageToRemove?.file && imageToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(imageToRemove.url);
    }
  };

  const previewImage = (url: string) => {
    window.open(url, '_blank');
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null) return;
    
    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    
    newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, draggedImage);
    
    onImagesChange(newImages);
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-medium">
          Imágenes del producto (máximo {maxImages})
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          Sube archivos o agrega imágenes desde URL. Formatos: JPG, PNG, GIF, WebP (máximo {maxFileSize}MB)
        </p>
      </div>

      <Tabs defaultValue="files" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="files" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Subir archivos
          </TabsTrigger>
          <TabsTrigger value="url" className="flex items-center gap-2">
            <Link className="w-4 h-4" />
            Desde URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedTypes.join(',')}
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              disabled={images.length >= maxImages}
            />
            <label
              htmlFor="file-upload"
              className={`cursor-pointer inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white transition-colors ${
                images.length >= maxImages 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              <Image className="w-5 h-5 mr-2" />
              {images.length >= maxImages ? 'Límite alcanzado' : 'Seleccionar archivos'}
            </label>
            <p className="text-sm text-gray-500 mt-2">
              O arrastra y suelta archivos aquí
            </p>
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://ejemplo.com/imagen.jpg"
              disabled={isLoadingUrl || images.length >= maxImages}
              onKeyPress={(e) => e.key === 'Enter' && handleUrlAdd()}
            />
            <Button 
              onClick={handleUrlAdd} 
              disabled={isLoadingUrl || !urlInput.trim() || images.length >= maxImages}
              className="px-4"
            >
              {isLoadingUrl ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Link className="w-4 h-4 mr-2" />
                  Agregar
                </>
              )}
            </Button>
          </div>
          
          {images.length >= maxImages && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Has alcanzado el límite máximo de {maxImages} imágenes.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Imágenes cargadas ({images.length}/{maxImages})
            </Label>
            <p className="text-xs text-muted-foreground">
              Arrastra para reordenar
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div className="flex-shrink-0">
                  <img
                    src={image.url}
                    alt={image.name}
                    className="w-12 h-12 object-cover rounded border"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{image.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={image.source === 'file' ? 'default' : 'secondary'} className="text-xs">
                      {image.source === 'file' ? 'Archivo' : 'URL'}
                    </Badge>
                    {image.isUploaded ? (
                      <Badge variant="outline" className="text-xs text-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Subido
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-yellow-600">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Pendiente
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => previewImage(image.url)}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 cursor-move"
                  >
                    <Move className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeImage(image.id)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {images.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay imágenes cargadas</p>
        </div>
      )}
    </div>
  );
};

// Componente principal
export const ProductManagement: React.FC = () => {
  // Estados principales
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [activeTab, setActiveTab] = useState("products");

  // Estados de filtrado y búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Estados de formularios
  const [productForm, setProductForm] = useState<ProductFormData>({
    name: "",
    description: "",
    price: "",
    category: "",
    type: "product",
    brand: "",
    model: "",
    sku: "",
    isActive: true,
    stock: 0,
    specifications: "",
    installationCost: "",
    warrantyMonths: 0,
    imageUrl: "",
    images: [],
  });

  const [categoryForm, setCategoryForm] = useState<CategoryFormData>({
    name: "",
    description: "",
  });

  // Estados de imágenes
  const [productImages, setProductImages] = useState<ImageData[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries
// ✅ CORRECTO - queryKey debe coincidir con la URL
const { data: products = [], isLoading: loadingProducts } = useQuery({
  queryKey: ["/api/products"], // ← Cambiar esto
  queryFn: () => apiRequest("GET", "/api/products"),
  staleTime: 30000,
  retry: 3,
  retryDelay: 1000,
});

const { data: categories = [], isLoading: loadingCategories } = useQuery({
  queryKey: ["/api/categories"], // ← Cambiar esto  
  queryFn: () => apiRequest("GET", "/api/categories"),
  staleTime: 30000,
  retry: 3,
  retryDelay: 1000,
});

  // Función auxiliar para procesar imágenes (CORREGIDA - compatible con todas las versiones de TypeScript)
  const prepareImageFormData = (images: ImageData[]): { formData: FormData; imageUrls: string[] } => {
    const formData = new FormData();
    const imageUrls: string[] = [];

    images.forEach((image) => {
      if (image.source === 'file' && image.file) {
        formData.append('images', image.file);
      } else if (image.source === 'url') {
        imageUrls.push(image.url);
      }
    });

    return { formData, imageUrls };
  };

  // Función auxiliar para combinar FormData (CORREGIDA)
  const appendFormData = (targetFormData: FormData, sourceFormData: FormData) => {
    // Convertir a array para compatibilidad con versiones anteriores de TypeScript
    const entries = Array.from(sourceFormData.entries());
    entries.forEach(([key, value]) => {
      targetFormData.append(key, value);
    });
  };

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      setIsProcessingImages(true);

      try {
        const formData = new FormData();
        
        Object.entries(data).forEach(([key, value]) => {
          if (key !== 'images' && value !== undefined && value !== null && value !== '') {
            formData.append(key, value.toString());
          }
        });

        const { formData: imageFormData, imageUrls } = prepareImageFormData(productImages);
        
        // Usar la función auxiliar para evitar problemas de iteración
        appendFormData(formData, imageFormData);

        if (imageUrls.length > 0) {
          formData.append('imageUrls', JSON.stringify(imageUrls));
        }

        return apiRequest("POST", "/api/products", formData);
      } finally {
        setIsProcessingImages(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsCreateDialogOpen(false);
      resetProductForm();
      resetImageStates();
      setProductImages(prev => prev.map(img => ({ ...img, isUploaded: true })));
      toast({
        title: "✅ Producto creado",
        description: "El producto se ha creado exitosamente con todas las imágenes.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error",
        description: error.message || "Error al crear el producto",
        variant: "destructive",
      });
    }
  });

// 🔍 DIAGNÓSTICO FRONTEND - Reemplazar updateProductMutation en product-management.tsx

const updateProductMutation = useMutation({
  mutationFn: async (data: ProductFormData & { id: number }) => {
    // El frontend ya envía solo las URLs finales
    const result = await apiRequest("PUT", `/api/products/${data.id}`, data);
    return result;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    setIsEditDialogOpen(false);
    setSelectedProduct(null);
    resetProductForm();
    resetImageStates();
    setProductImages(prev => prev.map(img => ({ ...img, isUploaded: true })));
    toast({
      title: "✅ Producto actualizado",
      description: "El producto se ha actualizado exitosamente.",
    });
  },
  onError: (error: any) => {
    console.error('❌ MUTATION ERROR:', error);
    toast({
      title: "❌ Error",
      description: error.message || "Error al actualizar el producto",
      variant: "destructive",
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
        title: "✅ Producto eliminado",
        description: "El producto se ha eliminado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error",
        description: error.message || "Error al eliminar el producto",
        variant: "destructive",
      });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      return apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setIsCategoryDialogOpen(false);
      resetCategoryForm();
      toast({
        title: "✅ Categoría creada",
        description: "La categoría se ha creado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error",
        description: error.message || "Error al crear la categoría",
        variant: "destructive",
      });
    }
  });

  // Resto de mutations y funciones auxiliares...
  const resetProductForm = () => {
    setProductForm({
      name: "",
      description: "",
      price: "",
      category: "",
      type: "product",
      brand: "",
      model: "",
      sku: "",
      isActive: true,
      stock: 0,
      specifications: "",
      installationCost: "",
      warrantyMonths: 0,
      imageUrl: "",
      images: [],
    });
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: "",
      description: "",
    });
  };

  const resetImageStates = () => {
    productImages.forEach(image => {
      if (image.file && image.url.startsWith('blob:')) {
        URL.revokeObjectURL(image.url);
      }
    });
    setProductImages([]);
  };

  const loadExistingImages = (imageUrls: string[]) => {
    const existingImages: ImageData[] = imageUrls.map((url, index) => ({
      id: `existing-${index}-${Date.now()}`,
      url,
      isUploaded: true,
      source: 'url' as const,
      name: `imagen-${index + 1}`
    }));
    
    setProductImages(existingImages);
  };

  const openProductEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setProductForm({
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
      imageUrl: product.imageUrl || "",
      images: product.images || [],
    });
    
    if (product.images && product.images.length > 0) {
      loadExistingImages(product.images);
    } else {
      setProductImages([]);
    }
    
    setIsEditDialogOpen(true);
  };

 const handleImagesChange = async (newImages: ImageData[]) => {
  setProductImages(newImages);
  
  // Subir inmediatamente las nuevas imágenes (archivos y URLs)
  const processedImages = await Promise.all(
    newImages.map(async (image) => {
      if (image.isUploaded) {
        // Ya está subida, no hacer nada
        return image;
      }

      try {
        // Marcar como procesando
        setProductImages(prev => 
          prev.map(img => 
            img.id === image.id 
              ? { ...img, isUploading: true } 
              : img
          )
        );

        let finalUrl = image.url;

        if (image.source === 'file' && image.file) {
          // Subir archivo a Supabase inmediatamente
          console.log('🔄 Uploading file to Supabase:', image.name);
          
          const formData = new FormData();
          formData.append('image', image.file);
          
          const response = await apiRequest("POST", "/api/upload-image", formData);
          finalUrl = response.imageUrl;
          
          console.log('✅ File uploaded successfully:', finalUrl);
        } else if (image.source === 'url') {
          // Validar y potencialmente procesar URL
          console.log('🔗 Processing URL:', image.url);
          
          try {
            const response = await apiRequest("POST", "/api/process-image-url", {
              imageUrl: image.url
            });
            finalUrl = response.imageUrl || image.url;
            
            console.log('✅ URL processed successfully:', finalUrl);
          } catch (error) {
            console.warn('⚠️ URL processing failed, using original:', error);
            // Usar URL original si falla el procesamiento
          }
        }

        return {
          ...image,
          url: finalUrl,
          isUploaded: true,
          isUploading: false
        };

      } catch (error) {
        console.error('❌ Error uploading image:', error);
        
        toast({
          title: "❌ Error al subir imagen",
          description: `No se pudo subir ${image.name}`,
          variant: "destructive",
        });

        return {
          ...image,
          isUploaded: false,
          isUploading: false,
          uploadError: error.message
        };
      }
    })
  );

  // Actualizar estado con imágenes procesadas
  setProductImages(processedImages);
  
  // Actualizar URLs en el formulario
  const successfulUrls = processedImages
    .filter(img => img.isUploaded)
    .map(img => img.url);
    
  setProductForm(prev => ({
    ...prev,
    images: successfulUrls
  }));
};

  const handleProductSubmit = () => {
    if (!productForm.name || !productForm.description || !productForm.price || !productForm.category) {
      toast({
        title: "❌ Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    if (selectedProduct) {
      updateProductMutation.mutate({ ...productForm, id: selectedProduct.id });
    } else {
      createProductMutation.mutate(productForm);
    }
  };

  // Filtrar productos
  const filteredProducts = Array.isArray(products) 
    ? products.filter((product: Product) => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (product.description || "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === "all" || product.category === filterCategory;
        const matchesStatus = filterStatus === "all" || 
                             (filterStatus === "active" && product.isActive) ||
                             (filterStatus === "inactive" && !product.isActive);
        
        return matchesSearch && matchesCategory && matchesStatus;
      })
    : [];

  const formatCurrency = (price: string) => {
    return parseFloat(price).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
  };

  if (loadingProducts || loadingCategories) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando gestión de productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Productos</h1>
          <p className="text-muted-foreground">
            Administra tu inventario y categorías de productos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsCategoryDialogOpen(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Tag className="w-4 h-4" />
            Nueva Categoría
          </Button>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Búsqueda simplificada */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((category: Category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Productos ({filteredProducts.length})</span>
            <Badge variant="outline">{filteredProducts.length} resultados</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imagen</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product: Product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="w-12 h-12 rounded border overflow-hidden bg-gray-100">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Image className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.sku && `SKU: ${product.sku}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {product.price && formatCurrency(product.price)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.stock && product.stock > 0 ? "default" : "destructive"}>
                        {product.stock || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openProductEditDialog(product)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProductMutation.mutate(product.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para crear/editar producto */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setSelectedProduct(null);
          resetProductForm();
          resetImageStates();
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? "Editar Producto" : "Crear Nuevo Producto"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Columna izquierda: Datos del producto */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre del producto *</Label>
                <Input
                  id="name"
                  value={productForm.name}
                  onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                  placeholder="Nombre del producto"
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                  id="description"
                  value={productForm.description}
                  onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                  placeholder="Descripción del producto"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Precio *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="stock">Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({...productForm, stock: parseInt(e.target.value) || 0})}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="category">Categoría *</Label>
                <Select
                  value={productForm.category}
                  onValueChange={(value) => setProductForm({...productForm, category: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category: Category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Columna derecha: Gestión de imágenes */}
            <div className="space-y-4">
              <EnhancedImageUpload
                images={productImages}
                onImagesChange={handleImagesChange}
                maxImages={5}
                maxFileSize={5}
                allowedTypes={['image/jpeg', 'image/png', 'image/gif', 'image/webp']}
              />

              {isProcessingImages && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando imágenes...
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setIsEditDialogOpen(false);
                setSelectedProduct(null);
                resetProductForm();
                resetImageStates();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProductSubmit}
              disabled={
                createProductMutation.isPending || 
                updateProductMutation.isPending || 
                isProcessingImages ||
                !productForm.name || 
                !productForm.description || 
                !productForm.price || 
                !productForm.category
              }
            >
              {(createProductMutation.isPending || updateProductMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {selectedProduct ? "Actualizando..." : "Creando..."}
                </>
              ) : (
                selectedProduct ? "Actualizar Producto" : "Crear Producto"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};