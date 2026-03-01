import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Archive, Star, StarOff, X, ExternalLink, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Email } from '@/hooks/useEmails';

interface EmailDetailSheetProps {
  email: Email | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive: (id: string) => void;
  onToggleImportant: (id: string) => void;
}

export function EmailDetailSheet({ email, open, onOpenChange, onArchive, onToggleImportant }: EmailDetailSheetProps) {
  if (!email) return null;

  const isPriority = email.priority_score <= 2 || email.is_important;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] bg-background">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 my-3" />
        
        <div className="px-4 pb-8 space-y-4">
          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onArchive(email.id);
                  onOpenChange(false);
                }}
              >
                <Archive className="w-4 h-4 mr-1" />
                Archive
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleImportant(email.id)}
              >
                {email.is_important ? (
                  <StarOff className="w-4 h-4 mr-1" />
                ) : (
                  <Star className="w-4 h-4 mr-1" />
                )}
                {email.is_important ? 'Unmark' : 'Important'}
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
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              isPriority ? "bg-primary/10" : "bg-muted"
            )}>
              <User className={cn("w-5 h-5", isPriority ? "text-primary" : "text-muted-foreground")} />
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
            {email.category !== 'other' && (
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
