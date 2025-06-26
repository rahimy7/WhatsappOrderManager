import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle, Phone, User } from "lucide-react";
import { ConversationWithDetails, Message } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import SendMessageModal from "@/components/whatsapp/send-message-modal";

interface ChatWindowProps {
  conversation: ConversationWithDetails | null;
}

export default function ChatWindow({ conversation }: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState("");
  const [showSendModal, setShowSendModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch messages for the current conversation
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["/api/conversations", conversation?.id, "messages"],
    queryFn: () => conversation?.id ? fetch(`/api/conversations/${conversation.id}/messages`).then(res => res.json()) : [],
    enabled: !!conversation?.id,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversation) throw new Error("No conversation selected");
      return apiRequest(`/api/conversations/${conversation.id}/messages`, "POST", {
        content,
        senderType: "staff",
        messageType: "text"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversation?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setNewMessage("");
      toast({
        title: "Mensaje enviado",
        description: "El mensaje ha sido enviado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    },
  });

  // Mark messages as read when conversation changes
  useEffect(() => {
    if (conversation?.id) {
      apiRequest("POST", `/api/conversations/${conversation.id}/mark-read`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    }
  }, [conversation?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessageMutation.mutate(newMessage.trim());
    }
  };

  const formatMessageTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!conversation) {
    return (
      <Card className="h-full">
        <CardContent className="h-[500px] flex items-center justify-center">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Selecciona una conversación
            </h3>
            <p className="text-gray-500">
              Elige una conversación de la lista para comenzar a chatear
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Card className="h-full flex flex-col">
        {/* Chat Header */}
        <CardHeader className="border-b border-gray-200 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 whatsapp-bg rounded-full flex items-center justify-center">
                <MessageCircle className="text-white h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  {conversation.customer.name}
                </CardTitle>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Phone className="h-4 w-4" />
                  <span>{conversation.customer.phone}</span>
                </div>
                {conversation.order && (
                  <Badge variant="secondary" className="mt-1">
                    {conversation.order.orderNumber}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSendModal(true)}
                className="whatsapp-bg text-white hover:bg-green-600"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar WhatsApp
              </Button>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 success-bg rounded-full"></div>
                <span className="text-sm text-gray-600">En línea</span>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Messages Area */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : messages && Array.isArray(messages) && messages.length > 0 ? (
            messages.map((message: Message) => (
              <div
                key={message.id}
                className={`flex ${message.senderType === "customer" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.senderType === "customer"
                      ? "bg-gray-100 text-gray-900"
                      : "whatsapp-bg text-white"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.senderType === "customer" ? "text-gray-500" : "text-green-100"
                    }`}
                  >
                    {formatMessageTime(message.sentAt)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No hay mensajes en esta conversación</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1"
              disabled={sendMessageMutation.isPending}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
              className="whatsapp-bg hover:bg-green-600"
            >
              {sendMessageMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            Los mensajes se enviarán a través de WhatsApp Business API
          </p>
        </div>
      </Card>
      
      {/* Send WhatsApp Message Modal */}
      <SendMessageModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        defaultPhone={conversation?.customer.phone || ""}
      />
    </div>
  );
}