import { cn } from '@/lib/utils';
import { Shield, ShieldAlert, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Email } from '@/hooks/useEmails';

interface EmailCardProps {
  email: Email;
  onSelect: (email: Email) => void;
}

const actionColors: Record<string, string> = {
  'Reply needed': 'bg-primary/10 text-primary',
  'Urgent action': 'bg-destructive/10 text-destructive',
  'Review': 'bg-amber-500/10 text-amber-600',
  'Review attachment': 'bg-amber-500/10 text-amber-600',
  'Just FYI': 'bg-muted text-muted-foreground',
  'Can ignore': 'bg-muted text-muted-foreground',
  'Unsubscribe': 'bg-muted text-muted-foreground',
};

const sentimentDot: Record<string, string> = {
  urgent: 'bg-destructive',
  warning: 'bg-amber-500',
  positive: 'bg-emerald-500',
  neutral: 'bg-muted-foreground/30',
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

export function EmailCard({ email, onSelect }: EmailCardProps) {
  const isPriority = email.priority_score <= 2 || email.is_important;
  const isThreat = email.is_spam || email.is_phishing;
  const timeAgo = formatDistanceToNow(new Date(email.received_at), { addSuffix: true });
  const initials = getInitials(email.from_name, email.from_email);

  return (
    <div
      onClick={() => onSelect(email)}
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all",
        "hover:bg-muted/50 active:scale-[0.99]",
        !email.is_read && "bg-primary/5 border border-primary/10",
        email.is_read && "opacity-70",
        isThreat && "bg-destructive/5 border border-destructive/20"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "mt-0.5 shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold",
        isThreat ? "bg-destructive/10 text-destructive" :
        isPriority ? "bg-primary/10 text-primary" :
        email.matched_contact_id ? "bg-accent text-accent-foreground" :
        "bg-muted text-muted-foreground"
      )}>
        {isThreat ? (
          <ShieldAlert className="w-4 h-4" />
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {email.sentiment && email.sentiment !== 'neutral' && (
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sentimentDot[email.sentiment] || sentimentDot.neutral)} />
            )}
            <span className={cn(
              "text-sm truncate",
              !email.is_read ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
            )}>
              {email.from_name || email.from_email}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            {timeAgo}
          </span>
        </div>

        <p className={cn(
          "text-sm truncate mt-0.5",
          !email.is_read ? "text-foreground" : "text-muted-foreground"
        )}>
          {email.subject || '(No subject)'}
        </p>

        {/* AI Summary or snippet */}
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {email.ai_summary || email.snippet}
        </p>

        {/* Action chip + threat badge */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {email.ai_suggested_action && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
              actionColors[email.ai_suggested_action] || "bg-muted text-muted-foreground"
            )}>
              {email.ai_suggested_action}
            </span>
          )}
          {isThreat && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5" />
              {email.is_phishing ? 'Phishing' : 'Spam'}
            </span>
          )}
          {email.matched_contact_id && !isThreat && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              Contact
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
    </div>
  );
}
