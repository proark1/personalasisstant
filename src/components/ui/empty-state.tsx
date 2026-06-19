import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6 max-w-sm mx-auto",
        className,
      )}
    >
      {Icon && (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center mb-5"
        >
          <Icon className="w-7 h-7 text-primary/70" />
        </motion.div>
      )}
      <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">{description}</p>
      )}
      {action && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
