import { cn } from '@/lib/utils';
import { Mail, Star, AlertCircle, Clock, Newspaper, Tag, Archive, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Email } from '@/hooks/useEmails';

interface EmailCardProps {
  email: Email;
  onSelect: (email: Email) => void;
  onArchive: (id: string) => void;
  onToggleImportant: (id: string) => void;
}

const categoryIcons: Record<string, typeof Mail> = {
  action_required: AlertCircle,
  waiting: Clock,
  newsletter: Newspaper,
  promotion: Tag,
};

const categoryColors: Record<string, string> = {
  action_required: 'text-destructive',
  waiting: 'text-amber-500',
  fyi: 'text-blue-500',
  newsletter: 'text-muted-foreground',
  promotion: 'text-muted-foreground',
};

export function EmailCard({ email, onSelect, onArchive, onToggleImportant }: EmailCardProps) {
  const CategoryIcon = categoryIcons[email.category] || Mail;
  const isPriority = email.priority_score <= 2 || email.is_important;
  const timeAgo = formatDistanceToNow(new Date(email.received_at), { addSuffix: true });

  return (
    <div
      onClick={() => onSelect(email)}
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all",
        "hover:bg-muted/50 active:scale-[0.99]",
        !email.is_read && "bg-primary/5 border border-primary/10",
        email.is_read && "opacity-75"
      )}
    >
      {/* Priority / Category indicator */}
      <div className={cn(
        "mt-1 shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isPriority ? "bg-primary/10" : "bg-muted"
      )}>
        {isPriority ? (
          <Star className={cn("w-4 h-4", email.is_important ? "text-amber-500 fill-amber-500" : "text-primary")} />
        ) : (
          <CategoryIcon className={cn("w-4 h-4", categoryColors[email.category] || "text-muted-foreground")} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "text-sm truncate",
            !email.is_read ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
          )}>
            {email.from_name || email.from_email}
          </span>
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
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {email.snippet}
        </p>

        {/* Tags */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {email.matched_contact_id && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              Contact
            </span>
          )}
          {email.category !== 'other' && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-medium",
              categoryColors[email.category] || "text-muted-foreground"
            )}>
              {email.category.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
    </div>
  );
}
