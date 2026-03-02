import { useState, useCallback, useEffect } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Archive, Star, StarOff, X, ExternalLink, ShieldAlert, Sparkles, Flag, Clock, Copy, Loader2, Ban, Send, AlertTriangle, ArrowUp, ArrowRight, ArrowDown, Receipt } from 'lucide-react';
import { format, addHours, addDays, nextMonday, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
    <div className="border border-border rounded-xl overflow-hidden">
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
          <div className="email-body-scoped text-sm text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: body }} />
        ) : (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{email.snippet || email.body_preview || 'No content.'}</p>
        )}
      </div>
    </div>
  );
}

export function EmailDetailSheet({ thread, email, open, onOpenChange, onArchive, onToggleImportant, onReportSpam, onSnooze, onCreateSenderRule, onFetchBody, onSendReply, onCategorize, onSaveAsContract, contractExtracting }: EmailDetailSheetProps) {
  const [showSnooze, setShowSnooze] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [fullBodies, setFullBodies] = useState<Record<string, string | null>>({});
  const [bodiesLoading, setBodiesLoading] = useState<Set<string>>(new Set());
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Reset state when email changes
  useEffect(() => {
    setFullBodies({});
    setBodiesLoading(new Set());
    setReplyText('');
    setShowSnooze(false);
  }, [email?.id]);

  // Auto-fetch body for all thread messages when opened
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
            <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">{email.is_phishing ? '⚠️ Phishing Detected' : '⚠️ Spam Detected'}</p>
                {email.threat_reason && <p className="text-xs text-destructive/80 mt-0.5">{email.threat_reason}</p>}
              </div>
            </div>
          )}

          {/* AI Analysis */}
          {(email.ai_summary || email.ai_suggested_action) && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
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
            </div>
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
                        "flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-all",
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

          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => { onArchive(email.id); onOpenChange(false); }}>
                <Archive className="w-4 h-4 mr-1" />Archive
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onToggleImportant(email.id)}>
                {email.is_important ? <StarOff className="w-4 h-4 mr-1" /> : <Star className="w-4 h-4 mr-1" />}
                {email.is_important ? 'Unmark' : 'Important'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSnooze(!showSnooze)}>
                <Clock className="w-4 h-4 mr-1" />Snooze
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { onReportSpam(email.id); onOpenChange(false); }}>
                <Flag className="w-4 h-4 mr-1" />Spam
              </Button>
              {onSaveAsContract && (
                <Button variant="ghost" size="sm" onClick={() => {
                  const bodyHtml = fullBodies[email.gmail_message_id] || undefined;
                  onSaveAsContract(email, bodyHtml);
                }} disabled={contractExtracting}>
                  {contractExtracting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Receipt className="w-4 h-4 mr-1" />}
                  {contractExtracting ? 'Extracting...' : 'Contract'}
                </Button>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}><X className="w-4 h-4" /></Button>
          </div>

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
            <div className="bg-muted/50 rounded-xl p-4">
              {bodiesLoading.has(email.gmail_message_id) ? (
                <EmailBodySkeleton />
              ) : fullBodies[email.gmail_message_id] ? (
                <div className="email-body-scoped text-sm text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: fullBodies[email.gmail_message_id]! }} />
              ) : (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {email.snippet || email.body_preview || 'No preview available.'}
                </p>
              )}
            </div>
          )}

          {/* Reply Composer — always visible */}
          <div className="space-y-2 border border-border rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Reply to {mainSender.name}</span>
              <Button variant="ghost" size="sm" onClick={handleDraftReply} disabled={draftLoading} className="gap-1 text-xs">
                {draftLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI Draft
              </Button>
            </div>
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
              <Button variant="outline" size="sm" onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${email.gmail_message_id}`, '_blank')}>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Always-archive rule */}
          {!isThreat && onCreateSenderRule && (
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground gap-1.5" onClick={handleArchiveWithRule}>
              <Ban className="w-3.5 h-3.5" />Archive & always archive from {email.from_email.split('@')[1]}
            </Button>
          )}

          {/* Open in Gmail */}
          <Button variant="outline" className="w-full" onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${email.gmail_message_id}`, '_blank')}>
            <ExternalLink className="w-4 h-4 mr-2" />Open in Gmail
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
