import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageCircle, 
  Send, 
  ArrowLeft, 
  Users,
  Paperclip,
  FileText,
  X,
  Plus,
  Phone,
  Video
} from 'lucide-react';
import { useDirectMessages, Conversation, ChatAttachment, DirectMessage } from '@/hooks/useDirectMessages';
import { useGroupChat, ChatGroup, GroupMessage, MessageReaction } from '@/hooks/useGroupChat';
import { useSpaceMembers, SpaceMember } from '@/hooks/useSpaceMembers';
import { useChatAttachments } from '@/hooks/useChatAttachments';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useCall } from '@/components/calling/CallProvider';
import { OnlineIndicator } from '@/components/calling/OnlineIndicator';
import { VoiceRecordButton } from './VoiceRecordButton';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { MessageReactions } from './MessageReactions';
import { ReadReceipt } from './ReadReceipt';
import { CreateGroupDialog } from './CreateGroupDialog';
import { EmojiPicker } from './EmojiPicker';
import { TypingIndicator } from './TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { showMessageNotification, requestNotificationPermission } from '@/lib/notificationSounds';
import { supabase } from '@/integrations/supabase/client';

interface TeamChatPanelProps {
  userId: string;
}

type ChatView = 'list' | 'direct' | 'group';

export function TeamChatPanel({ userId }: TeamChatPanelProps) {
  const { 
    messages: directMessages, 
    conversations, 
    fetchMessages: fetchDirectMessages, 
    sendMessage: sendDirectMessage, 
    markAsRead: markDirectAsRead 
  } = useDirectMessages(userId);
  
  const {
    groups,
    messages: groupMessages,
    createGroup,
    fetchMessages: fetchGroupMessages,
    sendMessage: sendGroupMessage,
    markAsRead: markGroupAsRead,
    addReaction,
  } = useGroupChat(userId);
  
  const { members } = useSpaceMembers(userId);
  const { uploading, uploadMultipleFiles } = useChatAttachments(userId);
  const { isOnline, startVideoCall, startAudioCall } = useCall();
  const voiceRecorder = useVoiceRecorder(userId);
  
  const [view, setView] = useState<ChatView>('list');
  const [activeTab, setActiveTab] = useState<'chats' | 'groups'>('chats');
  const [selectedPartner, setSelectedPartner] = useState<{ id: string; name: string } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLengthRef = useRef(0);
  
  // Get current chat ID for typing indicator
  const currentChatId = view === 'direct' && selectedPartner 
    ? `dm-${[userId, selectedPartner.id].sort().join('-')}` 
    : view === 'group' && selectedGroup 
      ? `group-${selectedGroup.id}` 
      : '';
  
  const { typingUsers, onInputChange: onTypingChange, stopTyping } = useTypingIndicator({
    chatId: currentChatId,
    userId,
    userName: 'You',
  });

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    const messages = view === 'direct' ? directMessages : groupMessages;
    if (messages.length > prevMessagesLengthRef.current && prevMessagesLengthRef.current > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && 'sender_id' in lastMessage && lastMessage.sender_id !== userId) {
        const senderName = lastMessage.sender_profile?.display_name || 'Someone';
        showMessageNotification(senderName, lastMessage.content);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [directMessages, groupMessages, userId, view]);

  // Load messages when selecting a conversation
  useEffect(() => {
    if (selectedPartner && view === 'direct') {
      fetchDirectMessages(selectedPartner.id);
      markDirectAsRead(selectedPartner.id);
    }
  }, [selectedPartner, view, fetchDirectMessages, markDirectAsRead]);

  useEffect(() => {
    if (selectedGroup && view === 'group') {
      fetchGroupMessages(selectedGroup.id);
      markGroupAsRead(selectedGroup.id);
    }
  }, [selectedGroup, view, fetchGroupMessages, markGroupAsRead]);

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && pendingAttachments.length === 0) || isSending) return;

    stopTyping();
    setIsSending(true);
    
    if (view === 'direct' && selectedPartner) {
      const result = await sendDirectMessage(selectedPartner.id, newMessage, pendingAttachments);
      if (result) {
        setNewMessage('');
        setPendingAttachments([]);
        await fetchDirectMessages(selectedPartner.id);
      }
    } else if (view === 'group' && selectedGroup) {
      const result = await sendGroupMessage(selectedGroup.id, newMessage, pendingAttachments);
      if (result) {
        setNewMessage('');
        setPendingAttachments([]);
        await fetchGroupMessages(selectedGroup.id);
      }
    }
    
    setIsSending(false);
  };

  const handleVoiceSend = async () => {
    const recording = await voiceRecorder.stopRecording();
    if (!recording) return;

    const uploaded = await voiceRecorder.uploadVoiceMessage(recording.blob, recording.duration);
    if (!uploaded) return;

    const voiceAttachment: ChatAttachment = {
      name: 'Voice message',
      url: uploaded.url,
      type: 'audio/webm',
      size: recording.blob.size,
    };

    if (view === 'direct' && selectedPartner) {
      await sendDirectMessage(selectedPartner.id, '', [voiceAttachment]);
      await fetchDirectMessages(selectedPartner.id);
    } else if (view === 'group' && selectedGroup) {
      await sendGroupMessage(selectedGroup.id, '', [voiceAttachment]);
      await fetchGroupMessages(selectedGroup.id);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const attachments = await uploadMultipleFiles(files);
    setPendingAttachments(prev => [...prev, ...attachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    await addReaction(messageId, emoji, view === 'group');
    if (view === 'direct' && selectedPartner) {
      await fetchDirectMessages(selectedPartner.id);
    } else if (view === 'group' && selectedGroup) {
      await fetchGroupMessages(selectedGroup.id);
    }
  };

  const handleSelectMember = (member: SpaceMember) => {
    setSelectedPartner({
      id: member.member_id,
      name: member.member_profile?.display_name || member.member_email,
    });
    setView('direct');
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedPartner({ id: conv.partnerId, name: conv.partnerName || conv.partnerEmail });
    setView('direct');
  };

  const handleSelectGroup = (group: ChatGroup) => {
    setSelectedGroup(group);
    setView('group');
  };

  const handleBack = () => {
    setView('list');
    setSelectedPartner(null);
    setSelectedGroup(null);
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday ' + format(date, 'HH:mm');
    return format(date, 'MMM d, HH:mm');
  };

  const isImageFile = (type: string) => type.startsWith('image/');
  const isAudioFile = (type: string) => type.startsWith('audio/');

  const acceptedMembers = members.filter(m => m.status === 'accepted');
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const renderMessage = (msg: DirectMessage | GroupMessage, isOwn: boolean) => {
    const hasAttachments = msg.attachments && msg.attachments.length > 0;
    const reactions = ('reactions' in msg && Array.isArray(msg.reactions) ? msg.reactions : []) as MessageReaction[];
    const isRead = 'is_read' in msg ? msg.is_read : ('read_by' in msg && (msg.read_by?.length || 0) > 0);
    const readAt = 'read_at' in msg ? (msg.read_at as string | null) : null;

    return (
      <div
        key={msg.id}
        className={cn('flex gap-2 group', isOwn ? 'justify-end' : 'justify-start')}
      >
        {!isOwn && (
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs bg-muted">
              {getInitials(msg.sender_profile?.display_name || 'U')}
            </AvatarFallback>
          </Avatar>
        )}
        <div className={cn('max-w-[70%] rounded-lg px-3 py-2', isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
          {hasAttachments && (
            <div className="space-y-2 mb-2">
              {msg.attachments.map((att, idx) => (
                <div key={idx}>
                  {isAudioFile(att.type) ? (
                    <VoiceMessagePlayer url={att.url} isOwn={isOwn} />
                  ) : isImageFile(att.type) ? (
                    <a href={att.url} target="_blank" rel="noopener noreferrer">
                      <img src={att.url} alt={att.name} className="max-w-full rounded-md max-h-48 object-cover" />
                    </a>
                  ) : (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn('flex items-center gap-2 p-2 rounded border', isOwn ? 'border-primary-foreground/20' : 'border-border')}
                    >
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="text-xs truncate">{att.name}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          {msg.content && <p className="text-sm">{msg.content}</p>}
          <div className={cn('flex items-center gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
            <span className={cn('text-[10px]', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
              {formatMessageTime(msg.created_at)}
            </span>
            <ReadReceipt sent={true} read={isRead} readAt={readAt} isOwn={isOwn} />
          </div>
          <MessageReactions
            reactions={reactions}
            userId={userId}
            onReact={(emoji) => handleReaction(msg.id, emoji)}
            isOwn={isOwn}
          />
        </div>
      </div>
    );
  };

  // Chat view (direct or group)
  if (view === 'direct' || view === 'group') {
    const chatName = view === 'direct' ? selectedPartner?.name : selectedGroup?.name;
    const partnerId = selectedPartner?.id;
    const messages = view === 'direct' ? directMessages : groupMessages;

    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary/20">
                  {view === 'group' ? <Users className="w-5 h-5" /> : getInitials(chatName || '')}
                </AvatarFallback>
              </Avatar>
              {view === 'direct' && partnerId && (
                <OnlineIndicator isOnline={isOnline(partnerId)} className="absolute -bottom-0.5 -right-0.5" size="sm" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">{chatName}</p>
              <p className="text-xs text-muted-foreground">
                {view === 'direct' && partnerId ? (isOnline(partnerId) ? 'Online' : 'Offline') : `${selectedGroup?.members?.length || 0} members`}
              </p>
            </div>
            {view === 'direct' && partnerId && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => startAudioCall(partnerId)}>
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => startVideoCall(partnerId)}>
                  <Video className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg) => renderMessage(msg, msg.sender_id === userId))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t space-y-2">
          {/* Typing indicator */}
          <TypingIndicator typingUsers={typingUsers} className="px-1" />
          
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg">
              {pendingAttachments.map((att, idx) => (
                <div key={idx} className="relative group">
                  {isImageFile(att.type) ? (
                    <img src={att.url} alt={att.name} className="w-16 h-16 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-16 flex items-center justify-center bg-muted rounded">
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    onClick={() => removePendingAttachment(idx)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-2 items-center flex-nowrap">
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" onChange={handleFileSelect} className="hidden" />
            <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex-shrink-0">
              <Paperclip className="w-4 h-4" />
            </Button>
            
            <EmojiPicker 
              onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)} 
              disabled={isSending || uploading || voiceRecorder.isRecording}
            />
            
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                onTypingChange();
              }}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              disabled={isSending || uploading || voiceRecorder.isRecording}
              className="flex-1 min-w-0"
            />
            
            <div className="flex items-center gap-1 flex-shrink-0">
              <VoiceRecordButton
                isRecording={voiceRecorder.isRecording}
                isProcessing={voiceRecorder.isProcessing}
                duration={voiceRecorder.recordingDuration}
                formatDuration={voiceRecorder.formatDuration}
                onStart={voiceRecorder.startRecording}
                onStop={handleVoiceSend}
                onCancel={voiceRecorder.cancelRecording}
              />
              <Button onClick={handleSendMessage} disabled={(!newMessage.trim() && pendingAttachments.length === 0) || isSending || uploading} className="flex-shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // List view
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            Messages
            {totalUnread > 0 && <Badge variant="destructive">{totalUnread}</Badge>}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setShowCreateGroup(true)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chats' | 'groups')} className="flex-1 flex flex-col">
        <TabsList className="mx-4">
          <TabsTrigger value="chats" className="flex-1">Chats</TabsTrigger>
          <TabsTrigger value="groups" className="flex-1">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="chats" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            {acceptedMembers.length > 0 && (
              <div className="p-4 pb-2">
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Users className="w-3 h-3" /> Team Members
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
                        <OnlineIndicator isOnline={isOnline(member.member_id)} className="absolute -bottom-0.5 -right-0.5" size="sm" />
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

            <div className="p-4 pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-3">Recent Conversations</p>
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
                          <AvatarFallback className="bg-primary/20">{getInitials(conv.partnerName || conv.partnerEmail)}</AvatarFallback>
                        </Avatar>
                        <OnlineIndicator isOnline={isOnline(conv.partnerId)} className="absolute -bottom-0.5 -right-0.5" size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">{conv.partnerName || conv.partnerEmail}</p>
                          <span className="text-[10px] text-muted-foreground">{formatMessageTime(conv.lastMessageAt)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                      </div>
                      {conv.unreadCount > 0 && <Badge variant="destructive">{conv.unreadCount}</Badge>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="groups" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full p-4">
            {groups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No group chats yet</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowCreateGroup(true)}>
                  Create Group
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/20">
                        <Users className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{group.name}</p>
                        {group.lastMessageAt && (
                          <span className="text-[10px] text-muted-foreground">{formatMessageTime(group.lastMessageAt)}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {group.lastMessage || `${group.members?.length || 0} members`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <CreateGroupDialog
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        members={acceptedMembers}
        onCreateGroup={createGroup}
      />
    </Card>
  );
}
