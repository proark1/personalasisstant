import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface SuccessCheckmarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  onComplete?: () => void;
}

const sizes = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export function SuccessCheckmark({ size = "md", className, onComplete }: SuccessCheckmarkProps) {
  return (
    <motion.div
      className={cn(
        "relative flex items-center justify-center rounded-full",
        "bg-gradient-to-br from-green-400 to-emerald-500",
        "shadow-lg shadow-green-500/30",
        sizes[size],
        className,
      )}
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        duration: 0.5,
      }}
      onAnimationComplete={onComplete}
    >
      {/* Outer ring animation */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-green-400"
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: 1.5, opacity: 0 }}
        transition={{
          duration: 0.6,
          ease: "easeOut",
        }}
      />

      {/* Check icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          delay: 0.2,
          type: "spring",
          stiffness: 300,
          damping: 15,
        }}
      >
        <Check className={cn("text-white", iconSizes[size])} strokeWidth={3} />
      </motion.div>
    </motion.div>
  );
}

// Inline checkmark for list items
export function InlineCheckmark({ className }: { className?: string }) {
  return (
    <motion.span
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 rounded-full",
        "bg-green-500 text-white",
        className,
      )}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 15,
      }}
    >
      <Check className="w-3 h-3" strokeWidth={3} />
    </motion.span>
  );
}
