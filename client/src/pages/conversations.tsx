import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ConversationList from "@/components/conversations/conversation-list";
import ChatWindow from "@/components/conversations/chat-window";
import { ConversationWithDetails } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["/api/conversations"],
  });

  const handleSelectConversation = (conversation: ConversationWithDetails) => {
    setSelectedConversation(conversation);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 h-[calc(100vh-200px)] md:h-[600px]">
        {/* Mobile: Show either list or chat */}
        {isMobile ? (
          <>
            {!selectedConversation ? (
              <div className="col-span-1">
                <ConversationList
                  conversations={Array.isArray(conversations) ? conversations : []}
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
                conversations={Array.isArray(conversations) ? conversations : []}
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
