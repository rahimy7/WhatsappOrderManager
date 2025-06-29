import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowLeft,
  Package,
  CreditCard,
  ShoppingBag,
  Percent
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ShoppingCart as CartItem, Product } from "@shared/schema";

type CartItemWithProduct = CartItem & { product: Product };

export default function Cart() {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate session ID if not exists
  const getSessionId = () => {
    let sessionId = sessionStorage.getItem("session-id");
    if (!sessionId) {
      sessionId = `session-${Date.now()}`;
      sessionStorage.setItem("session-id", sessionId);
    }
    return sessionId;
  };

  // Fetch cart items
  const { data: cartItems = [], isLoading } = useQuery<CartItemWithProduct[]>({
    queryKey: ["/api/cart"],
    queryFn: () => apiRequest("GET", `/api/cart?sessionId=${getSessionId()}`).then(res => res.json())
  });

  // Update cart item mutation
  const updateCartMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: number; quantity: number }) => {
      return apiRequest("PUT", `/api/cart/${id}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el producto",
        variant: "destructive",
      });
    }
  });

  // Remove cart item mutation
  const removeCartMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/cart/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Producto eliminado",
        description: "El producto se eliminó del carrito",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el producto",
        variant: "destructive",
      });
    }
  });

  // Clear cart mutation
  const clearCartMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/cart?sessionId=${getSessionId()}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Carrito vaciado",
        description: "Se eliminaron todos los productos del carrito",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo vaciar el carrito",
        variant: "destructive",
      });
    }
  });

  const handleQuantityChange = (item: CartItemWithProduct, change: number) => {
    const newQuantity = Math.max(1, item.quantity + change);
    updateCartMutation.mutate({ id: item.id, quantity: newQuantity });
  };

  const handleRemoveItem = (id: number) => {
    removeCartMutation.mutate(id);
  };

  const handleClearCart = () => {
    if (window.confirm("¿Estás seguro de que quieres vaciar el carrito?")) {
      clearCartMutation.mutate();
    }
  };

  const handleCheckout = () => {
    setIsCheckingOut(true);
    // Simular proceso de checkout
    setTimeout(() => {
      toast({
        title: "Pedido procesado",
        description: "Tu pedido ha sido procesado exitosamente",
      });
      clearCartMutation.mutate();
      setIsCheckingOut(false);
    }, 2000);
  };

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => {
    const price = parseFloat(item.product.salePrice || item.product.price);
    return sum + (price * item.quantity);
  }, 0);

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const discount = subtotal > 1000 ? subtotal * 0.1 : 0; // 10% descuento si el subtotal > $1000
  const delivery = subtotal > 500 ? 0 : 50; // Envío gratis si el subtotal > $500
  const total = subtotal - discount + delivery;

  const formatPrice = (price: string, salePrice?: string | null) => {
    const originalPrice = parseFloat(price);
    const discountPrice = salePrice ? parseFloat(salePrice) : null;
    
    return discountPrice && discountPrice < originalPrice ? discountPrice : originalPrice;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-200 rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/catalog">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al catálogo
            </Button>
          </Link>
        </div>

        <Card className="p-8 text-center">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">
            Tu carrito está vacío
          </h2>
          <p className="text-gray-500 mb-6">
            Agrega algunos productos para comenzar tu compra
          </p>
          <Link href="/catalog">
            <Button>
              <ShoppingBag className="w-4 h-4 mr-2" />
              Ver productos
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/catalog">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Continuar comprando
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Carrito de Compras</h1>
            <p className="text-gray-600">
              {totalItems} {totalItems === 1 ? 'producto' : 'productos'} en tu carrito
            </p>
          </div>
        </div>
        
        {cartItems.length > 0 && (
          <Button 
            variant="outline" 
            onClick={handleClearCart}
            disabled={clearCartMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Vaciar carrito
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  {/* Product Image */}
                  {item.product.imageUrl ? (
                    <img 
                      src={item.product.imageUrl} 
                      alt={item.product.name}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-blue-300" />
                    </div>
                  )}
                  
                  {/* Product Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{item.product.name}</h3>
                        {item.product.brand && (
                          <Badge variant="outline" className="mt-1">
                            {item.product.brand}
                          </Badge>
                        )}
                        {item.product.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {item.product.description}
                          </p>
                        )}
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={removeCartMutation.isPending}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuantityChange(item, -1)}
                          disabled={updateCartMutation.isPending || item.quantity <= 1}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="text-lg font-medium w-12 text-center">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuantityChange(item, 1)}
                          disabled={updateCartMutation.isPending}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Price */}
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          {item.product.salePrice && parseFloat(item.product.salePrice) < parseFloat(item.product.price) ? (
                            <>
                              <span className="text-lg font-bold text-green-600">
                                ${formatPrice(item.product.price, item.product.salePrice).toFixed(2)}
                              </span>
                              <span className="text-sm text-gray-500 line-through">
                                ${parseFloat(item.product.price).toFixed(2)}
                              </span>
                            </>
                          ) : (
                            <span className="text-lg font-bold text-primary">
                              ${parseFloat(item.product.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Total: ${(formatPrice(item.product.price, item.product.salePrice) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Resumen del pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal ({totalItems} productos)</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <Percent className="w-4 h-4" />
                      Descuento (10%)
                    </span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span>Envío</span>
                  {delivery === 0 ? (
                    <span className="text-green-600 font-medium">Gratis</span>
                  ) : (
                    <span>${delivery.toFixed(2)}</span>
                  )}
                </div>
              </div>
              
              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              
              {subtotal < 500 && (
                <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                  Agrega ${(500 - subtotal).toFixed(2)} más para envío gratis
                </p>
              )}
              
              {subtotal > 900 && subtotal < 1000 && (
                <p className="text-sm text-purple-600 bg-purple-50 p-2 rounded">
                  Agrega ${(1000 - subtotal).toFixed(2)} más para 10% de descuento
                </p>
              )}
              
              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={isCheckingOut || cartItems.length === 0}
              >
                {isCheckingOut ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </div>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Proceder al pago
                  </>
                )}
              </Button>
              
              <Link href="/catalog">
                <Button variant="outline" className="w-full">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Seguir comprando
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}