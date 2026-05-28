import { useState, useEffect } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassCard } from '@/components/ui/glass-card';
import { Archive, Star, StarOff, X, ExternalLink, ShieldAlert, Sparkles, Flag, Clock, Copy, Loader2, Ban, Send, AlertTriangle, ArrowUp, ArrowRight, ArrowDown, Receipt, CalendarPlus, UserPlus, User, MoreHorizontal, Reply } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format, addHours, addDays, nextMonday, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Email, EmailThread } from '@/hooks/useEmails';
import { reconstructSender } from '@/lib/emailSender';

interface EmailDetailSheetProps {
  thread: EmailThread | null;
  email: Email | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive: (id: string) => void;
  onToggleImportant: (id: string) => void;
  onReportSpam: (id: string) => void;
  onSnooze?: (id: string, until: Date) => void;
  onCreateSenderRule?: (pattern: string, rule: { default_category?: string; auto_archive?: boolean }) => void;
  onFetchBody?: (gmailMessageId: string) => Promise<string | null>;
  onSendReply?: (email: Email, body: string) => Promise<boolean>;
  onCategorize?: (emailId: string, priority: 'high' | 'medium' | 'low' | 'spam') => void;
  onSaveAsContract?: (email: Email, bodyHtml?: string) => void;
  contractExtracting?: boolean;
  onAddToCalendar?: (data: { title: string; description: string; date?: string }) => void;
  onSaveAsContact?: (data: { name: string; email: string }) => void;
  matchedContact?: { id: string; name: string; tier?: string; last_contacted_at?: string; relationship?: string } | null;
}

const sentimentLabels: Record<string, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'text-destructive' },
  warning: { label: 'Warning', className: 'text-amber-600' },
  positive: { label: 'Positive', className: 'text-emerald-600' },
  neutral: { label: 'Neutral', className: 'text-muted-foreground' },
};

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getPriorityFromScore(score: number): 'high' | 'medium' | 'low' | null {
  if (score <= 2) return 'high';
  if (score <= 3) return 'medium';
  if (score >= 5) return 'low';
  return null;
}

const priorityOptions = [
  { key: 'high' as const, label: 'High', icon: ArrowUp, activeClass: 'bg-destructive/15 text-destructive border-destructive/30', color: 'text-destructive' },
  { key: 'medium' as const, label: 'Medium', icon: ArrowRight, activeClass: 'bg-amber-500/15 text-amber-600 border-amber-500/30', color: 'text-amber-600' },
  { key: 'low' as const, label: 'Low', icon: ArrowDown, activeClass: 'bg-muted text-muted-foreground border-muted-foreground/20', color: 'text-muted-foreground' },
  { key: 'spam' as const, label: 'Spam', icon: AlertTriangle, activeClass: 'bg-destructive/15 text-destructive border-destructive/30', color: 'text-destructive' },
];

const QUICK_REPLIES = [
  "Thanks, got it!",
  "I'll review and get back to you.",
  "Let me check and follow up.",
];

function EmailBodySkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[90%]" />
      <Skeleton className="h-4 w-[75%]" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[60%]" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function ThreadMessage({ email, body, bodyLoading }: { email: Email; body: string | null; bodyLoading: boolean }) {
  const sender = reconstructSender(email.from_name, email.from_email);
  return (
    <GlassCard className="overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-muted/30">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold bg-muted text-muted-foreground">
          {getInitials(sender.name, sender.email)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">{sender.name}</p>
          <p className="text-[10px] text-muted-foreground">{sender.email}</p>
          <p className="text-[10px] text-muted-foreground">{format(new Date(email.received_at), 'MMM d, h:mm a')}</p>
        </div>
      </div>
      <div className="p-3">
        {bodyLoading ? (
          <EmailBodySkeleton />
        ) : body ? (
          <div className="email-body-scoped text-sm text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr', 'pre', 'code', 'b', 'i', 'sub', 'sup', 'dl', 'dt', 'dd'], ALLOWED_ATTR: ['href', 'class', 'style', 'src', 'alt', 'width', 'height', 'target', 'rel', 'colspan', 'rowspan'], ALLOW_DATA_ATTR: false }) }} />
        ) : (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{email.snippet || email.body_preview || 'No content.'}</p>
        )}
      </div>
    </GlassCard>
  );
}

export function EmailDetailSheet({ thread, email, open, onOpenChange, onArchive, onToggleImportant, onReportSpam, onSnooze, onCreateSenderRule, onFetchBody, onSendReply, onCategorize, onSaveAsContract, contractExtracting, onAddToCalendar, onSaveAsContact, matchedContact }: EmailDetailSheetProps) {
  const [showSnooze, setShowSnooze] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [fullBodies, setFullBodies] = useState<Record<string, string | null>>({});
  const [bodiesLoading, setBodiesLoading] = useState<Set<string>>(new Set());
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);

  useEffect(() => {
    setFullBodies({});
    setBodiesLoading(new Set());
    setReplyText('');
    setShowSnooze(false);
    setShowMoreActions(false);
  }, [email?.id]);

  useEffect(() => {
    if (!open || !onFetchBody) return;
    const emails = thread?.allEmails || (email ? [email] : []);
    for (const e of emails) {
      if (!fullBodies[e.gmail_message_id] && !bodiesLoading.has(e.gmail_message_id)) {
        setBodiesLoading(prev => new Set(prev).add(e.gmail_message_id));
        onFetchBody(e.gmail_message_id).then(body => {
          setFullBodies(prev => ({ ...prev, [e.gmail_message_id]: body }));
          setBodiesLoading(prev => { const n = new Set(prev); n.delete(e.gmail_message_id); return n; });
        });
      }
    }
  }, [open, email?.id]);

  if (!email) return null;

  const mainSender = reconstructSender(email.from_name, email.from_email);
  const isPriority = email.priority_score <= 2 || email.is_important;
  const isThreat = email.is_spam || email.is_phishing;
  const sentimentInfo = sentimentLabels[email.sentiment || 'neutral'] || sentimentLabels.neutral;
  const currentPriority = email.is_spam ? 'spam' : getPriorityFromScore(email.priority_score);
  const threadEmails = thread?.allEmails || [email];
  const isThread = threadEmails.length > 1;

  const handleSnooze = (until: Date) => {
    onSnooze?.(email.id, until);
    setShowSnooze(false);
    onOpenChange(false);
  };

  const handleArchiveWithRule = () => {
    onArchive(email.id);
    const domain = email.from_email.split('@')[1];
    if (domain && onCreateSenderRule) onCreateSenderRule(`*@${domain}`, { auto_archive: true });
    onOpenChange(false);
  };

  const handleDraftReply = async () => {
    setDraftLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-draft-reply', {
        body: { subject: email.subject, from_name: email.from_name, from_email: email.from_email, snippet: email.snippet || email.body_preview, ai_summary: email.ai_summary },
      });
      if (error) throw error;
      setReplyText(data?.draft || '');
    } catch (e) {
      console.error('Draft reply error:', e);
      toast.error('Failed to generate draft reply');
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !onSendReply) return;
    setSending(true);
    const success = await onSendReply(email, replyText.trim());
    setSending(false);
    if (success) {
      setReplyText('');
      onOpenChange(false);
    }
  };

  const copyDraft = () => {
    if (replyText) {
      navigator.clipboard.writeText(replyText);
      toast.success('Copied to clipboard');
    }
  };

  const now = new Date();
  const snoozeOptions = [
    { label: 'Later Today', date: addHours(now, 3) },
    { label: 'Tomorrow 9am', date: setMinutes(setHours(addDays(now, 1), 9), 0) },
    { label: 'Next Monday', date: setMinutes(setHours(nextMonday(now), 9), 0) },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh] bg-background">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 my-3" />

        <div className="px-4 pb-8 space-y-3 overflow-y-auto max-h-[85vh]">
          {/* Threat Warning */}
          {isThreat && (
            <GlassCard className="flex items-start gap-3 p-3 bg-destructive/5 border-destructive/20">
              <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">{email.is_phishing ? '⚠️ Phishing Detected' : '⚠️ Spam Detected'}</p>
                {email.threat_reason && <p className="text-xs text-destructive/80 mt-0.5">{email.threat_reason}</p>}
              </div>
            </GlassCard>
          )}

          {/* AI Analysis */}
          {(email.ai_summary || email.ai_suggested_action) && (
            <GlassCard className="p-3 bg-primary/5 border-primary/10 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="w-3.5 h-3.5" />AI Analysis
              </div>
              {email.ai_summary && <p className="text-sm text-foreground">{email.ai_summary}</p>}
              <div className="flex items-center gap-2 flex-wrap">
                {email.ai_suggested_action && (
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">{email.ai_suggested_action}</span>
                )}
                <span className={cn("text-xs font-medium", sentimentInfo.className)}>{sentimentInfo.label}</span>
              </div>
            </GlassCard>
          )}

          {/* Priority Categorization */}
          {onCategorize && !isThreat && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Categorize</span>
              <div className="flex gap-1.5">
                {priorityOptions.map(opt => {
                  const isActive = currentPriority === opt.key;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => onCategorize(email.id, opt.key)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all active:scale-95",
                        isActive ? opt.activeClass : "border-border text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions — Row 1: Primary */}
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-9" onClick={() => { onArchive(email.id); onOpenChange(false); }}>
              <Archive className="w-3.5 h-3.5" />Archive
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-9" onClick={() => onToggleImportant(email.id)}>
              {email.is_important ? <StarOff className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
              {email.is_important ? 'Unstar' : 'Star'}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-9" onClick={() => setShowSnooze(!showSnooze)}>
              <Clock className="w-3.5 h-3.5" />Snooze
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Actions — Row 2: Secondary (collapsible) */}
          <Collapsible open={showMoreActions} onOpenChange={setShowMoreActions}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 text-muted-foreground h-7">
                <MoreHorizontal className="w-3.5 h-3.5" />
                {showMoreActions ? 'Less' : 'More actions'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button variant="ghost" size="sm" className="text-xs gap-1 text-destructive hover:text-destructive h-8" onClick={() => { onReportSpam(email.id); onOpenChange(false); }}>
                  <Flag className="w-3 h-3" />Spam
                </Button>
                {onSaveAsContract && (
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-8" onClick={() => {
                    const bodyHtml = fullBodies[email.gmail_message_id] || undefined;
                    onSaveAsContract(email, bodyHtml);
                  }} disabled={contractExtracting}>
                    {contractExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Receipt className="w-3 h-3" />}
                    {contractExtracting ? 'Extracting...' : 'Save as Contract'}
                  </Button>
                )}
                {onAddToCalendar && (
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-8" onClick={() => {
                    onAddToCalendar({
                      title: email.subject || 'Event from email',
                      description: `From: ${mainSender.name} <${mainSender.email}>\n\n${email.snippet || ''}`,
                      date: email.received_at,
                    });
                  }}>
                    <CalendarPlus className="w-3 h-3" />Calendar
                  </Button>
                )}
                {!isThreat && onCreateSenderRule && (
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-8 text-muted-foreground" onClick={handleArchiveWithRule}>
                    <Ban className="w-3 h-3" />Always archive {email.from_email.split('@')[1]}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-8" onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${email.gmail_message_id}`, '_blank')}>
                  <ExternalLink className="w-3 h-3" />Open in Gmail
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Snooze options */}
          {showSnooze && (
            <div className="flex gap-2 flex-wrap">
              {snoozeOptions.map(opt => (
                <Button key={opt.label} variant="outline" size="sm" className="text-xs" onClick={() => handleSnooze(opt.date)}>
                  <Clock className="w-3 h-3 mr-1" />{opt.label}
                </Button>
              ))}
            </div>
          )}

          {/* Matched Contact Card */}
          {matchedContact && (
            <GlassCard className="flex items-center gap-3 p-3 bg-primary/5 border-primary/10">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {matchedContact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{matchedContact.name}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {matchedContact.tier && <span className="capitalize">{matchedContact.tier}</span>}
                  {matchedContact.relationship && <span>· {matchedContact.relationship}</span>}
                  {matchedContact.last_contacted_at && <span>· Last contact {format(new Date(matchedContact.last_contacted_at), 'MMM d')}</span>}
                </div>
              </div>
              <User className="w-4 h-4 text-primary shrink-0" />
            </GlassCard>
          )}

          {/* Save as Contact */}
          {!matchedContact && !email.matched_contact_id && onSaveAsContact && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs gap-1.5"
              onClick={() => onSaveAsContact({ name: mainSender.name || '', email: mainSender.email })}
            >
              <UserPlus className="w-3.5 h-3.5" />Save {mainSender.name || mainSender.email} as Contact
            </Button>
          )}

          {/* Subject */}
          <h2 className="text-lg font-semibold text-foreground leading-tight">{email.subject || '(No subject)'}</h2>

          {/* Sender info */}
          <div className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold", isPriority ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              {getInitials(mainSender.name, mainSender.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{mainSender.name}</p>
              <p className="text-xs text-muted-foreground">{mainSender.email}</p>
            </div>
            <div className="ml-auto text-right shrink-0">
              <p className="text-xs text-muted-foreground">{format(new Date(email.received_at), 'MMM d, yyyy')}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(email.received_at), 'h:mm a')}</p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {email.matched_contact_id && <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">Known Contact</span>}
            {email.category !== 'other' && !isThreat && <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium capitalize">{email.category.replace('_', ' ')}</span>}
            {isPriority && <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 font-medium">Priority</span>}
          </div>

          {/* Email Body / Thread */}
          {isThread ? (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground">{threadEmails.length} messages in thread</span>
              {threadEmails.map(e => (
                <ThreadMessage
                  key={e.id}
                  email={e}
                  body={fullBodies[e.gmail_message_id] ?? null}
                  bodyLoading={bodiesLoading.has(e.gmail_message_id)}
                />
              ))}
            </div>
          ) : (
            <GlassCard className="p-4">
              {bodiesLoading.has(email.gmail_message_id) ? (
                <EmailBodySkeleton />
              ) : fullBodies[email.gmail_message_id] ? (
                <div className="email-body-scoped text-sm text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(fullBodies[email.gmail_message_id]!, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr', 'pre', 'code', 'b', 'i', 'sub', 'sup', 'dl', 'dt', 'dd'], ALLOWED_ATTR: ['href', 'class', 'style', 'src', 'alt', 'width', 'height', 'target', 'rel', 'colspan', 'rowspan'], ALLOW_DATA_ATTR: false }) }} />
              ) : (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {email.snippet || email.body_preview || 'No preview available.'}
                </p>
              )}
            </GlassCard>
          )}

          {/* Reply Composer */}
          <GlassCard variant="elevated" className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Reply className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Reply to {mainSender.name}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDraftReply}
                disabled={draftLoading}
                className="gap-1.5 text-xs bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 h-7"
              >
                {draftLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI Draft
              </Button>
            </div>

            {/* Quick Replies */}
            {!replyText && (
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_REPLIES.map(qr => (
                  <button
                    key={qr}
                    onClick={() => setReplyText(qr)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors active:scale-95"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            )}

            <Textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Type your reply..."
              className="min-h-[80px] text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5 flex-1" onClick={handleSendReply} disabled={sending || !replyText.trim()}>
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sending ? 'Sending...' : 'Send Reply'}
              </Button>
              <Button variant="outline" size="sm" onClick={copyDraft} disabled={!replyText}><Copy className="w-3.5 h-3.5" /></Button>
            </div>
          </GlassCard>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
