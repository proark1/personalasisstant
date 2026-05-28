import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { EmptyState } from "./empty-state";
import { PanelSkeleton, PanelSkeletonVariant } from "./panel-skeleton";

interface PanelShellProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  loading?: boolean;
  loadingVariant?: PanelSkeletonVariant;
  empty?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  noPadding?: boolean;
  /** Extra content rendered below the header row (e.g. progress bar, search) */
  headerExtra?: React.ReactNode;
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

export function PanelShell({
  icon: Icon,
  title,
  subtitle,
  actions,
  loading,
  loadingVariant = "list",
  empty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
  className,
  headerClassName,
  contentClassName,
  noPadding,
  headerExtra,
}: PanelShellProps) {
  return (
    <div className={cn("flex flex-col h-full min-w-0 max-w-full overflow-hidden", className)}>
      {/* Header */}
      <div className={cn("px-4 md:px-6 py-4 border-b border-border shrink-0", headerClassName)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && <Icon className="w-5 h-5 text-primary shrink-0" />}
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">{title}</h2>
              {subtitle && (
                <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </div>
        {headerExtra && <div className="mt-4">{headerExtra}</div>}
      </div>

      {/* Body */}
      {loading ? (
        <div className={cn("flex-1 p-4 md:p-6", contentClassName)}>
          <PanelSkeleton variant={loadingVariant} />
        </div>
      ) : empty ? (
        <div className="flex-1 flex items-center justify-center p-4 md:p-6">
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle || "Nothing here yet"}
            description={emptyDescription}
            action={emptyAction}
          />
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className={cn(
            "flex-1 overflow-y-auto scroll-fade",
            !noPadding && "p-4 md:p-6",
            contentClassName
          )}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}

export { staggerItem, staggerContainer };
export type { PanelShellProps };
