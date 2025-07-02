import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Palette, Monitor, Smartphone, Eye, Upload, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface StoreTheme {
  id: number;
  storeId: number;
  // Brand Colors
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  // Logo and Images
  logoUrl?: string;
  bannerUrl?: string;
  faviconUrl?: string;
  // Typography
  fontFamily?: string;
  headingFont?: string;
  // Layout
  headerLayout?: string;
  footerLayout?: string;
  productLayout?: string;
  // Custom CSS
  customCss?: string;
  // Social Media
  facebookUrl?: string;
  instagramUrl?: string;
  whatsappUrl?: string;
  websiteUrl?: string;
}

const colorPresets = [
  { name: "WhatsApp Verde", primary: "#25D366", secondary: "#128C7E", accent: "#075E54" },
  { name: "Azul Profesional", primary: "#1E40AF", secondary: "#3B82F6", accent: "#60A5FA" },
  { name: "Naranja Energético", primary: "#EA580C", secondary: "#FB923C", accent: "#FDBA74" },
  { name: "Púrpura Moderno", primary: "#7C3AED", secondary: "#A855F7", accent: "#C084FC" },
  { name: "Rojo Corporativo", primary: "#DC2626", secondary: "#EF4444", accent: "#F87171" },
  { name: "Verde Natura", primary: "#059669", secondary: "#10B981", accent: "#34D399" },
];

const fontOptions = [
  { name: "Inter", value: "Inter, sans-serif" },
  { name: "Roboto", value: "Roboto, sans-serif" },
  { name: "Open Sans", value: "Open Sans, sans-serif" },
  { name: "Montserrat", value: "Montserrat, sans-serif" },
  { name: "Poppins", value: "Poppins, sans-serif" },
  { name: "Lato", value: "Lato, sans-serif" },
];

export default function StoreThemes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Get store ID from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');
    if (storeParam) {
      setStoreId(parseInt(storeParam));
    }
  }, []);

  // Fetch store info
  const { data: store } = useQuery({
    queryKey: ["/api/super-admin/stores", storeId],
    queryFn: () => apiRequest("GET", `/api/super-admin/stores/${storeId}`),
    enabled: !!storeId,
  });

  // Fetch theme settings
  const { data: theme, isLoading } = useQuery({
    queryKey: ["/api/super-admin/store-themes", storeId],
    queryFn: () => apiRequest("GET", `/api/super-admin/store-themes/${storeId}`),
    enabled: !!storeId,
  });

  // Update theme mutation
  const updateThemeMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest("PUT", `/api/super-admin/store-themes/${storeId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/store-themes", storeId] });
      toast({
        title: "Tema actualizado",
        description: "Los cambios se han guardado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo actualizar el tema",
        variant: "destructive",
      });
    },
  });

  const handleSaveTheme = (formData: FormData, section: string) => {
    const data: any = {};
    
    for (const [key, value] of formData.entries()) {
      data[key] = value || null;
    }

    updateThemeMutation.mutate(data);
  };

  const applyColorPreset = (preset: typeof colorPresets[0]) => {
    const data = {
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
    };
    updateThemeMutation.mutate(data);
  };

  if (!storeId) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600">No se especificó una tienda válida</p>
          <Button onClick={() => window.history.back()} className="mt-4">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Temas y Personalización</h1>
          <p className="text-gray-600 mt-2">
            {store?.storeName || "Tienda"} • Personaliza la apariencia de la tienda
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.history.back()} variant="outline">
            Volver
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Vista Previa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Vista Previa del Tema</DialogTitle>
                <DialogDescription>
                  Visualiza cómo se verá tu tienda con el tema actual
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={previewMode === 'desktop' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewMode('desktop')}
                    className="flex items-center gap-2"
                  >
                    <Monitor className="h-4 w-4" />
                    Escritorio
                  </Button>
                  <Button
                    variant={previewMode === 'mobile' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewMode('mobile')}
                    className="flex items-center gap-2"
                  >
                    <Smartphone className="h-4 w-4" />
                    Móvil
                  </Button>
                </div>
                <div 
                  className={`border rounded-lg ${previewMode === 'mobile' ? 'w-80 h-96' : 'w-full h-96'} mx-auto`}
                  style={{
                    backgroundColor: theme?.backgroundColor || '#ffffff',
                    color: theme?.textColor || '#000000',
                    fontFamily: theme?.fontFamily || 'Inter, sans-serif'
                  }}
                >
                  <div 
                    className="p-4 border-b"
                    style={{ backgroundColor: theme?.primaryColor || '#25D366' }}
                  >
                    <h3 className="text-white font-bold">{store?.storeName || "Mi Tienda"}</h3>
                  </div>
                  <div className="p-4">
                    <div className="space-y-4">
                      <div 
                        className="p-3 rounded"
                        style={{ backgroundColor: theme?.secondaryColor || '#f3f4f6' }}
                      >
                        <h4 className="font-medium">Producto de Ejemplo</h4>
                        <p className="text-sm opacity-75">Descripción del producto...</p>
                        <div 
                          className="inline-block px-3 py-1 rounded text-white text-sm mt-2"
                          style={{ backgroundColor: theme?.accentColor || '#059669' }}
                        >
                          $999.00
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="colors" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="colors">Colores</TabsTrigger>
          <TabsTrigger value="branding">Marca</TabsTrigger>
          <TabsTrigger value="typography">Tipografía</TabsTrigger>
          <TabsTrigger value="layout">Diseño</TabsTrigger>
          <TabsTrigger value="social">Redes Sociales</TabsTrigger>
        </TabsList>

        {/* Colors Tab */}
        <TabsContent value="colors">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Esquemas de Color Predefinidos
                </CardTitle>
                <CardDescription>
                  Selecciona un esquema de color para aplicar rápidamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {colorPresets.map((preset) => (
                    <div 
                      key={preset.name}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => applyColorPreset(preset)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <div 
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: preset.primary }}
                          />
                          <div 
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: preset.secondary }}
                          />
                          <div 
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: preset.accent }}
                          />
                        </div>
                        <span className="font-medium">{preset.name}</span>
                      </div>
                      <Button size="sm" variant="outline">
                        Aplicar
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Colores Personalizados</CardTitle>
                <CardDescription>
                  Personaliza los colores específicos de tu tienda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveTheme(new FormData(e.currentTarget), 'colors');
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="primaryColor">Color Primario</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="primaryColor" 
                          name="primaryColor"
                          type="color"
                          defaultValue={theme?.primaryColor || "#25D366"}
                          className="w-16 h-10 p-1"
                        />
                        <Input 
                          name="primaryColor"
                          defaultValue={theme?.primaryColor || "#25D366"}
                          placeholder="#25D366"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="secondaryColor">Color Secundario</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="secondaryColor" 
                          name="secondaryColor"
                          type="color"
                          defaultValue={theme?.secondaryColor || "#128C7E"}
                          className="w-16 h-10 p-1"
                        />
                        <Input 
                          name="secondaryColor"
                          defaultValue={theme?.secondaryColor || "#128C7E"}
                          placeholder="#128C7E"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="accentColor">Color de Acento</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="accentColor" 
                          name="accentColor"
                          type="color"
                          defaultValue={theme?.accentColor || "#075E54"}
                          className="w-16 h-10 p-1"
                        />
                        <Input 
                          name="accentColor"
                          defaultValue={theme?.accentColor || "#075E54"}
                          placeholder="#075E54"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="backgroundColor">Color de Fondo</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="backgroundColor" 
                          name="backgroundColor"
                          type="color"
                          defaultValue={theme?.backgroundColor || "#FFFFFF"}
                          className="w-16 h-10 p-1"
                        />
                        <Input 
                          name="backgroundColor"
                          defaultValue={theme?.backgroundColor || "#FFFFFF"}
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="textColor">Color de Texto</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="textColor" 
                        name="textColor"
                        type="color"
                        defaultValue={theme?.textColor || "#000000"}
                        className="w-16 h-10 p-1"
                      />
                      <Input 
                        name="textColor"
                        defaultValue={theme?.textColor || "#000000"}
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" disabled={updateThemeMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateThemeMutation.isPending ? "Guardando..." : "Guardar Colores"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Elementos de Marca</CardTitle>
              <CardDescription>
                Configura el logo, banner y favicon de tu tienda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveTheme(new FormData(e.currentTarget), 'branding');
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="logoUrl">URL del Logo</Label>
                  <Input 
                    id="logoUrl" 
                    name="logoUrl"
                    placeholder="https://ejemplo.com/logo.png"
                    defaultValue={theme?.logoUrl || ""}
                  />
                  {theme?.logoUrl && (
                    <div className="mt-2">
                      <img 
                        src={theme.logoUrl} 
                        alt="Logo preview" 
                        className="h-12 w-auto"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="bannerUrl">URL del Banner</Label>
                  <Input 
                    id="bannerUrl" 
                    name="bannerUrl"
                    placeholder="https://ejemplo.com/banner.jpg"
                    defaultValue={theme?.bannerUrl || ""}
                  />
                  {theme?.bannerUrl && (
                    <div className="mt-2">
                      <img 
                        src={theme.bannerUrl} 
                        alt="Banner preview" 
                        className="h-24 w-auto rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="faviconUrl">URL del Favicon</Label>
                  <Input 
                    id="faviconUrl" 
                    name="faviconUrl"
                    placeholder="https://ejemplo.com/favicon.ico"
                    defaultValue={theme?.faviconUrl || ""}
                  />
                  {theme?.faviconUrl && (
                    <div className="mt-2">
                      <img 
                        src={theme.faviconUrl} 
                        alt="Favicon preview" 
                        className="h-8 w-8"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
                
                <Button type="submit" disabled={updateThemeMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateThemeMutation.isPending ? "Guardando..." : "Guardar Elementos de Marca"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Typography Tab */}
        <TabsContent value="typography">
          <Card>
            <CardHeader>
              <CardTitle>Tipografía</CardTitle>
              <CardDescription>
                Selecciona las fuentes para tu tienda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveTheme(new FormData(e.currentTarget), 'typography');
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fontFamily">Fuente Principal</Label>
                    <select 
                      id="fontFamily"
                      name="fontFamily"
                      defaultValue={theme?.fontFamily || "Inter, sans-serif"}
                      className="w-full p-2 border rounded-md"
                    >
                      {fontOptions.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                    <div 
                      className="mt-2 p-3 border rounded text-sm"
                      style={{ fontFamily: theme?.fontFamily || 'Inter, sans-serif' }}
                    >
                      Ejemplo de texto con esta fuente
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="headingFont">Fuente de Títulos</Label>
                    <select 
                      id="headingFont"
                      name="headingFont"
                      defaultValue={theme?.headingFont || "Inter, sans-serif"}
                      className="w-full p-2 border rounded-md"
                    >
                      {fontOptions.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                    <div 
                      className="mt-2 p-3 border rounded text-lg font-bold"
                      style={{ fontFamily: theme?.headingFont || 'Inter, sans-serif' }}
                    >
                      Título de Ejemplo
                    </div>
                  </div>
                </div>
                
                <Button type="submit" disabled={updateThemeMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateThemeMutation.isPending ? "Guardando..." : "Guardar Tipografía"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layout Tab */}
        <TabsContent value="layout">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Diseño</CardTitle>
              <CardDescription>
                Personaliza el layout y CSS de tu tienda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveTheme(new FormData(e.currentTarget), 'layout');
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="customCss">CSS Personalizado</Label>
                  <Textarea 
                    id="customCss" 
                    name="customCss"
                    placeholder="/* Escribe tu CSS personalizado aquí */"
                    defaultValue={theme?.customCss || ""}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
                
                <Button type="submit" disabled={updateThemeMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateThemeMutation.isPending ? "Guardando..." : "Guardar CSS"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Media Tab */}
        <TabsContent value="social">
          <Card>
            <CardHeader>
              <CardTitle>Redes Sociales</CardTitle>
              <CardDescription>
                Configura los enlaces a redes sociales de la tienda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveTheme(new FormData(e.currentTarget), 'social');
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="facebookUrl">Facebook</Label>
                    <Input 
                      id="facebookUrl" 
                      name="facebookUrl"
                      placeholder="https://facebook.com/tutienda"
                      defaultValue={theme?.facebookUrl || ""}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="instagramUrl">Instagram</Label>
                    <Input 
                      id="instagramUrl" 
                      name="instagramUrl"
                      placeholder="https://instagram.com/tutienda"
                      defaultValue={theme?.instagramUrl || ""}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="whatsappUrl">WhatsApp</Label>
                    <Input 
                      id="whatsappUrl" 
                      name="whatsappUrl"
                      placeholder="https://wa.me/5215512345678"
                      defaultValue={theme?.whatsappUrl || ""}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="websiteUrl">Sitio Web</Label>
                    <Input 
                      id="websiteUrl" 
                      name="websiteUrl"
                      placeholder="https://tutienda.com"
                      defaultValue={theme?.websiteUrl || ""}
                    />
                  </div>
                </div>
                
                <Button type="submit" disabled={updateThemeMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateThemeMutation.isPending ? "Guardando..." : "Guardar Redes Sociales"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}