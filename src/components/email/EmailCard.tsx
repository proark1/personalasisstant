import { cn } from '@/lib/utils';
import { reconstructSender } from '@/lib/emailSender';
import { Shield, ShieldAlert, ChevronRight, Archive, Star, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { GlassCard } from '@/components/ui/glass-card';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useCallback, useRef, useState } from 'react';
import { staggerItem } from '@/components/ui/panel-shell';
import type { Email, EmailThread } from '@/hooks/useEmails';

interface EmailCardProps {
  thread: EmailThread;
  onSelect: (email: Email) => void;
  onArchive?: (id: string) => void;
  onToggleImportant?: (id: string) => void;
  onSnooze?: (id: string) => void;
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

const categoryLabels: Record<string, string> = {
  action_required: 'Action Required',
  fyi: 'FYI',
  newsletter: 'Newsletter',
  promotion: 'Promotion',
};

function getPriorityBadge(score: number) {
  if (score <= 2) return { label: 'High', className: 'bg-destructive/10 text-destructive' };
  if (score === 3) return { label: 'Medium', className: 'bg-amber-500/10 text-amber-600' };
  if (score >= 5) return { label: 'Low', className: 'bg-muted text-muted-foreground' };
  return null;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean);
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const SWIPE_THRESHOLD = 80;

function decodeHtmlEntities(text: string | null): string {
  if (!text) return '';
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return doc.body.textContent || '';
}

export function EmailCard({ thread, onSelect, onArchive, onToggleImportant, onSnooze, selectMode, isSelected, onToggleSelect }: EmailCardProps) {
  const email = thread.latestEmail;
  const sender = reconstructSender(email.from_name, email.from_email);
  const isPriority = email.priority_score <= 2 || email.is_important;
  const isThreat = email.is_spam || email.is_phishing;
  const timeAgo = formatDistanceToNow(new Date(email.received_at), { addSuffix: true });
  const initials = getInitials(sender.name, sender.email);
  const swiping = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showActions, setShowActions] = useState(false);

  const x = useMotionValue(0);
  const archiveBg = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const importantBg = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const priorityBadge = getPriorityBadge(email.priority_score);
  const categoryLabel = categoryLabels[email.category];

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
      setShowActions(true);
    }, 500);
  }, [selectMode]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  return (
    <motion.div variants={staggerItem} className="relative overflow-hidden rounded-xl group w-full max-w-full min-w-0 [contain:layout]"
      onMouseEnter={() => !selectMode && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
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

      <GlassCard
        pressable={!selectMode}
        haptic={selectMode ? false : "light"}
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
          "relative flex w-full min-w-0 max-w-full items-start gap-2 overflow-hidden p-3 !rounded-xl",
          !email.is_read && "border-l-[3px] border-l-primary bg-primary/5 border-primary/10",
          email.is_read && "opacity-70 border-l-[3px] border-l-transparent",
          isThreat && "bg-destructive/5 border-destructive/20 border-l-destructive",
          isSelected && "bg-primary/10 border-primary/30"
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
            "mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold",
            isThreat ? "bg-destructive/10 text-destructive" :
            isPriority ? "bg-primary/10 text-primary" :
            email.matched_contact_id ? "bg-accent text-accent-foreground" :
            "bg-muted text-muted-foreground"
          )}>
            {isThreat ? <ShieldAlert className="w-4 h-4" /> : initials}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 max-w-full overflow-hidden">
          <div className="flex min-w-0 max-w-full flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full min-w-0 items-center gap-1.5 overflow-hidden sm:flex-1">
              {email.sentiment && email.sentiment !== 'neutral' && (
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sentimentDot[email.sentiment] || sentimentDot.neutral)} />
              )}
              <span className={cn("min-w-0 flex-1 truncate text-sm block", !email.is_read ? "font-bold text-foreground" : "font-semibold text-muted-foreground")}>
                {sender.name}
              </span>
              {thread.threadCount > 1 && (
                <span className="text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 shrink-0">{thread.threadCount}</span>
              )}
            </div>
            <span className="max-w-full text-[10px] text-muted-foreground sm:whitespace-nowrap shrink-0">
              {timeAgo}
            </span>
          </div>
          <p className={cn("mt-0.5 max-w-full text-sm whitespace-normal break-words [overflow-wrap:anywhere] line-clamp-2", !email.is_read ? "text-foreground" : "text-muted-foreground")}>
            {email.subject || '(No subject)'}
          </p>
          <p className="mt-0.5 max-w-full text-xs text-muted-foreground whitespace-normal break-words [overflow-wrap:anywhere] line-clamp-2">
            {decodeHtmlEntities(email.ai_summary || email.snippet)}
          </p>

          {/* Tags row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap min-w-0 max-w-full">
            {email.ai_suggested_action && (
              <span className={cn("max-w-full rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-normal break-words [overflow-wrap:anywhere]", actionColors[email.ai_suggested_action] || "bg-muted text-muted-foreground")}>
                {email.ai_suggested_action}
              </span>
            )}
            {priorityBadge && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold", priorityBadge.className)}>
                {priorityBadge.label}
              </span>
            )}
            {categoryLabel && !isThreat && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/50 text-accent-foreground font-medium">
                {categoryLabel}
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

        {/* Quick actions on hover/long-press */}
        {!selectMode && showActions ? (
          <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onArchive?.(email.id); }}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              title="Archive"
            >
              <Archive className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleImportant?.(email.id); }}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              title="Star"
            >
              <Star className={cn("w-3.5 h-3.5", email.is_important ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
            </button>
          </div>
        ) : (
          !selectMode && <ChevronRight className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
        )}
      </GlassCard>
    </motion.div>
  );
}
