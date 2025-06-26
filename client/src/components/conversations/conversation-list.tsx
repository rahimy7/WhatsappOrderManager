import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import { ConversationWithDetails } from "@shared/schema";

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  isLoading: boolean;
  selectedConversation: ConversationWithDetails | null;
  onSelectConversation: (conversation: ConversationWithDetails) => void;
}

export default function ConversationList({ 
  conversations, 
  isLoading, 
  selectedConversation,
  onSelectConversation 
}: ConversationListProps) {
  const formatTime = (date: string | Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    return `${Math.floor(diffInHours / 24)}d`;
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Conversaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">Conversaciones</CardTitle>
      </CardHeader>
      <CardContent className="h-[500px] overflow-y-auto">
        <div className="space-y-2">
          {conversations.map((conversation: ConversationWithDetails) => (
            <div 
              key={conversation.id}
              onClick={() => onSelectConversation(conversation)}
              className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                selectedConversation?.id === conversation.id 
                  ? "bg-primary bg-opacity-10 border border-primary" 
                  : conversation.unreadCount > 0 
                    ? "bg-gray-50 hover:bg-gray-100" 
                    : "hover:bg-gray-50"
              }`}
            >
              <div className="w-10 h-10 whatsapp-bg rounded-full flex items-center justify-center">
                <MessageCircle className="text-white h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${
                  conversation.unreadCount > 0 ? "font-semibold text-gray-900" : "font-medium text-gray-900"
                }`}>
                  {conversation.customer.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {conversation.lastMessage?.content?.slice(0, 40) || "Sin mensajes"}
                  {conversation.lastMessage?.content && conversation.lastMessage.content.length > 40 ? "..." : ""}
                </p>
                {conversation.order && (
                  <p className="text-xs text-primary mt-1">
                    {conversation.order.orderNumber}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">
                  {conversation.lastMessageAt ? formatTime(conversation.lastMessageAt) : ""}
                </p>
                {conversation.unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs rounded-full mt-1">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
