import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MessageCircle, Star, ShoppingBag, Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Product, ProductCategory } from "@shared/schema";

type ProductWithCategory = Product & { category: ProductCategory };

interface CartItem {
  id: number;
  product: any;
  quantity: number;
}

export default function PublicCatalogClean() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  // Obtener productos
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["/api/products"],
  });

  // Obtener categorías
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Cargar carrito desde localStorage al iniciar
  useEffect(() => {
    const savedCart = localStorage.getItem("publicCatalogCart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error("Error loading cart:", error);
      }
    }
  }, []);

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem("publicCatalogCart", JSON.stringify(cart));
  }, [cart]);

  // Agregar producto al carrito
  const addToCart = (product: any) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, { id: Date.now(), product, quantity: 1 }];
      }
    });

    toast({
      title: "Producto agregado",
      description: `${product.name} agregado al carrito`,
    });
  };

  // Actualizar cantidad en carrito
  const updateQuantity = (itemId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  // Remover del carrito
  const removeFromCart = (itemId: number) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  // Calcular total del carrito
  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const price = parseFloat(item.product.price) || 0;
      return total + (price * item.quantity);
    }, 0);
  };

  // Obtener cantidad total de items
  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  // Enviar carrito por WhatsApp
  const sendCartToWhatsApp = () => {
    if (cart.length === 0) {
      toast({
        title: "Carrito vacío",
        description: "Agrega productos al carrito antes de enviar",
        variant: "destructive",
      });
      return;
    }

    const cartMessage = cart.map(item => 
      `• ${item.product.name} - Cantidad: ${item.quantity} - Precio: $${item.product.price} c/u`
    ).join('\n');

    const total = getCartTotal();
    const whatsappMessage = `¡Hola! Me interesa cotizar estos productos:\n\n${cartMessage}\n\nSubtotal: $${total.toFixed(2)}\n\n¿Podrían ayudarme con más información y el costo de instalación?`;
    const whatsappUrl = `https://wa.me/5215512345678?text=${encodeURIComponent(whatsappMessage)}`;

    window.open(whatsappUrl, '_blank');

    toast({
      title: "Redirigiendo a WhatsApp",
      description: "Se abrirá WhatsApp con tu lista de productos",
    });
  };

  // Filtrar productos
  const filteredProducts = products.filter((product: any) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const isActive = product.status === "active";
    return matchesSearch && matchesCategory && isActive;
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">ServicePro - Catálogo</h1>
            <p className="text-gray-600">Descubre nuestra selección de productos y servicios de climatización</p>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
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

          <div className="text-center mt-4 text-sm text-gray-600">
            {filteredProducts.length} productos encontrados
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
                  onClick={() => addToCart(product)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar al carrito
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Necesitas ayuda?</h3>
          <p className="text-gray-600 mb-4">Contáctanos directamente por WhatsApp para obtener asesoría personalizada</p>
          <Button
            onClick={() => {
              const whatsappUrl = `https://wa.me/5215512345678?text=${encodeURIComponent('¡Hola! Me gustaría obtener más información sobre sus productos y servicios.')}`;
              window.open(whatsappUrl, '_blank');
            }}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Hablar con un asesor
          </Button>
        </div>
      </div>

      {/* Botón flotante del carrito */}
      {getTotalItems() > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setShowCart(!showCart)}
            className="bg-green-600 hover:bg-green-700 text-white rounded-full w-16 h-16 shadow-lg relative"
          >
            <ShoppingCart className="w-6 h-6" />
            <Badge className="absolute -top-2 -right-2 bg-red-500 text-white min-w-[24px] h-6 rounded-full flex items-center justify-center text-xs">
              {getTotalItems()}
            </Badge>
          </Button>

          {/* Panel del carrito */}
          {showCart && (
            <div className="absolute bottom-20 right-0 bg-white rounded-lg shadow-xl border w-96 max-h-96 overflow-y-auto">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-lg flex items-center justify-between">
                  Carrito de compras
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCart(false)}
                  >
                    ×
                  </Button>
                </h3>
              </div>

              <div className="p-4 space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-100 rounded flex items-center justify-center">
                      <ShoppingBag className="w-6 h-6 text-blue-600" />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.product.name}</h4>
                      <p className="text-green-600 font-semibold">${item.product.price}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 p-0"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 p-0"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold text-green-600 text-lg">
                    ${getCartTotal().toFixed(2)}
                  </span>
                </div>
                
                <Button
                  onClick={sendCartToWhatsApp}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Solicitar por WhatsApp
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}