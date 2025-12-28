import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  MessageCircle, 
  Phone, 
  History, 
  Voicemail, 
  Calendar, 
  BarChart3,
  Settings,
  Search,
  Star,
  Clock
} from 'lucide-react';
import { TeamChatPanel } from '@/components/chat/TeamChatPanel';
import { CallHistory } from '@/components/calling/CallHistory';
import { VoicemailPanel } from '@/components/calling/VoicemailPanel';
import { ScheduledCallsPanel } from '@/components/calling/ScheduledCallsPanel';
import { CommunicationDashboard } from '@/components/social/CommunicationDashboard';
import { ChatSettingsPanel } from '@/components/chat/ChatSettingsPanel';
import { MessageSearchDialog } from '@/components/chat/MessageSearchDialog';
import { SavedMessagesDialog } from '@/components/chat/SavedMessagesDialog';
import { ScheduleCallDialog } from '@/components/calling/ScheduleCallDialog';

interface SocialPanelProps {
  userId: string;
}

export function SocialPanel({ userId }: SocialPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [showSearch, setShowSearch] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showScheduleCall, setShowScheduleCall] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="px-4 pt-3 pb-2 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowSearch(true)}
              >
                <Search className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowSaved(true)}
              >
                <Star className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScheduleCall(true)}
            >
              <Clock className="w-4 h-4 mr-1" />
              Schedule Call
            </Button>
          </div>
          
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="chat" className="gap-1 text-xs">
              <MessageCircle className="w-3 h-3" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="calls" className="gap-1 text-xs">
              <History className="w-3 h-3" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="voicemail" className="gap-1 text-xs">
              <Voicemail className="w-3 h-3" />
              <span className="hidden sm:inline">Voicemail</span>
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-1 text-xs">
              <Calendar className="w-3 h-3" />
              <span className="hidden sm:inline">Scheduled</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1 text-xs">
              <BarChart3 className="w-3 h-3" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 text-xs">
              <Settings className="w-3 h-3" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
          <TeamChatPanel userId={userId} />
        </TabsContent>
        
        <TabsContent value="calls" className="flex-1 m-0 overflow-hidden p-4">
          <CallHistory userId={userId} />
        </TabsContent>

        <TabsContent value="voicemail" className="flex-1 m-0 overflow-auto p-4">
          <VoicemailPanel userId={userId} />
        </TabsContent>

        <TabsContent value="scheduled" className="flex-1 m-0 overflow-auto p-4">
          <ScheduledCallsPanel userId={userId} />
        </TabsContent>

        <TabsContent value="analytics" className="flex-1 m-0 overflow-auto p-4">
          <CommunicationDashboard userId={userId} />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 m-0 overflow-auto p-4">
          <ChatSettingsPanel userId={userId} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <MessageSearchDialog 
        open={showSearch} 
        onOpenChange={setShowSearch} 
      />
      
      <SavedMessagesDialog 
        open={showSaved} 
        onOpenChange={setShowSaved} 
      />

      <ScheduleCallDialog
        open={showScheduleCall}
        onOpenChange={setShowScheduleCall}
        userId={userId}
      />
    </div>
  );
}
