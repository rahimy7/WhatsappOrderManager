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

const formatCurrency = (amount: string | number) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return numAmount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// ✅ FUNCIÓN OPTIMIZADA para hacer requests a endpoints públicos
const fetchPublicData = async (endpoint: string) => {
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export default function OptimizedCatalog() {
  const { toast } = useToast();
  
  // Estados del componente
  const [storeId, setStoreId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // ✅ OBTENER storeId de la URL de forma más robusta
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store') || urlParams.get('storeId');
    
    if (storeParam) {
      const parsedStoreId = parseInt(storeParam);
      if (!isNaN(parsedStoreId)) {
        setStoreId(parsedStoreId);
      } else {
        console.error('Invalid store ID in URL:', storeParam);
      }
    } else {
      // Si no hay parámetro de tienda, mostrar error o redirigir
      console.error('No store ID provided in URL');
    }
  }, []);

  // ✅ OPTIMIZADO: Obtener información de la tienda
  const { data: storeInfo, isLoading: loadingStore, error: storeError } = useQuery({
    queryKey: [`/api/public/stores/${storeId}/info`],
    queryFn: () => fetchPublicData(`/api/public/stores/${storeId}/info`),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  // ✅ OPTIMIZADO: Obtener configuración del catálogo
  const { data: catalogConfig } = useQuery({
    queryKey: [`/api/public/stores/${storeId}/catalog-config`],
    queryFn: () => fetchPublicData(`/api/public/stores/${storeId}/catalog-config`),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ OPTIMIZADO: Obtener productos SOLO de la tienda específica
  const { data: products = [], isLoading: loadingProducts, error: productsError } = useQuery({
    queryKey: [`/api/public/stores/${storeId}/products`],
    queryFn: () => fetchPublicData(`/api/public/stores/${storeId}/products`),
    enabled: !!storeId,
    staleTime: 2 * 60 * 1000, // Cache por 2 minutos
  });

  // ✅ OPTIMIZADO: Obtener categorías SOLO de la tienda específica
  const { data: categories = [], isLoading: loadingCategories, error: categoriesError } = useQuery({
    queryKey: [`/api/public/stores/${storeId}/categories`],
    queryFn: () => fetchPublicData(`/api/public/stores/${storeId}/categories`),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ CARGAR carrito desde localStorage al iniciar
  useEffect(() => {
    if (storeId) {
      const savedCart = localStorage.getItem(`cart_store_${storeId}`);
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (error) {
          console.error('Error loading cart from localStorage:', error);
          localStorage.removeItem(`cart_store_${storeId}`);
        }
      }

      // Limpiar carrito si se marcó como enviado
      const pedidoEnviado = localStorage.getItem('pedido_enviado');
      if (pedidoEnviado) {
        setCart([]);
        localStorage.removeItem(`cart_store_${storeId}`);
        localStorage.removeItem('pedido_enviado');
      }
    }
  }, [storeId]);

  // ✅ GUARDAR carrito en localStorage cuando cambie
  useEffect(() => {
    if (storeId && cart.length > 0) {
      localStorage.setItem(`cart_store_${storeId}`, JSON.stringify(cart));
    } else if (storeId) {
      localStorage.removeItem(`cart_store_${storeId}`);
    }
  }, [cart, storeId]);

  // ✅ GESTIÓN DEL CARRITO
  const addToCart = (product: any) => {
    setCart(currentCart => {
      const existingItem = currentCart.find(item => item.id === product.id);
      if (existingItem) {
        return currentCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...currentCart, { ...product, quantity: 1 }];
      }
    });

    toast({
      title: "✅ Producto agregado",
      description: `${product.name} se agregó al carrito`,
      // Configuración para aparecer en la parte superior
      className: "top-0 right-0 flex fixed md:max-w-[420px] md:top-4 md:right-4",
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(currentCart => currentCart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(currentCart =>
      currentCart.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const getTotalItems = () => cart.reduce((sum, item) => sum + item.quantity, 0);
  const getTotalPrice = () => cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

  // ✅ ENVIAR PEDIDO por WhatsApp
  const sendOrderToWhatsApp = () => {
    if (cart.length === 0) {
      toast({
        title: "⚠️ Carrito vacío",
        description: "Agrega productos antes de enviar el pedido",
        variant: "destructive",
        className: "top-0 right-0 flex fixed md:max-w-[420px] md:top-4 md:right-4",
      });
      return;
    }

    const whatsappNumber = catalogConfig?.whatsappNumber || storeInfo?.phone;
    if (!whatsappNumber) {
      toast({
        title: "❌ Error",
        description: "No se encontró número de WhatsApp de la tienda",
        variant: "destructive",
        className: "top-0 right-0 flex fixed md:max-w-[420px] md:top-4 md:right-4",
      });
      return;
    }

    let message = `🛍️ *NUEVO PEDIDO - ${storeInfo?.name || 'Catálogo'}*\n\n`;
    
    cart.forEach((item, index) => {
      message += `${index + 1}. *${item.name}*`;
      message += `[ID:${item.id}]\n`;
      message += `   Cantidad: ${item.quantity}\n`;
      message += `   Precio unitario: $${formatCurrency(item.price)}\n`;
      message += `   Subtotal: $${formatCurrency(parseFloat(item.price) * item.quantity)}\n\n`;
    });

    message += `💰 *TOTAL: $${formatCurrency(getTotalPrice())}*\n\n`;
 

    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = whatsappNumber.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    localStorage.setItem('pedido_enviado', 'true');
    setIsCartOpen(false);
    
    toast({
      title: "✅ ¡Pedido enviado!",
      description: "El carrito se vaciará la próxima vez que abras el catálogo",
      className: "top-0 right-0 flex fixed md:max-w-[420px] md:top-4 md:right-4",
    });
  };

  // ✅ FILTRADO DE PRODUCTOS (ya optimizado, no se filtra por storeId)
  const filteredProducts = Array.isArray(products) ? products.filter((product: any) => {
    if (!product) return false;
    
    const matchesSearch = product.name && product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  }) : [];

  // ✅ MANEJO DE ERRORES
  if (storeError || productsError || categoriesError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar el catálogo</h2>
          <p className="text-gray-600 mb-4">
            {storeError ? 'Tienda no encontrada o inactiva' : 'Error al cargar productos'}
          </p>
          <Button onClick={() => window.location.reload()} className="bg-red-500 hover:bg-red-600">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  // ✅ ESTADO DE CARGA
  if (loadingStore || loadingProducts || loadingCategories || !storeId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Cargando catálogo de la tienda...</p>
          {storeId && <p className="text-gray-500 text-sm mt-2">Tienda ID: {storeId}</p>}
        </div>
      </div>
    );
  }

  // ✅ SIN PRODUCTOS
  if (!loadingProducts && filteredProducts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
        <div className="text-center max-w-md mx-auto p-8">
          <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {searchTerm || selectedCategory !== "all" ? "No se encontraron productos" : "Catálogo en construcción"}
          </h2>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedCategory !== "all" 
              ? "Intenta con otros términos de búsqueda o categorías."
              : `${storeInfo?.name || 'Esta tienda'} no tiene productos disponibles aún.`}
          </p>
          {(searchTerm || selectedCategory !== "all") && (
            <Button 
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
              }}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              Ver todos los productos
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 relative">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">
                  🛍️ {storeInfo?.name || 'Catálogo'}
                </h1>
                {storeInfo?.description && (
                  <p className="text-emerald-100 mt-1">{storeInfo.description}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-emerald-100 bg-white/20 px-3 py-1 rounded-full">
                  {filteredProducts.length} productos
                </div>
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
                    <SelectItem key={category.id || category.name} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de productos */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product: any) => (
            <Card key={product.id} className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm hover:bg-white/95">
              <CardContent className="p-0">
                <div className="aspect-square bg-gradient-to-br from-emerald-100 to-teal-100 rounded-t-lg relative overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-16 h-16 text-emerald-300" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge variant={product.type === 'service' ? 'secondary' : 'default'} className="bg-white/90 text-emerald-700">
                      {product.type === 'service' ? '🔧 Servicio' : '📦 Producto'}
                    </Badge>
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                    {product.name}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {product.description}
                  </p>

                  <div className="flex items-center justify-between mb-4">
                    <div className="text-2xl font-bold text-emerald-600">
                      ${formatCurrency(product.price)}
                    </div>
                    {product.category && (
                      <Badge variant="outline" className="text-xs">
                        {product.category}
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => addToCart(product)}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar
                    </Button>
                    <Button
                      onClick={() => setSelectedProduct(product)}
                      variant="outline"
                      className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                    >
                      Ver
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 🚀 BOTÓN FLOTANTE DEL CARRITO */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsCartOpen(true)}
          className="relative bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 rounded-full w-16 h-16 p-0 transform hover:scale-110"
          size="lg"
        >
          <ShoppingCart className="w-6 h-6" />
          {getTotalItems() > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse shadow-lg">
              {getTotalItems()}
            </div>
          )}
        </Button>
      </div>

      {/* Modal de carrito */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShoppingCart className="w-6 h-6" />
              Tu Carrito ({getTotalItems()} productos)
            </DialogTitle>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Tu carrito está vacío</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="w-16 h-16 bg-emerald-100 rounded-lg flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <ShoppingBag className="w-8 h-8 text-emerald-500" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-emerald-600 font-semibold">${formatCurrency(item.price)}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      variant="outline"
                      size="sm"
                      className="w-8 h-8 p-0"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      variant="outline"
                      size="sm"
                      className="w-8 h-8 p-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => removeFromCart(item.id)}
                      variant="outline"
                      size="sm"
                      className="w-8 h-8 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total:</span>
                  <span className="text-emerald-600">${formatCurrency(getTotalPrice())}</span>
                </div>
                
                <Button
                  onClick={sendOrderToWhatsApp}
                  className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white text-lg py-3"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Enviar Pedido por WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de producto */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedProduct.name}</DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="aspect-square bg-emerald-100 rounded-lg overflow-hidden">
                  {selectedProduct.imageUrl ? (
                    <img 
                      src={selectedProduct.imageUrl} 
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-24 h-24 text-emerald-300" />
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-600 mb-4">{selectedProduct.description}</p>
                    
                    <div className="text-3xl font-bold text-emerald-600 mb-4">
                      ${formatCurrency(selectedProduct.price)}
                    </div>

                    {selectedProduct.specifications && (
                      <div className="mb-4">
                        <h4 className="font-semibold mb-2">Especificaciones:</h4>
                        <p className="text-gray-600 text-sm">{selectedProduct.specifications}</p>
                      </div>
                    )}

                    {selectedProduct.stock !== null && (
                      <div className="mb-4">
                        <Badge variant={selectedProduct.stock > 0 ? "default" : "destructive"}>
                          {selectedProduct.stock > 0 ? `${selectedProduct.stock} disponibles` : 'Sin stock'}
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                    disabled={selectedProduct.stock === 0}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar al Carrito
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}