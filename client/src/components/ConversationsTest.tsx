// client/src/components/ConversationsTest.tsx
// Componente completo para probar la funcionalidad de conversaciones

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Conversation {
  id: number;
  customerId: number;
  customerName?: string;
  customerPhone?: string;
  conversationType: string;
  status: string;
  lastMessageAt: string;
  createdAt: string;
}

interface Message {
  id: number;
  conversationId: number;
  senderType: string;
  content: string;
  sentAt: string;
}

interface DebugData {
  debug: boolean;
  user: any;
  data: {
    conversations: { count: number; sample: Conversation[] };
    customers: { count: number; sample: any[] };
    messages: { count: number; sample: Message[] };
  };
}

export default function ConversationsTest() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const queryClient = useQueryClient();

  // Query para obtener conversaciones
  const { data: conversations, isLoading, error, refetch: refetchConversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const response = await fetch("/api/conversations", {
        headers: {
          Authorization: "Bearer " + localStorage.getItem('token')
        }
      });
      
      if (!response.ok) {
        throw new Error("Error: " + response.status);
      }
      
      return response.json();
    }
  });

  // Query para debug
  const { data: debugData } = useQuery({
    queryKey: ["debug", "conversations"],
    queryFn: async () => {
      const response = await fetch("/api/debug/conversations", {
        headers: {
          Authorization: "Bearer " + localStorage.getItem('token')
        }
      });
      
      if (!response.ok) {
        throw new Error("Error: " + response.status);
      }
      
      return response.json();
    }
  });

  // Query para obtener mensajes de conversación seleccionada
  const { data: messages } = useQuery({
    queryKey: ["conversations", selectedConversation?.id, "messages"],
    queryFn: async () => {
      if (!selectedConversation) return [];
      
      const response = await fetch("/api/conversations/" + selectedConversation.id + "/messages", {
        headers: {
          Authorization: "Bearer " + localStorage.getItem('token')
        }
      });
      
      if (!response.ok) {
        throw new Error("Error: " + response.status);
      }
      
      return response.json();
    },
    enabled: !!selectedConversation
  });

  // Mutation para crear conversación
  const createConversationMutation = useMutation({
    mutationFn: async (conversationData: { customerId: number; conversationType: string; status: string }) => {
      const response = await fetch("/api/conversations", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: "Bearer " + localStorage.getItem('token')
        },
        body: JSON.stringify(conversationData)
      });
      
      if (!response.ok) {
        throw new Error("Error: " + response.status);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  });

  // Mutation para crear mensaje
  const createMessageMutation = useMutation({
    mutationFn: async (messageData: { conversationId: number; content: string; senderType: string }) => {
      const response = await fetch("/api/conversations/" + messageData.conversationId + "/messages", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: "Bearer " + localStorage.getItem('token')
        },
        body: JSON.stringify(messageData)
      });
      
      if (!response.ok) {
        throw new Error("Error: " + response.status);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", selectedConversation?.id, "messages"] });
      setNewMessage("");
    }
  });

  const handleSendMessage = () => {
    if (!selectedConversation || !newMessage.trim()) return;
    
    createMessageMutation.mutate({
      conversationId: selectedConversation.id,
      content: newMessage,
      senderType: 'agent'
    });
  };

  const handleCreateTestConversation = () => {
    createConversationMutation.mutate({
      customerId: 1,
      conversationType: 'test',
      status: 'active'
    });
  };

  // Ejecutar todas las pruebas automatizadas
  const runAllTests = async () => {
    setIsRunningTests(true);
    console.log('🧪 Ejecutando todas las pruebas...');
    
    try {
      // Ejecutar la función de prueba del frontend si está disponible
      if ((window as any).testConversationsAPI) {
        const results = await (window as any).testConversationsAPI();
        setTestResults(results);
        console.log('✅ Pruebas completadas:', results);
      } else {
        console.log('⚠️ testConversationsAPI no está disponible');
        setTestResults({ error: 'testConversationsAPI function not available' });
      }
    } catch (error) {
      console.error('❌ Error ejecutando pruebas:', error);
      setTestResults({ error: (error as Error).message });
    } finally {
      setIsRunningTests(false);
    }
  };

  // Test de autenticación
  const testAuth = async () => {
    if ((window as any).testAuthentication) {
      const result = await (window as any).testAuthentication();
      console.log('Auth test result:', result);
      if (result.success) {
        refetchConversations();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">🧪 Test de Conversaciones</h1>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <p>Cargando conversaciones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">🧪 Test de Conversaciones</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {(error as Error).message}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={testAuth}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            🔐 Test Auth
          </button>
          <button 
            onClick={runAllTests}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            disabled={isRunningTests}
          >
            {isRunningTests ? '⏳ Ejecutando...' : '🧪 Ejecutar Todas las Pruebas'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🧪 Test Completo de Conversaciones</h1>
      
      {/* Panel de control de pruebas */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Panel de Control de Pruebas</h2>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={testAuth}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            🔐 Test Auth
          </button>
          <button 
            onClick={runAllTests}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            disabled={isRunningTests}
          >
            {isRunningTests ? '⏳ Ejecutando...' : '🧪 Ejecutar Todas las Pruebas'}
          </button>
          <button 
            onClick={handleCreateTestConversation}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
            disabled={createConversationMutation.isPending}
          >
            {createConversationMutation.isPending ? '⏳' : '➕'} Crear Conversación Test
          </button>
          <button 
            onClick={() => (window as any).cleanupTestData?.()}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            🧹 Limpiar Datos Test
          </button>
          <button 
            onClick={() => refetchConversations()}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            🔄 Refrescar
          </button>
        </div>
      </div>

      {/* Resultados de pruebas automatizadas */}
      {testResults && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">📊 Resultados de Pruebas Automatizadas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {testResults.conversations?.length || 0}
              </div>
              <div className="text-sm text-gray-600">Conversaciones</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {testResults.debug ? '✅' : '❌'}
              </div>
              <div className="text-sm text-gray-600">Debug OK</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {testResults.createConversation?.id ? '✅' : '❌'}
              </div>
              <div className="text-sm text-gray-600">Crear Conv</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {testResults.errors?.length || 0}
              </div>
              <div className="text-sm text-gray-600">Errores</div>
            </div>
          </div>
          
          {testResults.errors && testResults.errors.length > 0 && (
            <div className="bg-red-100 border border-red-300 rounded p-3">
              <h3 className="font-semibold text-red-800 mb-2">Errores encontrados:</h3>
              <ul className="text-sm text-red-700 space-y-1">
                {testResults.errors.map((error: string, index: number) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Debug info */}
      {debugData && (
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">🐛 Información de Debug</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-3 rounded border">
              <h3 className="font-semibold">Usuario</h3>
              <p className="text-sm">ID: {debugData.user?.id}</p>
              <p className="text-sm">Store: {debugData.user?.storeId}</p>
              <p className="text-sm">Role: {debugData.user?.role}</p>
            </div>
            <div className="bg-white p-3 rounded border">
              <h3 className="font-semibold">Conversaciones</h3>
              <p className="text-sm">Count: {debugData.data?.conversations?.count || 0}</p>
              <p className="text-sm">Sample: {debugData.data?.conversations?.sample?.length || 0}</p>
            </div>
            <div className="bg-white p-3 rounded border">
              <h3 className="font-semibold">Mensajes</h3>
              <p className="text-sm">Count: {debugData.data?.messages?.count || 0}</p>
              <p className="text-sm">Sample: {debugData.data?.messages?.sample?.length || 0}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de conversaciones */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">
            Conversaciones ({conversations?.length || 0})
          </h2>
          
          {!conversations || conversations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No hay conversaciones disponibles</p>
              <button 
                onClick={handleCreateTestConversation}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                disabled={createConversationMutation.isPending}
              >
                {createConversationMutation.isPending ? 'Creando...' : 'Crear Conversación de Prueba'}
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {conversations.map((conversation: Conversation) => (
                <div 
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={"p-3 border rounded cursor-pointer hover:bg-gray-50 transition-colors " + (
                    selectedConversation?.id === conversation.id ? 'bg-blue-50 border-blue-300' : ''
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">
                        {conversation.customerName || "Cliente " + conversation.customerId}
                      </div>
                      <div className="text-sm text-gray-500">
                        {conversation.customerPhone} • {conversation.status}
                      </div>
                      <div className="text-xs text-gray-400">
                        Tipo: {conversation.conversationType}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(conversation.lastMessageAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                      ID: {conversation.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mensajes de conversación seleccionada */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">
            {selectedConversation 
              ? "Mensajes - " + (selectedConversation.customerName || "Cliente " + selectedConversation.customerId)
              : 'Selecciona una conversación'
            }
          </h2>
          
          {selectedConversation ? (
            <>
              <div className="h-64 border rounded p-3 overflow-y-auto mb-3 bg-gray-50">
                {messages && messages.length > 0 ? (
                  messages.map((message: Message) => (
                    <div 
                      key={message.id}
                      className={"mb-2 p-2 rounded max-w-xs " + (
                        message.senderType === 'agent' 
                          ? 'bg-blue-500 text-white ml-auto' 
                          : 'bg-white border'
                      )}
                    >
                      <div className="text-sm">{message.content}</div>
                      <div className={"text-xs opacity-75 " + (
                        message.senderType === 'agent' ? 'text-blue-100' : 'text-gray-500'
                      )}>
                        {message.senderType} • {new Date(message.sentAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center">No hay mensajes</p>
                )}
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 border rounded px-3 py-2"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || createMessageMutation.isPending}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {createMessageMutation.isPending ? '...' : 'Enviar'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Selecciona una conversación para ver los mensajes
            </p>
          )}
        </div>
      </div>
      
      {/* Estado detallado de la API */}
      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">📊 Estado Detallado de la API:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="font-medium">Conversaciones</div>
            <div>Cargadas: {conversations?.length || 0}</div>
            <div>Seleccionada: {selectedConversation ? "ID " + selectedConversation.id : 'Ninguna'}</div>
          </div>
          <div>
            <div className="font-medium">Mensajes</div>
            <div>Cargados: {messages?.length || 0}</div>
            <div>Debug: {debugData ? '✅' : '❌'}</div>
          </div>
          <div>
            <div className="font-medium">Mutations</div>
            <div>Crear Conv: {createConversationMutation.isPending ? 'Enviando...' : 'Listo'}</div>
            <div>Crear Msg: {createMessageMutation.isPending ? 'Enviando...' : 'Listo'}</div>
          </div>
          <div>
            <div className="font-medium">Auth</div>
            <div>Token: {localStorage.getItem('token') ? '✅' : '❌'}</div>
            <div>Estado: {error ? '❌' : '✅'}</div>
          </div>
        </div>
        
        {/* Enlaces útiles */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="font-medium mb-2">🔗 Enlaces Útiles:</h4>
          <div className="flex flex-wrap gap-2 text-sm">
            <a 
              href="/api/debug/conversations" 
              target="_blank"
              className="text-blue-600 hover:underline"
            >
              Debug API
            </a>
            <a 
              href="/api/conversations" 
              target="_blank"
              className="text-blue-600 hover:underline"
            >
              Conversations API
            </a>
            <button 
              onClick={() => console.log('Debug data:', debugData)}
              className="text-blue-600 hover:underline"
            >
              Log Debug to Console
            </button>
            <button 
              onClick={() => console.log('Conversations:', conversations)}
              className="text-blue-600 hover:underline"
            >
              Log Conversations to Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
