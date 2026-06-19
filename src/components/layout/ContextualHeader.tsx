import { Button } from "@/components/ui/button";
import { Search, Menu } from "lucide-react";
import {
  NotificationCenter,
  type AppNotification,
} from "@/components/notifications/NotificationCenter";
import { DoriNotificationIcon } from "@/components/assistant/DoriNotificationIcon";
import { AssistantHubSheet } from "@/components/hub/AssistantHubSheet";
import { VisionCaptureButton } from "@/components/capture/VisionCaptureButton";
import { BrainDumpFAB } from "@/components/capture/BrainDumpFAB";
import { SchedulePlannerSheet } from "@/components/schedule/SchedulePlannerSheet";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { motion, AnimatePresence } from "framer-motion";

interface ContextualHeaderProps {
  title: string;
  onOpenMenu?: () => void;
  onOpenSearch?: () => void;
  notifications: AppNotification[];
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
          <>
            {/* Desktop: a command-bar pill — the "Ask Dori or jump anywhere" front door. */}
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Open command palette — ask Dori or search"
              className="hidden md:flex items-center gap-2 h-9 pl-3 pr-2 rounded-full border border-border bg-muted/40 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              <span>Ask Dori or search…</span>
              <kbd className="ml-1 hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            {/* Mobile: compact icon button. */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={onOpenSearch}
              aria-label="Open command palette"
            >
              <Search className="w-4.5 h-4.5" />
            </Button>
          </>
        )}
        <DoriNotificationIcon />
        {/* Frictionless capture — jot any thought; AI sorts it into tasks/notes/events. */}
        <BrainDumpFAB className="static" />
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
