import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Archive, Star, StarOff, X, ExternalLink, ShieldAlert, Shield, Sparkles, Flag } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Email } from '@/hooks/useEmails';

interface EmailDetailSheetProps {
  email: Email | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive: (id: string) => void;
  onToggleImportant: (id: string) => void;
  onReportSpam: (id: string) => void;
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
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function EmailDetailSheet({ email, open, onOpenChange, onArchive, onToggleImportant, onReportSpam }: EmailDetailSheetProps) {
  if (!email) return null;

  const isPriority = email.priority_score <= 2 || email.is_important;
  const isThreat = email.is_spam || email.is_phishing;
  const sentimentInfo = sentimentLabels[email.sentiment || 'neutral'] || sentimentLabels.neutral;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] bg-background">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 my-3" />

        <div className="px-4 pb-8 space-y-4 overflow-y-auto">
          {/* Threat Warning Banner */}
          {isThreat && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">
                  {email.is_phishing ? '⚠️ Phishing Detected' : '⚠️ Spam Detected'}
                </p>
                {email.threat_reason && (
                  <p className="text-xs text-destructive/80 mt-0.5">{email.threat_reason}</p>
                )}
              </div>
            </div>
          )}

          {/* AI Analysis Card */}
          {(email.ai_summary || email.ai_suggested_action) && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                AI Analysis
              </div>
              {email.ai_summary && (
                <p className="text-sm text-foreground">{email.ai_summary}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {email.ai_suggested_action && (
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {email.ai_suggested_action}
                  </span>
                )}
                <span className={cn("text-xs font-medium", sentimentInfo.className)}>
                  {sentimentInfo.label}
                </span>
              </div>
            </div>
          )}

          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onArchive(email.id); onOpenChange(false); }}
              >
                <Archive className="w-4 h-4 mr-1" />
                Archive
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleImportant(email.id)}
              >
                {email.is_important ? <StarOff className="w-4 h-4 mr-1" /> : <Star className="w-4 h-4 mr-1" />}
                {email.is_important ? 'Unmark' : 'Important'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => { onReportSpam(email.id); onOpenChange(false); }}
              >
                <Flag className="w-4 h-4 mr-1" />
                Spam
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Subject */}
          <h2 className="text-lg font-semibold text-foreground leading-tight">
            {email.subject || '(No subject)'}
          </h2>

          {/* Sender info */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
              isPriority ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {getInitials(email.from_name, email.from_email)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {email.from_name || email.from_email}
              </p>
              <p className="text-xs text-muted-foreground truncate">{email.from_email}</p>
            </div>
            <div className="ml-auto text-right shrink-0">
              <p className="text-xs text-muted-foreground">
                {format(new Date(email.received_at), 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(email.received_at), 'h:mm a')}
              </p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {email.matched_contact_id && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                Known Contact
              </span>
            )}
            {email.category !== 'other' && !isThreat && (
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium capitalize">
                {email.category.replace('_', ' ')}
              </span>
            )}
            {isPriority && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                Priority
              </span>
            )}
          </div>

          {/* Preview */}
          <div className="bg-muted/50 rounded-xl p-4">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {email.snippet || email.body_preview || 'No preview available.'}
            </p>
          </div>

          {/* Open in Gmail */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${email.gmail_message_id}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in Gmail
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
