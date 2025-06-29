import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Search, Filter, Heart, Star, Plus, Minus, ShoppingBag, MessageCircle, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Product, ProductCategory } from "@shared/schema";
import { Link } from "wouter";

type ProductWithCategory = Product & { category: ProductCategory };

export default function Catalog() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [cartItems, setCartItems] = useState<Map<number, number>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener productos
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["/api/products"],
  });

  // Obtener categorías
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Obtener carrito
  const { data: cart = { items: [], subtotal: 0 } } = useQuery({
    queryKey: ["/api/cart"],
  });

  // Agregar al carrito
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      return apiRequest("POST", "/api/cart/add", { productId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Producto agregado",
        description: "El producto se agregó al carrito exitosamente",
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

  // Función para enviar carrito por WhatsApp
  const sendToWhatsApp = () => {
    if (!cart.items || cart.items.length === 0) {
      toast({
        title: "Carrito vacío",
        description: "Agrega productos al carrito antes de enviar a WhatsApp",
        variant: "destructive",
      });
      return;
    }

    const cartMessage = cart.items.map((item: any) => 
      `• ${item.productName || 'Producto'} - Cantidad: ${item.quantity} - Precio: $${item.unitPrice}`
    ).join('\n');

    const whatsappMessage = `¡Hola! Me interesa cotizar estos productos:\n\n${cartMessage}\n\nSubtotal: $${cart.subtotal}\n\n¿Podrían ayudarme con más información y el costo de instalación?`;
    
    const encodedMessage = encodeURIComponent(whatsappMessage);
    const whatsappNumber = "5215534166960"; // Número de WhatsApp de la empresa
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
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
    <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="relative">
        <div className="aspect-square bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
          {product.imageUrl ? (
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-6">
              <ShoppingBag className="w-16 h-16 text-blue-400 mx-auto mb-2" />
              <span className="text-sm text-gray-500">{product.name}</span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => toggleFavorite(product.id)}
        >
          <Heart className={`w-4 h-4 ${favorites.has(product.id) ? 'fill-red-500 text-red-500' : ''}`} />
        </Button>
        {product.brand && (
          <Badge className="absolute top-2 left-2 bg-white/90 text-gray-800">
            {product.brand}
          </Badge>
        )}
      </div>
      
      <CardHeader className="pb-2">
        <CardTitle className="text-lg leading-tight">{product.name}</CardTitle>
        <CardDescription className="text-sm line-clamp-2">
          {product.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-green-600">
              ${parseFloat(product.price).toLocaleString()}
            </div>
            {product.category && (
              <Badge variant="secondary" className="text-xs">
                {product.category}
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm text-gray-600">4.5</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => updateQuantity(product.id, Math.max(1, (cartItems.get(product.id) || 1) - 1))}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="px-3 py-1 min-w-[40px] text-center text-sm">
              {cartItems.get(product.id) || 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => updateQuantity(product.id, (cartItems.get(product.id) || 1) + 1)}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <Button
            onClick={() => handleAddToCart(product.id)}
            disabled={addToCartMutation.isPending}
            className="flex-1"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Agregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const ProductListItem = ({ product }: { product: Product }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            {product.imageUrl ? (
              <img 
                src={product.imageUrl} 
                alt={product.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <ShoppingBag className="w-8 h-8 text-blue-400" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <h3 className="font-semibold text-lg">{product.name}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                <div className="flex items-center space-x-2">
                  {product.brand && (
                    <Badge variant="outline" className="text-xs">{product.brand}</Badge>
                  )}
                  {product.category && (
                    <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                  )}
                </div>
              </div>
              
              <div className="text-right space-y-2">
                <div className="text-2xl font-bold text-green-600">
                  ${parseFloat(product.price).toLocaleString()}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center border rounded-md">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => updateQuantity(product.id, Math.max(1, (cartItems.get(product.id) || 1) - 1))}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="px-3 py-1 min-w-[40px] text-center text-sm">
                      {cartItems.get(product.id) || 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => updateQuantity(product.id, (cartItems.get(product.id) || 1) + 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleAddToCart(product.id)}
                    disabled={addToCartMutation.isPending}
                    size="sm"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loadingProducts || loadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo de Productos</h1>
          <p className="text-gray-600 mt-1">
            Descubre nuestra selección de productos y servicios de climatización
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {cart.items?.length > 0 && (
            <>
              <Button 
                onClick={sendToWhatsApp}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Enviar a WhatsApp
              </Button>
              <Link href="/cart">
                <Button variant="outline" className="relative">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Carrito
                  <Badge className="absolute -top-2 -right-2 px-2 py-1 text-xs">
                    {cart.items.length}
                  </Badge>
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

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
            <div className="space-y-1 w-4 h-4">
              <div className="bg-current h-1 rounded-sm"></div>
              <div className="bg-current h-1 rounded-sm"></div>
              <div className="bg-current h-1 rounded-sm"></div>
            </div>
          </Button>
        </div>
      </div>

      {/* Resultados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-gray-600">
            {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
          </p>
          
          {favorites.size > 0 && (
            <Button variant="outline" size="sm">
              <Heart className="w-4 h-4 mr-2 fill-red-500 text-red-500" />
              {favorites.size} favorito{favorites.size !== 1 ? 's' : ''}
            </Button>
          )}
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
  );
}