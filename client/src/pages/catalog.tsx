import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Package, 
  Filter,
  Grid,
  List,
  Search,
  Tag
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Product, ProductCategory } from "@shared/schema";

type ProductWithCategory = Product & { category: ProductCategory };

const PRODUCTS_PER_PAGE = 12;

export default function Catalog() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [cartItems, setCartItems] = useState<Record<number, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"]
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<ProductCategory[]>({
    queryKey: ["/api/categories"]
  });

  // Cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      return apiRequest("POST", "/api/cart", {
        productId,
        quantity,
        sessionId: sessionStorage.getItem("session-id") || `session-${Date.now()}`
      });
    },
    onSuccess: () => {
      toast({
        title: "Producto agregado",
        description: "El producto se agregó al carrito exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo agregar el producto al carrito",
        variant: "destructive",
      });
    }
  });

  // Generate session ID if not exists
  useEffect(() => {
    if (!sessionStorage.getItem("session-id")) {
      sessionStorage.setItem("session-id", `session-${Date.now()}`);
    }
  }, []);

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory && product.status === "active";
  });

  const handleAddToCart = (productId: number) => {
    const currentQuantity = cartItems[productId] || 0;
    const newQuantity = currentQuantity + 1;
    
    setCartItems(prev => ({ ...prev, [productId]: newQuantity }));
    addToCartMutation.mutate({ productId, quantity: 1 });
  };

  const handleQuantityChange = (productId: number, change: number) => {
    const currentQuantity = cartItems[productId] || 0;
    const newQuantity = Math.max(0, currentQuantity + change);
    
    if (newQuantity === 0) {
      setCartItems(prev => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
    } else {
      setCartItems(prev => ({ ...prev, [productId]: newQuantity }));
    }
  };

  const formatPrice = (price: string, salePrice?: string | null) => {
    const originalPrice = parseFloat(price);
    const discountPrice = salePrice ? parseFloat(salePrice) : null;
    
    return (
      <div className="flex items-center gap-2">
        {discountPrice && discountPrice < originalPrice ? (
          <>
            <span className="text-lg font-bold text-green-600">${discountPrice.toFixed(2)}</span>
            <span className="text-sm text-gray-500 line-through">${originalPrice.toFixed(2)}</span>
            <Badge variant="secondary" className="text-xs">
              -{Math.round(((originalPrice - discountPrice) / originalPrice) * 100)}%
            </Badge>
          </>
        ) : (
          <span className="text-lg font-bold text-primary">${originalPrice.toFixed(2)}</span>
        )}
      </div>
    );
  };

  const ProductCard = ({ product }: { product: Product }) => (
    <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md overflow-hidden">
      <div className="relative">
        {product.imageUrl ? (
          <img 
            src={product.imageUrl} 
            alt={product.name}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
            <Package className="w-16 h-16 text-blue-300" />
          </div>
        )}
        
        {product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price) && (
          <Badge className="absolute top-2 right-2 bg-red-500 hover:bg-red-600">
            OFERTA
          </Badge>
        )}
        
        {product.stock !== null && product.stock < 10 && (
          <Badge variant="outline" className="absolute top-2 left-2 bg-white">
            Últimas {product.stock} unidades
          </Badge>
        )}
      </div>
      
      <CardHeader className="pb-2">
        <CardTitle className="text-lg line-clamp-2">{product.name}</CardTitle>
        {product.brand && (
          <Badge variant="outline" className="w-fit">
            <Tag className="w-3 h-3 mr-1" />
            {product.brand}
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        {product.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
        )}
        
        {formatPrice(product.price, product.salePrice)}
        
        <div className="flex items-center justify-between">
          {cartItems[product.id] ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleQuantityChange(product.id, -1)}
                className="h-8 w-8 p-0"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium w-8 text-center">
                {cartItems[product.id]}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleQuantityChange(product.id, 1)}
                className="h-8 w-8 p-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => handleAddToCart(product.id)}
              disabled={addToCartMutation.isPending}
              className="flex-1"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const ProductListItem = ({ product }: { product: Product }) => (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {product.imageUrl ? (
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-24 h-24 object-cover rounded-lg"
            />
          ) : (
            <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-8 h-8 text-blue-300" />
            </div>
          )}
          
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{product.name}</h3>
                {product.brand && (
                  <Badge variant="outline" className="mt-1">
                    <Tag className="w-3 h-3 mr-1" />
                    {product.brand}
                  </Badge>
                )}
              </div>
              {formatPrice(product.price, product.salePrice)}
            </div>
            
            {product.description && (
              <p className="text-sm text-gray-600">{product.description}</p>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {product.salePrice && parseFloat(product.salePrice) < parseFloat(product.price) && (
                  <Badge className="bg-red-500 hover:bg-red-600">OFERTA</Badge>
                )}
                {product.stock !== null && product.stock < 10 && (
                  <Badge variant="outline">Últimas {product.stock} unidades</Badge>
                )}
              </div>
              
              {cartItems[product.id] ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuantityChange(product.id, -1)}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium w-8 text-center">
                    {cartItems[product.id]}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuantityChange(product.id, 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => handleAddToCart(product.id)}
                  disabled={addToCartMutation.isPending}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Agregar al carrito
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (productsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200"></div>
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo de Productos</h1>
          <p className="text-gray-600 mt-1">Encuentra todo lo que necesitas para aires acondicionados</p>
        </div>
        
        <Link href="/cart">
          <Button className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Ver Carrito
            {Object.keys(cartItems).length > 0 && (
              <Badge variant="secondary">
                {Object.values(cartItems).reduce((sum, qty) => sum + qty, 0)}
              </Badge>
            )}
          </Button>
        </Link>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
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
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Products */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {filteredProducts.length} productos encontrados
          </p>
        </div>

        {filteredProducts.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              No se encontraron productos
            </h3>
            <p className="text-gray-500">
              Intenta cambiar los filtros o términos de búsqueda
            </p>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product) => (
              <ProductListItem key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}