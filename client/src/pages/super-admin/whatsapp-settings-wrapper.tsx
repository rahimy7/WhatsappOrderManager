import { useEffect, useState } from "react";
import { useParams } from "wouter";
import WhatsAppSettings from "@/pages/whatsapp-settings";

export default function WhatsAppSettingsWrapper() {
  const params = useParams<{ storeId: string }>();
  const [storeId, setStoreId] = useState<number | null>(null);

  useEffect(() => {
    // Obtener storeId desde URL params o query string
    let id: number | null = null;
    
    if (params.storeId) {
      id = parseInt(params.storeId);
    } else {
      // Fallback: buscar en query string
      const urlParams = new URLSearchParams(window.location.search);
      const storeParam = urlParams.get('store');
      if (storeParam) {
        id = parseInt(storeParam);
      }
    }
    
    setStoreId(id);
  }, [params.storeId]);

  if (!storeId) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-600 mb-4">
            ID de tienda requerido
          </h1>
          <p className="text-gray-500">
            No se pudo determinar la tienda para configurar WhatsApp
          </p>
        </div>
      </div>
    );
  }

  return <WhatsAppSettings storeId={storeId} />;
}