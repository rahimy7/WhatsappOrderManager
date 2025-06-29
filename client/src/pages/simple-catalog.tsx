import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Search, Filter, Heart, Star, Plus, Minus, ShoppingBag, MessageCircle, Phone, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function SimpleCatalog() {
  const { toast } = useToast();
  
  // Obtener configuración de la tienda
  const { data: storeConfig } = useQuery({
    queryKey: ["/api/settings/store"],
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
  
  // Estado del carrito local
  const [cart, setCart] = useState<{items: any[], subtotal: number}>(() => {
    try {
      const saved = localStorage.getItem(`cart_${sessionId}`);
      if (saved) {
        const parsedCart = JSON.parse(saved);
        // Agregar algunos productos de demostración si el carrito está vacío
        if (parsedCart.items.length === 0) {
          const demoItems = [
            {
              id: Date.now(),
              productId: 6,
              quantity: 2,
              product: {
                id: 6,
                name: "Instalación de Aires Acondicionados",
                price: 2500
              }
            },
            {
              id: Date.now() + 1,
              productId: 7,
              quantity: 1,
              product: {
                id: 7,
                name: "Reparación de Refrigeradores",
                price: 800
              }
            }
          ];
          const demoSubtotal = demoItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
          return { items: demoItems, subtotal: demoSubtotal };
        }
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

  // Obtener productos
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["/api/products"],
  });

  // Obtener categorías
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Función para agregar al carrito
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

  // Función para enviar por WhatsApp
  const sendToWhatsApp = () => {
    if (cart.items.length === 0) {
      toast({
        title: "Carrito vacío",
        description: "Agrega productos antes de hacer el pedido",
        variant: "destructive",
      });
      return;
    }

    // Verificar que tenemos configuración de WhatsApp de la tienda
    if (!storeConfig?.storeWhatsAppNumber) {
      toast({
        title: "Error de configuración",
        description: "No se ha configurado el número de WhatsApp de la tienda",
        variant: "destructive",
      });
      return;
    }

    let message = `🛍️ *NUEVO PEDIDO - ${storeConfig.storeName || 'Tienda'}*\n\n`;
    
    cart.items.forEach((item, index) => {
      message += `${index + 1}. ${item.product.name}\n`;
      message += `   Cantidad: ${item.quantity}\n`;
      message += `   Precio unitario: $${item.product.price}\n`;
      message += `   Subtotal: $${item.product.price * item.quantity}\n\n`;
    });
    
    message += `💰 *TOTAL: $${cart.subtotal}*\n\n`;
    message += "Por favor confirma tu pedido y proporciona tu dirección de entrega.";

    const encodedMessage = encodeURIComponent(message);
    // Limpiar el número de WhatsApp (remover caracteres especiales)
    const cleanWhatsAppNumber = storeConfig.storeWhatsAppNumber.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanWhatsAppNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    // Vaciar el carrito después del envío
    const emptyCart = { items: [], subtotal: 0 };
    setCart(emptyCart);
    localStorage.setItem(`cart_${sessionId}`, JSON.stringify(emptyCart));
    
    // Cerrar el panel del carrito
    setIsCartOpen(false);
    
    toast({
      title: "Pedido enviado",
      description: "Tu carrito se ha vaciado y el pedido se envió por WhatsApp",
    });
  };

  // Filtrar productos
  const filteredProducts = products.filter((product: any) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loadingProducts || loadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Catálogo de Productos</h1>
              <div className="text-sm text-gray-600">
                {filteredProducts.length} productos encontrados
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category: any) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
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
              <CardHeader className="pb-4">
                <div className="w-full h-48 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-16 h-16 text-blue-600" />
                </div>
                <CardTitle className="text-lg line-clamp-2">{product.name}</CardTitle>
                <CardDescription className="text-sm text-gray-600 line-clamp-3">
                  {product.description || "Producto de alta calidad"}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-2xl font-bold text-green-600">
                    ${product.price}
                  </div>
                  <Badge variant="secondary">
                    {product.category}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < 4 ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                    />
                  ))}
                  <span className="text-sm text-gray-600 ml-1">4.5</span>
                </div>
                
                <Button
                  onClick={() => addToCart(product.id)}
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

      {/* Botón flotante del carrito */}
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

      {/* Panel del carrito */}
      {isCartOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-25" onClick={() => setIsCartOpen(false)}>
          <div 
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              {/* Header del carrito */}
              <div className="flex items-center justify-between p-6 border-b bg-green-50">
                <h2 className="text-xl font-semibold text-gray-900">
                  Mi Carrito ({getTotalCartItems()} productos)
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCartOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Items del carrito */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.items.length > 0 ? (
                  cart.items.map((item: any) => (
                    <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-6 h-6 text-blue-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {item.product.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          ${item.product.price} c/u
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
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
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(item.productId)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-2">Tu carrito está vacío</p>
                    <p className="text-gray-400 text-sm">Agrega productos para comenzar tu pedido</p>
                  </div>
                )}
              </div>

              {/* Footer del carrito */}
              {cart.items.length > 0 && (
                <div className="border-t bg-white p-6 space-y-4">
                  <div className="flex justify-between items-center text-lg font-semibold">
                    <span>Total:</span>
                    <span className="text-green-600">${cart.subtotal}</span>
                  </div>
                  
                  <Button
                    onClick={sendToWhatsApp}
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-lg"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Hacer Pedido por WhatsApp
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}