import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ConversationList from "@/components/conversations/conversation-list";
import ChatWindow from "@/components/conversations/chat-window";
import { ConversationWithDetails } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

// ✅ Función para obtener conversaciones - CORREGIDA CON CLAVE CORRECTA
const fetchConversations = async (): Promise<ConversationWithDetails[]> => {
  try {
    // ✅ USAR LA CLAVE CORRECTA: auth_token en lugar de token
    const token = localStorage.getItem('auth_token'); // ✅ Cambio clave
    
    // ✅ VERIFICAR QUE EL TOKEN EXISTA
    if (!token) {
      console.error('❌ No authentication token found');
      // Redirigir al login o lanzar error
      window.location.href = '/login';
      throw new Error('No authentication token available');
    }

    console.log('🔍 Making request with token:', token.substring(0, 20) + '...');

    const response = await fetch('/api/conversations', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // ✅ Usar variable, no llamada directa
      },
    });

    // ✅ LOGGING DETALLADO DE LA RESPUESTA
    console.log('📡 Response details:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: {
        'content-type': response.headers.get('content-type'),
        'authorization': response.headers.get('authorization')
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Fetch error details:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });

      // ✅ MANEJO ESPECÍFICO DE ERROR 401
      if (response.status === 401) {
        console.error('❌ Authentication failed - clearing token and redirecting');
        localStorage.removeItem('auth_token'); // ✅ Cambio clave
        window.location.href = '/login';
        throw new Error('Authentication failed');
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // ✅ Asegurar que siempre retorne un array
    if (Array.isArray(data)) {
      return data;
    } else if (data && Array.isArray(data.conversations)) {
      return data.conversations;
    } else {
      console.warn('Unexpected conversations data format:', data);
      return [];
    }
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

export default function Conversations() {
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ✅ useQuery corregido con queryFn
  const { 
    data: conversations = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ["/api/conversations"],
    queryFn: fetchConversations,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30000, // 30 seconds
    gcTime: 300000,   // 5 minutes (renamed from cacheTime)
  });

  const handleSelectConversation = (conversation: ConversationWithDetails) => {
    setSelectedConversation(conversation);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  // ✅ Manejo de errores
  if (error) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error al cargar conversaciones</h3>
          <p className="text-red-600 text-sm mt-1">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            size="sm" 
            className="mt-2"
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 h-[calc(100vh-200px)] md:h-[600px]">
        {/* Mobile: Show either list or chat */}
        {isMobile ? (
          <>
            {!selectedConversation ? (
              <div className="col-span-1">
                <ConversationList
                  conversations={conversations}
                  isLoading={isLoading}
                  selectedConversation={selectedConversation}
                  onSelectConversation={handleSelectConversation}
                />
              </div>
            ) : (
              <div className="col-span-1">
                <div className="mb-3">
                  <Button 
                    variant="ghost" 
                    onClick={handleBackToList}
                    className="text-sm"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a conversaciones
                  </Button>
                </div>
                <ChatWindow conversation={selectedConversation} />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Desktop: Show both */}
            <div className="lg:col-span-1">
              <ConversationList
                conversations={conversations}
                isLoading={isLoading}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
              />
            </div>
            
            <div className="lg:col-span-2">
              <ChatWindow conversation={selectedConversation} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}