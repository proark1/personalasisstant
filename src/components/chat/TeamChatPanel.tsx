import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  Video,
  Search,
  MoreVertical,
  Camera,
  Check,
  CheckCheck
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
import { CreateGroupDialog } from './CreateGroupDialog';
import { EmojiPicker } from './EmojiPicker';
import { TypingIndicator } from './TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { format, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { showMessageNotification } from '@/lib/notificationSounds';
import { useLanguage } from '@/contexts/LanguageContext';

interface TeamChatPanelProps {
  userId: string;
}

type ChatView = 'list' | 'direct' | 'group';

export function TeamChatPanel({ userId }: TeamChatPanelProps) {
  const { language } = useLanguage();
  const dateLocale = language === 'de' ? de : undefined;
  
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
  const [selectedPartner, setSelectedPartner] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
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
    return format(date, 'HH:mm');
  };

  const formatConversationTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return language === 'de' ? 'Gestern' : 'Yesterday';
    return format(date, 'dd.MM.yy');
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return language === 'de' ? 'Heute' : 'Today';
    if (isYesterday(date)) return language === 'de' ? 'Gestern' : 'Yesterday';
    return format(date, 'EEEE, d MMMM yyyy', { locale: dateLocale });
  };

  const isImageFile = (type: string) => type.startsWith('image/');
  const isAudioFile = (type: string) => type.startsWith('audio/');

  const acceptedMembers = members.filter(m => m.status === 'accepted');
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  // Group messages by date
  const groupMessagesByDate = (messages: (DirectMessage | GroupMessage)[]) => {
    const groups: { date: string; messages: (DirectMessage | GroupMessage)[] }[] = [];
    
    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      const lastGroup = groups[groups.length - 1];
      
      if (lastGroup && new Date(lastGroup.messages[0].created_at).toDateString() === msgDate) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({ date: msg.created_at, messages: [msg] });
      }
    });
    
    return groups;
  };

  const renderMessage = (msg: DirectMessage | GroupMessage, isOwn: boolean, isFirst: boolean = false, isLast: boolean = false) => {
    const hasAttachments = msg.attachments && msg.attachments.length > 0;
    const reactions = ('reactions' in msg && Array.isArray(msg.reactions) ? msg.reactions : []) as MessageReaction[];
    const isRead = 'is_read' in msg ? msg.is_read : ('read_by' in msg && (msg.read_by?.length || 0) > 0);

    return (
      <div
        key={msg.id}
        className={cn(
          'flex mb-1 px-4',
          isOwn ? 'justify-end' : 'justify-start',
          isLast && 'mb-2'
        )}
      >
        <div
          className={cn(
            'max-w-[75%] px-3 py-2 shadow-sm relative',
            isOwn 
              ? 'message-bubble-outgoing text-foreground' 
              : 'message-bubble-incoming text-foreground',
            !isFirst && isOwn && 'rounded-tr-lg',
            !isFirst && !isOwn && 'rounded-tl-lg'
          )}
        >
          {/* Sender name for groups */}
          {view === 'group' && !isOwn && isFirst && (
            <p className="text-xs font-semibold text-primary mb-1">
              {msg.sender_profile?.display_name || 'Unknown'}
            </p>
          )}

          {/* Attachments */}
          {hasAttachments && (
            <div className="space-y-2 mb-1">
              {msg.attachments.map((att, idx) => (
                <div key={idx}>
                  {isAudioFile(att.type) ? (
                    <VoiceMessagePlayer url={att.url} isOwn={isOwn} />
                  ) : isImageFile(att.type) ? (
                    <a href={att.url} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={att.url} 
                        alt={att.name} 
                        className="max-w-full rounded-lg max-h-64 object-cover" 
                      />
                    </a>
                  ) : (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-background/50"
                    >
                      <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{att.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Document'}
                        </p>
                      </div>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Message content */}
          {msg.content && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {msg.content}
            </p>
          )}

          {/* Time and status */}
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[11px] text-muted-foreground">
              {formatMessageTime(msg.created_at)}
            </span>
            {isOwn && (
              <span className={cn("text-muted-foreground", isRead && "text-primary")}>
                {isRead ? (
                  <CheckCheck className="w-4 h-4" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </span>
            )}
          </div>

          {/* Reactions */}
          {reactions.length > 0 && (
            <MessageReactions
              reactions={reactions}
              userId={userId}
              onReact={(emoji) => handleReaction(msg.id, emoji)}
              isOwn={isOwn}
            />
          )}
        </div>
      </div>
    );
  };

  // Chat view (direct or group)
  if (view === 'direct' || view === 'group') {
    const chatName = view === 'direct' ? selectedPartner?.name : selectedGroup?.name;
    const partnerId = selectedPartner?.id;
    const messages = view === 'direct' ? directMessages : groupMessages;
    const groupedMessages = groupMessagesByDate(messages);

    return (
      <div className="h-full flex flex-col bg-background">
        {/* WhatsApp-style Header */}
        <div className="bg-primary px-2 py-2 flex items-center gap-2 shadow-md">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBack}
            className="text-primary-foreground hover:bg-primary-foreground/10 h-10 w-10"
            aria-label={language === 'de' ? 'Zurück' : 'Back'}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="relative">
            <Avatar className="w-10 h-10 border-2 border-primary-foreground/20">
              <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-sm">
                {view === 'group' ? <Users className="w-5 h-5" /> : getInitials(chatName || '')}
              </AvatarFallback>
            </Avatar>
            {view === 'direct' && partnerId && (
              <OnlineIndicator 
                isOnline={isOnline(partnerId)} 
                className="absolute -bottom-0.5 -right-0.5 border-2 border-primary" 
                size="sm" 
              />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-primary-foreground truncate">{chatName}</p>
            <p className="text-xs text-primary-foreground/70">
              {view === 'direct' && partnerId 
                ? (isOnline(partnerId) ? 'online' : 'offline') 
                : `${selectedGroup?.members?.length || 0} ${language === 'de' ? 'Mitglieder' : 'members'}`
              }
            </p>
          </div>
          
          {view === 'direct' && partnerId && (
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => startVideoCall(partnerId)}
                className="text-primary-foreground hover:bg-primary-foreground/10 h-10 w-10"
                aria-label={language === 'de' ? 'Videoanruf starten' : 'Start video call'}
              >
                <Video className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => startAudioCall(partnerId)}
                className="text-primary-foreground hover:bg-primary-foreground/10 h-10 w-10"
                aria-label={language === 'de' ? 'Sprachanruf starten' : 'Start voice call'}
              >
                <Phone className="w-5 h-5" />
              </Button>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10 h-10 w-10"
            aria-label={language === 'de' ? 'Weitere Optionen' : 'More options'}
          >
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Messages Area with WhatsApp wallpaper */}
        <div className="flex-1 overflow-y-auto chat-wallpaper">
          <div className="py-2">
            {groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date Header */}
                <div className="flex justify-center my-3">
                  <span className="bg-background/80 text-muted-foreground text-xs px-3 py-1 rounded-lg shadow-sm">
                    {formatDateHeader(group.date)}
                  </span>
                </div>
                
                {/* Messages */}
                {group.messages.map((msg, msgIndex) => {
                  const isOwn = msg.sender_id === userId;
                  const prevMsg = group.messages[msgIndex - 1];
                  const nextMsg = group.messages[msgIndex + 1];
                  const isFirst = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                  const isLast = !nextMsg || nextMsg.sender_id !== msg.sender_id;
                  
                  return renderMessage(msg, isOwn, isFirst, isLast);
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1 bg-chat-bg">
            <TypingIndicator typingUsers={typingUsers} />
          </div>
        )}

        {/* Pending attachments preview */}
        {pendingAttachments.length > 0 && (
          <div className="flex gap-2 p-3 bg-muted/50 border-t overflow-x-auto">
            {pendingAttachments.map((att, idx) => (
              <div key={idx} className="relative flex-shrink-0">
                {isImageFile(att.type) ? (
                  <img src={att.url} alt={att.name} className="w-20 h-20 object-cover rounded-lg" />
                ) : (
                  <div className="w-20 h-20 flex flex-col items-center justify-center bg-muted rounded-lg">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1 truncate max-w-full px-1">
                      {att.name}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => removePendingAttachment(idx)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* WhatsApp-style Input Area */}
        <div className="p-2 bg-muted/30 border-t flex items-end gap-2">
          <input 
            ref={fileInputRef} 
            type="file" 
            multiple 
            accept="image/*,.pdf,.doc,.docx,.txt" 
            onChange={handleFileSelect} 
            className="hidden" 
          />
          
          {/* Emoji & Attachment buttons */}
          <div className="flex items-center">
            <EmojiPicker 
              onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)} 
              disabled={isSending || uploading || voiceRecorder.isRecording}
            />
          </div>
          
          {/* Message Input */}
          <div className="flex-1 bg-background rounded-3xl flex items-center px-4 py-2 min-h-[48px]">
            <Input
              placeholder={language === 'de' ? 'Nachricht eingeben' : 'Type a message'}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                onTypingChange();
              }}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              disabled={isSending || uploading || voiceRecorder.isRecording}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 p-0 h-auto text-base"
            />
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={uploading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label={language === 'de' ? 'Foto anhängen' : 'Attach photo'}
            >
              <Camera className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Send or Voice button */}
          {newMessage.trim() || pendingAttachments.length > 0 ? (
            <Button 
              onClick={handleSendMessage}
              disabled={isSending || uploading}
              size="icon"
              className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 flex-shrink-0"
              aria-label={language === 'de' ? 'Nachricht senden' : 'Send message'}
            >
              <Send className="w-5 h-5" />
            </Button>
          ) : (
            <VoiceRecordButton
              isRecording={voiceRecorder.isRecording}
              isProcessing={voiceRecorder.isProcessing}
              duration={voiceRecorder.recordingDuration}
              formatDuration={voiceRecorder.formatDuration}
              onStart={voiceRecorder.startRecording}
              onStop={handleVoiceSend}
              onCancel={voiceRecorder.cancelRecording}
            />
          )}
        </div>
      </div>
    );
  }

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => 
    (conv.partnerName || conv.partnerEmail).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // List view - WhatsApp style
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="bg-primary px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-foreground">
          {language === 'de' ? 'Nachrichten' : 'Messages'}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/10"
            aria-label={language === 'de' ? 'Suchen' : 'Search'}
          >
            <Search className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowCreateGroup(true)}
            className="text-primary-foreground hover:bg-primary-foreground/10"
            aria-label={language === 'de' ? 'Gruppe erstellen' : 'Create group'}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 bg-muted/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={language === 'de' ? 'Suchen...' : 'Search...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background rounded-full border-0"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chats' | 'groups')} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 bg-muted/50">
          <TabsTrigger value="chats" className="flex-1 data-[state=active]:bg-background">
            {language === 'de' ? 'Chats' : 'Chats'}
            {totalUnread > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {totalUnread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex-1 data-[state=active]:bg-background">
            {language === 'de' ? 'Gruppen' : 'Groups'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chats" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            {/* Team members horizontal scroll */}
            {acceptedMembers.length > 0 && (
              <div className="p-4 pb-2">
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {acceptedMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => handleSelectMember(member)}
                      className="flex flex-col items-center gap-1 min-w-[64px]"
                    >
                      <div className="relative">
                        <Avatar className="w-14 h-14 border-2 border-primary">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(member.member_profile?.display_name || member.member_email)}
                          </AvatarFallback>
                        </Avatar>
                        <OnlineIndicator 
                          isOnline={isOnline(member.member_id)} 
                          className="absolute bottom-0 right-0 border-2 border-background" 
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

            {/* Conversations */}
            <div className="divide-y">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-medium">
                    {language === 'de' ? 'Keine Unterhaltungen' : 'No conversations yet'}
                  </p>
                  <p className="text-xs mt-1">
                    {language === 'de' ? 'Tippe auf ein Teammitglied um zu chatten' : 'Tap on a team member to start chatting'}
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.partnerId}
                    onClick={() => handleSelectConversation(conv)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left active:bg-muted"
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(conv.partnerName || conv.partnerEmail)}
                        </AvatarFallback>
                      </Avatar>
                      <OnlineIndicator 
                        isOnline={isOnline(conv.partnerId)} 
                        className="absolute bottom-0 right-0 border-2 border-background" 
                        size="sm" 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-semibold text-sm truncate">
                          {conv.partnerName || conv.partnerEmail}
                        </p>
                        <span className={cn(
                          "text-xs",
                          conv.unreadCount > 0 ? "text-primary font-medium" : "text-muted-foreground"
                        )}>
                          {formatConversationTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground truncate flex-1">
                          {conv.lastMessage}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge className="bg-primary text-primary-foreground h-5 min-w-[20px] flex items-center justify-center rounded-full text-[10px]">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="groups" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="divide-y">
              {filteredGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-medium">
                    {language === 'de' ? 'Keine Gruppenchats' : 'No group chats yet'}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4" 
                    onClick={() => setShowCreateGroup(true)}
                  >
                    {language === 'de' ? 'Gruppe erstellen' : 'Create Group'}
                  </Button>
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left active:bg-muted"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Users className="w-6 h-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-semibold text-sm truncate">{group.name}</p>
                        {group.lastMessageAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatConversationTime(group.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {group.lastMessage || `${group.members?.length || 0} ${language === 'de' ? 'Mitglieder' : 'members'}`}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <CreateGroupDialog
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        members={acceptedMembers}
        onCreateGroup={createGroup}
      />
    </div>
  );
}