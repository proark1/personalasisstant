import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Phone, History } from 'lucide-react';
import { TeamChatPanel } from '@/components/chat/TeamChatPanel';
import { CallHistory } from '@/components/calling/CallHistory';

interface SocialPanelProps {
  userId: string;
}

export function SocialPanel({ userId }: SocialPanelProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'calls'>('chat');

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'calls')} className="h-full flex flex-col">
        <div className="px-4 pt-3 pb-2 border-b border-border">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="calls" className="gap-2">
              <History className="w-4 h-4" />
              Call History
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
          <TeamChatPanel userId={userId} />
        </TabsContent>
        
        <TabsContent value="calls" className="flex-1 m-0 overflow-hidden">
          <CallHistory userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
