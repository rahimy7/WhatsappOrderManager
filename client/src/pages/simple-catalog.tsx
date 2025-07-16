// simple-catalog.tsx - CORRECCIONES PARA USAR ENDPOINTS CORRECTOS

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShoppingCart, Search, Filter, Heart, Star, Plus, Minus, ShoppingBag, MessageCircle, Phone, X, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formatCurrency = (amount: string | number) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return numAmount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function SimpleCatalog() {
  const { toast } = useToast();
  
  // Obtener storeId de la URL
  const [storeId, setStoreId] = useState<number | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');
    if (storeParam) {
      setStoreId(parseInt(storeParam));
    } else {
      // Fallback: usar tienda por defecto (MASQUESALUD)
      setStoreId(6); // ← Cambiado a tienda 6
    }
  }, []);
  
  // ✅ CORREGIDO: Usar endpoint existente para productos
  const { data: allProducts = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => apiRequest("GET", "/api/products")
  });

  // ✅ CORREGIDO: Usar endpoint existente para categorías
  const { data: allCategories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("GET", "/api/categories")
  });

  // ✅ FILTRAR productos por storeId en el frontend (hasta que tengamos endpoints específicos)
  const products = Array.isArray(allProducts) 
    ? allProducts.filter((product: any) => {
        // Si el producto tiene storeId, filtrar por la tienda actual
        // Si no tiene storeId, mostrar todos (para compatibilidad)
        return !product.storeId || product.storeId === storeId;
      })
    : [];

  // ✅ FILTRAR categorías por storeId en el frontend
  const categories = Array.isArray(allCategories) 
    ? allCategories.filter((category: any) => {
        // Si la categoría tiene storeId, filtrar por la tienda actual
        // Si no tiene storeId, mostrar todas (para compatibilidad)
        return !category.storeId || category.storeId === storeId;
      })
    : [];

  // ✅ OBTENER configuración de la tienda (si está disponible)
  const { data: storeConfig } = useQuery({
    queryKey: [`/api/stores/${storeId}/config`],
    queryFn: () => apiRequest("GET", `/api/stores/${storeId}/config`),
    enabled: !!storeId,
    retry: false // No reintentar si falla
  });

  // Session ID único para el carrito
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('cart_session_id');
    if (!id) {
      id = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('cart_session_id', id);
    }
    return id;
  });

  // Estados
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Estado del carrito local
  const [cart, setCart] = useState<{items: any[], subtotal: number}>(() => {
    try {
      // Verificar si el pedido fue enviado
      const enviado = localStorage.getItem('pedido_enviado');
      if (enviado === 'true') {
        localStorage.removeItem(`cart_${sessionId}`);
        localStorage.setItem('pedido_enviado', 'false');
        const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('cart_session_id', newSessionId);
        return { items: [], subtotal: 0 };
      }

      const saved = localStorage.getItem(`cart_${sessionId}`);
      if (saved) {
        const parsedCart = JSON.parse(saved);
        return parsedCart;
      }
      return { items: [], subtotal: 0 };
    } catch {
      return { items: [], subtotal: 0 };
    }
  });

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem(`cart_${sessionId}`, JSON.stringify(cart));
  }, [cart, sessionId]);

  // ✅ FUNCIÓN PARA AGREGAR AL CARRITO (corregida)
  const addToCart = (productId: number, quantity: number = 1) => {
    const product = products.find((p: any) => p.id === productId);
    if (!product) {
      toast({
        title: "Error",
        description: "Producto no encontrado",
        variant: "destructive",
      });
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.items.find(item => item.productId === productId);
      let newItems;
      
      if (existingItem) {
        newItems = prevCart.items.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        newItems = [...prevCart.items, {
          id: Date.now(),
          productId,
          quantity,
          product: {
            id: product.id,
            name: product.name,
            price: parseFloat(product.price) || 0
          }
        }];
      }

      const subtotal = newItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      return { items: newItems, subtotal };
    });

    toast({
      title: "¡Producto agregado!",
      description: "El producto se agregó al carrito exitosamente",
    });
  };

  // Función para actualizar cantidad
  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart => {
      const newItems = prevCart.items.map(item =>
        item.productId === productId
          ? { ...item, quantity: newQuantity }
          : item
      );
      const subtotal = newItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      return { items: newItems, subtotal };
    });
  };

  // Función para remover del carrito
  const removeFromCart = (productId: number) => {
    setCart(prevCart => {
      const newItems = prevCart.items.filter(item => item.productId !== productId);
      const subtotal = newItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      return { items: newItems, subtotal };
    });

    toast({
      title: "Producto removido",
      description: "El producto se removió del carrito",
    });
  };

  // Función para calcular total de items
  const getTotalCartItems = () => {
    return cart.items.reduce((total, item) => total + item.quantity, 0);
  };

  // Funciones para el modal de detalles
  const openProductModal = (product: any) => {
    setSelectedProduct(product);
    setCurrentImageIndex(0);
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setCurrentImageIndex(0);
  };

  const nextImage = () => {
    if (selectedProduct?.images?.length > 1) {
      setCurrentImageIndex((prev) => 
        prev === selectedProduct.images.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = () => {
    if (selectedProduct?.images?.length > 1) {
      setCurrentImageIndex((prev) => 
        prev === 0 ? selectedProduct.images.length - 1 : prev - 1
      );
    }
  };

  // ✅ FUNCIÓN PARA ENVIAR POR WHATSAPP (mejorada)
  const sendToWhatsApp = () => {
    if (cart.items.length === 0) {
      toast({
        title: "Carrito vacío",
        description: "Agrega productos antes de hacer el pedido",
        variant: "destructive",
      });
      return;
    }

    // ✅ Números de WhatsApp por tienda
    const whatsappNumbers: Record<number, string> = {
      5: "5215579096161", // MASQUESALUD
      6: "5215534166960", // TIENDA 6
      // Agregar más tiendas según sea necesario
    };

    const whatsappNumber = whatsappNumbers[storeId || 6] || "5215534166960";
    const storeName = storeConfig?.storeName || `Tienda ${storeId}`;

    let message = `🛍️ *NUEVO PEDIDO - ${storeName}*\n\n`;
    
    cart.items.forEach((item, index) => {
      message += `${index + 1}. ${item.product.name}\n`;
      message += `   Cantidad: ${item.quantity}\n`;
      message += `   Precio unitario: $${formatCurrency(item.product.price)}\n`;
      message += `   Subtotal: $${formatCurrency(item.product.price * item.quantity)}\n\n`;
    });
    
    message += `💰 *TOTAL: $${formatCurrency(cart.subtotal)}*\n\n`;
    message += "Por favor confirma tu pedido y proporciona tu dirección de entrega.";

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    // Marcar que el pedido fue enviado
    localStorage.setItem('pedido_enviado', 'true');
    
    setIsCartOpen(false);
    
    toast({
      title: "¡Pedido enviado!",
      description: "El carrito se vaciará automáticamente la próxima vez que abras el catálogo",
    });
  };

  // ✅ FILTRAR PRODUCTOS (corregido)
  const filteredProducts = products.filter((product: any) => {
    if (!product) return false;
    
    const matchesSearch = product.name && product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // ✅ LOADING STATE
  if (loadingProducts || loadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Cargando productos de la tienda {storeId}...</p>
        </div>
      </div>
    );
  }

  // ✅ NO PRODUCTS STATE
  if (!loadingProducts && filteredProducts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
        <div className="text-center max-w-md mx-auto p-8">
          <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay productos disponibles</h2>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedCategory !== "all" 
              ? "No se encontraron productos que coincidan con tu búsqueda."
              : `La tienda ${storeId} no tiene productos configurados aún.`}
          </p>
          <p className="text-sm text-gray-500">
            Contacta al administrador de la tienda para más información.
          </p>
        </div>
      </div>
    );
  }

  // ✅ RESTO DEL CÓDIGO PERMANECE IGUAL...
  // (El JSX del render se mantiene exactamente como estaba)

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-white">🛍️ Catálogo - Tienda {storeId}</h1>
              <div className="text-sm text-emerald-100 bg-white/20 px-3 py-1 rounded-full">
                {filteredProducts.length} productos disponibles
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-emerald-600 w-5 h-5" />
                <Input
                  placeholder="🔍 Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 border-white/30 bg-white/90 text-gray-800 placeholder:text-emerald-600/70 focus:bg-white focus:border-emerald-300 rounded-full h-12"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-56 border-white/30 bg-white/90 text-gray-800 focus:bg-white focus:border-emerald-300 rounded-full h-12">
                  <SelectValue placeholder="📂 Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">📂 Todas las categorías</SelectItem>
                  {categories.map((category: any) => (
                    <SelectItem key={category.id} value={category.name}>
                      🏷️ {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Productos */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product: any) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div onClick={() => openProductModal(product)} className="cursor-pointer">
                <CardHeader className="pb-4">
                  <div className="w-full h-48 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg overflow-hidden relative">
                    {product.images && product.images.length > 0 ? (
                      <>
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLDivElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                        <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center absolute inset-0" style={{ display: 'none' }}>
                          <ShoppingBag className="w-16 h-16 text-blue-600" />
                        </div>
                        {product.images.length > 1 && (
                          <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
                            +{product.images.length - 1}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-16 h-16 text-blue-600" />
                      </div>
                    )}
                  </div>
                  <CardTitle className="text-lg line-clamp-2">{product.name}</CardTitle>
                  <CardDescription className="text-sm text-gray-600 line-clamp-3">
                    {product.description || "Producto de alta calidad"}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-2xl font-bold text-green-600">
                      ${formatCurrency(product.price)}
                    </div>
                    <Badge variant="secondary">
                      {product.category}
                    </Badge>
                  </div>
                </CardContent>
              </div>
              
              <CardContent className="pt-0 pb-4">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(product.id);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* El resto del JSX (carrito, modales, etc.) se mantiene igual... */}
      
    </div>
  );
}