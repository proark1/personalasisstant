import { cn } from '@/lib/utils';
import { Shield, ShieldAlert, ChevronRight, Archive, Star, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useCallback, useRef } from 'react';
import type { Email, EmailThread } from '@/hooks/useEmails';

interface EmailCardProps {
  thread: EmailThread;
  onSelect: (email: Email) => void;
  onArchive?: (id: string) => void;
  onToggleImportant?: (id: string) => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
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
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const SWIPE_THRESHOLD = 80;

export function EmailCard({ thread, onSelect, onArchive, onToggleImportant, selectMode, isSelected, onToggleSelect }: EmailCardProps) {
  const email = thread.latestEmail;
  const isPriority = email.priority_score <= 2 || email.is_important;
  const isThreat = email.is_spam || email.is_phishing;
  const timeAgo = formatDistanceToNow(new Date(email.received_at), { addSuffix: true });
  const initials = getInitials(email.from_name, email.from_email);
  const swiping = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const x = useMotionValue(0);
  const archiveBg = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const importantBg = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (selectMode) return;
    if (info.offset.x > SWIPE_THRESHOLD && onArchive) {
      swiping.current = true;
      onArchive(email.id);
    } else if (info.offset.x < -SWIPE_THRESHOLD && onToggleImportant) {
      swiping.current = true;
      onToggleImportant(email.id);
    }
    setTimeout(() => { swiping.current = false; }, 100);
  }, [email.id, onArchive, onToggleImportant, selectMode]);

  const handleClick = useCallback(() => {
    if (!swiping.current) onSelect(email);
  }, [email, onSelect]);

  const handlePointerDown = useCallback(() => {
    if (selectMode) return;
    longPressTimer.current = setTimeout(() => {
      onToggleSelect?.(email.id);
    }, 500);
  }, [email.id, onToggleSelect, selectMode]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {!selectMode && (
        <>
          <motion.div className="absolute inset-0 bg-emerald-500/20 flex items-center pl-4 rounded-xl" style={{ opacity: archiveBg }}>
            <Archive className="w-5 h-5 text-emerald-600" />
          </motion.div>
          <motion.div className="absolute inset-0 bg-amber-500/20 flex items-center justify-end pr-4 rounded-xl" style={{ opacity: importantBg }}>
            <Star className="w-5 h-5 text-amber-600" />
          </motion.div>
        </>
      )}

      <motion.div
        drag={selectMode ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={handleDragEnd}
        style={selectMode ? undefined : { x }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          "relative flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors",
          "hover:bg-muted/50 active:scale-[0.99]",
          "bg-background",
          !email.is_read && "bg-primary/5 border border-primary/10",
          email.is_read && "opacity-70",
          isThreat && "bg-destructive/5 border border-destructive/20",
          isSelected && "bg-primary/10 border border-primary/30"
        )}
      >
        {/* Select checkbox or Avatar */}
        {selectMode ? (
          <div className={cn(
            "mt-0.5 shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors",
            isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
          )}>
            {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
          </div>
        ) : (
          <div className={cn(
            "mt-0.5 shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold",
            isThreat ? "bg-destructive/10 text-destructive" :
            isPriority ? "bg-primary/10 text-primary" :
            email.matched_contact_id ? "bg-accent text-accent-foreground" :
            "bg-muted text-muted-foreground"
          )}>
            {isThreat ? <ShieldAlert className="w-4 h-4" /> : initials}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {email.sentiment && email.sentiment !== 'neutral' && (
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sentimentDot[email.sentiment] || sentimentDot.neutral)} />
              )}
              <span className={cn("text-sm truncate", !email.is_read ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                {email.from_name || email.from_email}
              </span>
              {thread.threadCount > 1 && (
                <span className="text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 shrink-0">{thread.threadCount}</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{timeAgo}</span>
          </div>
          <p className={cn("text-sm truncate mt-0.5", !email.is_read ? "text-foreground" : "text-muted-foreground")}>
            {email.subject || '(No subject)'}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{email.ai_summary || email.snippet}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {email.ai_suggested_action && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", actionColors[email.ai_suggested_action] || "bg-muted text-muted-foreground")}>
                {email.ai_suggested_action}
              </span>
            )}
            {isThreat && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium flex items-center gap-0.5">
                <Shield className="w-2.5 h-2.5" />{email.is_phishing ? 'Phishing' : 'Spam'}
              </span>
            )}
            {email.matched_contact_id && !isThreat && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Contact</span>
            )}
          </div>
        </div>

        {!selectMode && <ChevronRight className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />}
      </motion.div>
    </div>
  );
}
