import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  MessageCircle, 
  Send, 
  ArrowLeft, 
  Users,
  Circle
} from 'lucide-react';
import { useDirectMessages, Conversation } from '@/hooks/useDirectMessages';
import { useSpaceMembers, SpaceMember } from '@/hooks/useSpaceMembers';
import { useCall } from '@/components/calling/CallProvider';
import { OnlineIndicator } from '@/components/calling/OnlineIndicator';
import { CallButton } from '@/components/calling/CallButton';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';

interface TeamChatPanelProps {
  userId: string;
}

export function TeamChatPanel({ userId }: TeamChatPanelProps) {
  const { 
    messages, 
    conversations, 
    loading, 
    fetchMessages, 
    sendMessage, 
    markAsRead 
  } = useDirectMessages(userId);
  
  const { members } = useSpaceMembers(userId);
  const { isOnline, startVideoCall, startAudioCall } = useCall();
  
  const [selectedPartner, setSelectedPartner] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when selecting a conversation
  useEffect(() => {
    if (selectedPartner) {
      fetchMessages(selectedPartner.id);
      markAsRead(selectedPartner.id);
    }
  }, [selectedPartner, fetchMessages, markAsRead]);

  const handleSendMessage = async () => {
    if (!selectedPartner || !newMessage.trim() || isSending) return;

    setIsSending(true);
    const result = await sendMessage(selectedPartner.id, newMessage);
    if (result) {
      setNewMessage('');
      await fetchMessages(selectedPartner.id);
    }
    setIsSending(false);
  };

  const handleSelectMember = (member: SpaceMember) => {
    setSelectedPartner({
      id: member.member_id,
      name: member.member_profile?.display_name || member.member_email,
    });
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedPartner({
      id: conv.partnerId,
      name: conv.partnerName || conv.partnerEmail,
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Yesterday ' + format(date, 'HH:mm');
    }
    return format(date, 'MMM d, HH:mm');
  };

  // Accepted team members
  const acceptedMembers = members.filter(m => m.status === 'accepted');
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (selectedPartner) {
    // Chat view
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedPartner(null)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary/20">
                  {getInitials(selectedPartner.name)}
                </AvatarFallback>
              </Avatar>
              <OnlineIndicator 
                isOnline={isOnline(selectedPartner.id)} 
                className="absolute -bottom-0.5 -right-0.5"
                size="sm"
              />
            </div>
            <div className="flex-1">
              <p className="font-medium">{selectedPartner.name}</p>
              <p className="text-xs text-muted-foreground">
                {isOnline(selectedPartner.id) ? 'Online' : 'Offline'}
              </p>
            </div>
            <CallButton
              onVideoCall={() => startVideoCall(selectedPartner.id)}
              onAudioCall={() => startAudioCall(selectedPartner.id)}
              isOnline={isOnline(selectedPartner.id)}
            />
          </div>
        </CardHeader>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg) => {
              const isOwn = msg.sender_id === userId;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2',
                    isOwn ? 'justify-end' : 'justify-start'
                  )}
                >
                  {!isOwn && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-muted">
                        {getInitials(msg.sender_profile?.display_name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      'max-w-[70%] rounded-lg px-3 py-2',
                      isOwn 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    )}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className={cn(
                      'text-[10px] mt-1',
                      isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}>
                      {formatMessageTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              disabled={isSending}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={!newMessage.trim() || isSending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Conversations list view
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          Team Chat
          {totalUnread > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {totalUnread}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          {/* Online Team Members */}
          {acceptedMembers.length > 0 && (
            <div className="p-4 pb-2">
              <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Users className="w-3 h-3" />
                Team Members
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {acceptedMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleSelectMember(member)}
                    className="flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/20 text-xs">
                          {getInitials(member.member_profile?.display_name || member.member_email)}
                        </AvatarFallback>
                      </Avatar>
                      <OnlineIndicator 
                        isOnline={isOnline(member.member_id)} 
                        className="absolute -bottom-0.5 -right-0.5"
                        size="sm"
                      />
                    </div>
                    <span className="text-xs text-center truncate w-full">
                      {(member.member_profile?.display_name || member.member_email).split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Recent Conversations */}
          <div className="p-4 pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-3">
              Recent Conversations
            </p>
            
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs">Click on a team member to start chatting</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.partnerId}
                    onClick={() => handleSelectConversation(conv)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="relative">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/20">
                          {getInitials(conv.partnerName || conv.partnerEmail)}
                        </AvatarFallback>
                      </Avatar>
                      <OnlineIndicator 
                        isOnline={isOnline(conv.partnerId)} 
                        className="absolute -bottom-0.5 -right-0.5"
                        size="sm"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">
                          {conv.partnerName || conv.partnerEmail}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {formatMessageTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.lastMessage}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-auto">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
