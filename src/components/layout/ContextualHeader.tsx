import { Button } from '@/components/ui/button';
import { Search, Menu } from 'lucide-react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { DoriNotificationIcon } from '@/components/assistant/DoriNotificationIcon';
import { AssistantHubSheet } from '@/components/hub/AssistantHubSheet';
import { VisionCaptureButton } from '@/components/capture/VisionCaptureButton';
import { SchedulePlannerSheet } from '@/components/schedule/SchedulePlannerSheet';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { motion, AnimatePresence } from 'framer-motion';

interface ContextualHeaderProps {
  title: string;
  onOpenMenu?: () => void;
  onOpenSearch?: () => void;
  notifications: any[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAll: () => void;
  rightSlot?: React.ReactNode;
}

export function ContextualHeader({
  title,
  onOpenMenu,
  onOpenSearch,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
  onClearAll,
  rightSlot,
}: ContextualHeaderProps) {
  return (
    <header className="h-16 px-4 md:px-6 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-2.5 min-w-0">
        <AnimatePresence mode="wait">
          <motion.h1
            key={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-lg md:text-xl font-semibold tracking-tight text-foreground truncate"
          >
            {title}
          </motion.h1>
        </AnimatePresence>
        <WorkspaceSwitcher />
      </div>
      <div className="flex items-center gap-1">
        {onOpenSearch && (
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onOpenSearch}>
            <Search className="w-4.5 h-4.5" />
          </Button>
        )}
        <DoriNotificationIcon />
        <VisionCaptureButton />
        <SchedulePlannerSheet />
        <AssistantHubSheet />
        <NotificationCenter
          notifications={notifications}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
          onDelete={onDeleteNotification}
          onClearAll={onClearAll}
        />
        {rightSlot}
        {onOpenMenu && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onOpenMenu}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}
      </div>
    </header>
  );
}
