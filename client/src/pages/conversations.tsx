import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ConversationList from "@/components/conversations/conversation-list";
import ChatWindow from "@/components/conversations/chat-window";
import { ConversationWithDetails } from "@shared/schema";

export default function Conversations() {
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["/api/conversations"],
  });

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <div className="lg:col-span-1">
          <ConversationList
            conversations={Array.isArray(conversations) ? conversations : []}
            isLoading={isLoading}
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
          />
        </div>
        
        <div className="lg:col-span-2">
          <ChatWindow
            conversation={selectedConversation}
          />
        </div>
      </div>
    </div>
  );
}
