import { useState, useCallback, useEffect } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Archive, Star, StarOff, X, ExternalLink, ShieldAlert, Sparkles, Flag, Clock, Copy, Loader2, Ban, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { format, addHours, addDays, nextMonday, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Email } from '@/hooks/useEmails';

interface EmailDetailSheetProps {
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

export function EmailDetailSheet({ email, open, onOpenChange, onArchive, onToggleImportant, onReportSpam, onSnooze, onCreateSenderRule, onFetchBody, onSendReply }: EmailDetailSheetProps) {
  const [showSnooze, setShowSnooze] = useState(false);
  const [draftReply, setDraftReply] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [fullBody, setFullBody] = useState<string | null>(null);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [showFullBody, setShowFullBody] = useState(false);

  // Reset state when email changes
  useEffect(() => {
    setDraftReply(null);
    setFullBody(null);
    setReplyText('');
    setShowReplyComposer(false);
    setShowFullBody(false);
    setShowSnooze(false);
  }, [email?.id]);

  // Auto-fetch body when opened
  useEffect(() => {
    if (open && email && onFetchBody && !fullBody && !bodyLoading) {
      setBodyLoading(true);
      onFetchBody(email.gmail_message_id).then(body => {
        setFullBody(body);
        setBodyLoading(false);
      });
    }
  }, [open, email?.id]);

  if (!email) return null;

  const isPriority = email.priority_score <= 2 || email.is_important;
  const isThreat = email.is_spam || email.is_phishing;
  const sentimentInfo = sentimentLabels[email.sentiment || 'neutral'] || sentimentLabels.neutral;
  const showDraftButton = email.ai_suggested_action === 'Reply needed' || email.ai_suggested_action === 'Urgent action';

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
      const draft = data?.draft || '';
      setDraftReply(draft);
      setReplyText(draft);
      setShowReplyComposer(true);
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
      setShowReplyComposer(false);
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
      <DrawerContent className="max-h-[90vh] bg-background">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 my-3" />

        <div className="px-4 pb-8 space-y-3 overflow-y-auto max-h-[82vh]">
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
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold", isPriority ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              {getInitials(email.from_name, email.from_email)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{email.from_name || email.from_email}</p>
              <p className="text-xs text-muted-foreground truncate">{email.from_email}</p>
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

          {/* Email Body */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            {bodyLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />Loading email...
              </div>
            ) : fullBody ? (
              <>
                <div
                  className={cn("text-sm text-foreground leading-relaxed overflow-hidden", !showFullBody && "max-h-[200px]")}
                  dangerouslySetInnerHTML={{ __html: fullBody }}
                />
                <button
                  onClick={() => setShowFullBody(!showFullBody)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {showFullBody ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showFullBody ? 'Collapse' : 'Show full email'}
                </button>
              </>
            ) : (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {email.snippet || email.body_preview || 'No preview available.'}
              </p>
            )}
          </div>

          {/* Reply Composer */}
          {showReplyComposer ? (
            <div className="space-y-2 border border-border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Reply to {email.from_name || email.from_email}</span>
                <Button variant="ghost" size="sm" onClick={() => setShowReplyComposer(false)}><X className="w-3 h-3" /></Button>
              </div>
              <Textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                className="min-h-[100px] text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5 flex-1" onClick={handleSendReply} disabled={sending || !replyText.trim()}>
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {sending ? 'Sending...' : 'Send Reply'}
                </Button>
                <Button variant="outline" size="sm" onClick={copyDraft}><Copy className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="sm" onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${email.gmail_message_id}`, '_blank')}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => setShowReplyComposer(true)}>
                <Send className="w-4 h-4" />Reply
              </Button>
              {showDraftButton && (
                <Button variant="outline" className="flex-1 gap-1.5" onClick={handleDraftReply} disabled={draftLoading}>
                  {draftLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {draftLoading ? 'Drafting...' : 'AI Draft'}
                </Button>
              )}
            </div>
          )}

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
