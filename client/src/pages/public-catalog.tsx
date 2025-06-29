import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Search, Filter, Heart, Star, Plus, Minus, ShoppingBag, MessageCircle, Phone, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Product, ProductCategory } from "@shared/schema";

type ProductWithCategory = Product & { category: ProductCategory };

export default function PublicCatalog() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [cartItems, setCartItems] = useState<Map<number, number>>(new Map());
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener productos
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["/api/products"],
  });

  // Función para obtener/crear sessionId único
  const getSessionId = () => {
    let sessionId = localStorage.getItem('cart-session-id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('cart-session-id', sessionId);
    }
    return sessionId;
  };

  // Obtener sessionId
  const sessionId = getSessionId();

  // Obtener categorías
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["/api/categories"],
  });

  // State local del carrito
  const [localCart, setLocalCart] = useState<{items: any[], subtotal: number}>(() => {
    try {
      const saved = localStorage.getItem(`cart_${sessionId}`);
      return saved ? JSON.parse(saved) : { items: [], subtotal: 0 };
    } catch {
      return { items: [], subtotal: 0 };
    }
  });

  // Sincronizar con localStorage
  useEffect(() => {
    localStorage.setItem(`cart_${sessionId}`, JSON.stringify(localCart));
  }, [localCart, sessionId]);

  console.log('Local cart:', localCart);

  // Agregar al carrito local
  const addToCart = async (productId: number, quantity: number = 1) => {
    try {
      // Obtener información del producto
      const product = (products as any[])?.find(p => p.id === productId);
      if (!product) {
        toast({
          title: "Error",
          description: "Producto no encontrado",
          variant: "destructive",
        });
        return;
      }

      setLocalCart(prev => {
        const existingItem = prev.items.find(item => item.productId === productId);
        let newItems;
        
        if (existingItem) {
          // Actualizar cantidad existente
          newItems = prev.items.map(item =>
            item.productId === productId
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        } else {
          // Agregar nuevo producto
          newItems = [...prev.items, {
            id: Date.now(),
            productId,
            quantity,
            product: {
              id: product.id,
              name: product.name,
              price: product.price
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
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo agregar el producto",
        variant: "destructive",
      });
    }
  };

  // Remover del carrito
  const removeFromCartMutation = useMutation({
    mutationFn: async (productId: number) => {
      const sessionId = getSessionId();
      return apiRequest("DELETE", `/api/cart/remove/${productId}?sessionId=${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Producto removido",
        description: "El producto se removió del carrito",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Actualizar cantidad en carrito
  const updateCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      const currentSessionId = getSessionId();
      return apiRequest("PUT", "/api/cart/update", { productId, quantity, sessionId: currentSessionId });
    },
    onSuccess: () => {
      const currentSessionId = getSessionId();
      queryClient.invalidateQueries({ queryKey: ["/api/cart", currentSessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Función para enviar carrito por WhatsApp
  const sendToWhatsApp = () => {
    const cartData = cart as any;
    if (!cartData?.items || cartData.items.length === 0) {
      toast({
        title: "Carrito vacío",
        description: "Agrega productos al carrito antes de enviar a WhatsApp",
        variant: "destructive",
      });
      return;
    }

    const cartMessage = cartData.items.map((item: any) => 
      `• ${item.product?.name || 'Producto'} - Cantidad: ${item.quantity} - Precio: $${item.product?.price || '0'}`
    ).join('\n');

    const whatsappMessage = `¡Hola! Me interesa cotizar estos productos:\n\n${cartMessage}\n\nSubtotal: $${cartData.subtotal}\n\n¿Podrían ayudarme con más información y el costo de instalación?`;
    
    const encodedMessage = encodeURIComponent(whatsappMessage);
    const whatsappNumber = "5215534166960"; // Número de WhatsApp de la empresa
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    setIsCartOpen(false);
    
    toast({
      title: "Redirigiendo a WhatsApp",
      description: "Se abrirá WhatsApp con tu lista de productos",
    });
  };

  // Obtener total de items en carrito
  const getTotalCartItems = () => {
    const cartData = cart as any;
    if (!cartData?.items || !Array.isArray(cartData.items)) return 0;
    return cartData.items.reduce((total: number, item: any) => total + item.quantity, 0);
  };

  // Filtrar productos
  const filteredProducts = products.filter((product: Product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const isActive = product.status === "active";
    return matchesSearch && matchesCategory && isActive;
  });

  const handleAddToCart = (productId: number) => {
    const currentQuantity = cartItems.get(productId) || 1;
    addToCartMutation.mutate({ productId, quantity: currentQuantity });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return;
    setCartItems(prev => new Map(prev.set(productId, quantity)));
  };

  const toggleFavorite = (productId: number) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
      } else {
        newFavorites.add(productId);
      }
      return newFavorites;
    });
  };

  const ProductCard = ({ product }: { product: Product }) => (
    <Card className="group hover:shadow-lg transition-all duration-300 border-gray-200">
      <CardHeader className="pb-4">
        <div className="aspect-square bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
          <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-blue-600" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleFavorite(product.id)}
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/80 hover:bg-white"
          >
            <Heart className={`w-4 h-4 ${favorites.has(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
          </Button>
        </div>
        
        <div className="space-y-2">
          <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {product.name}
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 line-clamp-2">
            {product.description}
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-green-600">${product.price}</span>
            <Badge variant={product.category === "service" ? "secondary" : "default"} className="text-xs">
              {product.category === "service" ? "Servicio" : "Producto"}
            </Badge>
          </div>
          <div className="flex items-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            ))}
            <span className="text-sm text-gray-500 ml-1">4.5</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateQuantity(product.id, Math.max(1, (cartItems.get(product.id) || 1) - 1))}
              className="h-8 w-8 p-0"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="w-8 text-center text-sm font-medium">
              {cartItems.get(product.id) || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateQuantity(product.id, (cartItems.get(product.id) || 1) + 1)}
              className="h-8 w-8 p-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <Button
            onClick={() => handleAddToCart(product.id)}
            disabled={addToCartMutation.isPending}
            className="flex-1 ml-4"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Agregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const ProductListItem = ({ product }: { product: Product }) => (
    <Card className="flex items-center p-4 space-x-4 hover:shadow-md transition-shadow">
      <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <ShoppingBag className="w-8 h-8 text-blue-600" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-900 mb-1">{product.name}</h3>
            <p className="text-gray-600 text-sm mb-2 line-clamp-1">{product.description}</p>
            <div className="flex items-center space-x-4">
              <span className="text-xl font-bold text-green-600">${product.price}</span>
              <Badge variant={product.category === "service" ? "secondary" : "default"}>
                {product.category === "service" ? "Servicio" : "Producto"}
              </Badge>
              <div className="flex items-center space-x-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="text-sm text-gray-500 ml-1">4.5</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleFavorite(product.id)}
              className="h-8 w-8 rounded-full"
            >
              <Heart className={`w-4 h-4 ${favorites.has(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
            </Button>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateQuantity(product.id, Math.max(1, (cartItems.get(product.id) || 1) - 1))}
                className="h-8 w-8 p-0"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="w-8 text-center text-sm font-medium">
                {cartItems.get(product.id) || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateQuantity(product.id, (cartItems.get(product.id) || 1) + 1)}
                className="h-8 w-8 p-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <Button
              onClick={() => handleAddToCart(product.id)}
              disabled={addToCartMutation.isPending}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );

  if (loadingProducts || loadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header independiente sin sidebar */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ServicePro - Catálogo</h1>
              <p className="text-gray-600 mt-1">
                Descubre nuestra selección de productos y servicios de climatización
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                {getTotalCartItems() > 0 ? (
                  `${getTotalCartItems()} producto${getTotalCartItems() > 1 ? 's' : ''} en carrito`
                ) : (
                  'Selecciona productos para agregar al carrito'
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Filtros y búsqueda */}
        <div className="flex flex-col md:flex-row gap-4 p-4 bg-white rounded-lg shadow-sm border">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((category: ProductCategory) => (
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-r-none"
            >
              <div className="grid grid-cols-2 gap-1 w-4 h-4">
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
              </div>
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-l-none"
            >
              <div className="space-y-1">
                <div className="h-1 w-4 bg-current rounded"></div>
                <div className="h-1 w-4 bg-current rounded"></div>
                <div className="h-1 w-4 bg-current rounded"></div>
              </div>
            </Button>
          </div>
        </div>

        {/* Productos */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {filteredProducts.length} productos encontrados
            </h2>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron productos</h3>
              <p className="text-gray-600">
                Intenta ajustar tus filtros o términos de búsqueda
              </p>
            </div>
          ) : (
            <div className={viewMode === "grid" 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
              : "space-y-4"
            }>
              {filteredProducts.map((product: Product) =>
                viewMode === "grid" 
                  ? <ProductCard key={product.id} product={product} />
                  : <ProductListItem key={product.id} product={product} />
              )}
            </div>
          )}
        </div>

        {/* Footer informativo */}
        <div className="mt-16 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">¿Necesitas ayuda personalizada?</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Nuestro equipo de expertos está listo para ayudarte a encontrar la solución perfecta para tu hogar o negocio. 
              Contactanos para una cotización personalizada.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                onClick={() => window.open('https://wa.me/5215534166960', '_blank')}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                WhatsApp: +52 55 3416 6960
              </Button>
              <Button 
                onClick={() => window.open('tel:+5215534166960', '_blank')}
                variant="outline" 
                className="px-6 py-3"
              >
                <Phone className="w-5 h-5 mr-2" />
                Llamar ahora
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Horario de atención: Lunes a Viernes 9:00 AM - 6:00 PM | Sábados 9:00 AM - 2:00 PM
            </p>
          </div>
        </div>
      </div>

      {/* Botón flotante del carrito - Siempre visible */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsCartOpen(!isCartOpen)}
          className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 relative"
        >
          <ShoppingCart className="w-6 h-6" />
          <Badge className="absolute -top-2 -right-2 px-2 py-1 text-xs bg-red-500 text-white min-w-[24px] h-6 flex items-center justify-center rounded-full">
            {getTotalCartItems()}
          </Badge>
        </Button>
      </div>

      {/* Panel desplegable del carrito */}
      {isCartOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setIsCartOpen(false)}>
          <div 
            className="fixed bottom-0 right-0 w-full max-w-md h-auto max-h-[80vh] bg-white rounded-t-3xl shadow-2xl transform transition-transform duration-300 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del carrito */}
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">Mi Carrito</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCartOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Items del carrito */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-96">
              {(cart as any)?.items && Array.isArray((cart as any).items) && (cart as any).items.length > 0 ? (
                (cart as any).items.map((item: any) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-6 h-6 text-blue-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {item.product?.name || 'Producto'}
                      </h4>
                      <p className="text-sm text-gray-600">
                        ${item.product?.price || '0'} c/u
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCartMutation.mutate({ 
                          productId: item.productId, 
                          quantity: Math.max(1, item.quantity - 1) 
                        })}
                        className="h-8 w-8 p-0"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateCartMutation.mutate({ 
                          productId: item.productId, 
                          quantity: item.quantity + 1 
                        })}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCartMutation.mutate(item.productId)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Tu carrito está vacío</p>
                </div>
              )}
            </div>

            {/* Footer con total y botón de WhatsApp */}
            {(cart as any)?.items && Array.isArray((cart as any).items) && (cart as any).items.length > 0 && (
              <div className="border-t p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-900">Subtotal:</span>
                  <span className="text-2xl font-bold text-green-600">${(cart as any).subtotal || '0.00'}</span>
                </div>
                
                <Button
                  onClick={sendToWhatsApp}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-medium"
                  disabled={!(cart as any)?.items || (cart as any).items.length === 0}
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Hacer Pedido por WhatsApp
                </Button>
                
                <p className="text-xs text-gray-500 text-center">
                  Se abrirá WhatsApp con tu lista de productos para continuar con el pedido
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}