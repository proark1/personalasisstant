import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles, Zap } from "lucide-react";

interface XPBadgeProps {
  amount: number;
  className?: string;
  onComplete?: () => void;
}

export function XPBadge({ amount, className, onComplete }: XPBadgeProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 1500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={cn(
            "fixed pointer-events-none z-[100] flex items-center gap-1.5",
            "bg-gradient-to-r from-yellow-400 to-orange-500 text-white",
            "px-3 py-1.5 rounded-full font-bold text-sm shadow-lg",
            className,
          )}
          initial={{ opacity: 0, scale: 0.5, y: 0 }}
          animate={{ opacity: 1, scale: 1, y: -20 }}
          exit={{ opacity: 0, scale: 0.8, y: -60 }}
          transition={{
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          <Zap className="w-4 h-4" />
          <span>+{amount} XP</span>
          <Sparkles className="w-3 h-3" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Provider component to show XP badges globally
import { createContext, useContext, useCallback, ReactNode } from "react";

interface XPBadgeContextType {
  showXP: (amount: number, x?: number, y?: number) => void;
}

const XPBadgeContext = createContext<XPBadgeContextType | null>(null);

interface XPBadgeItem {
  id: string;
  amount: number;
  x: number;
  y: number;
}

export function XPBadgeProvider({ children }: { children: ReactNode }) {
  const [badges, setBadges] = useState<XPBadgeItem[]>([]);

  const showXP = useCallback((amount: number, x?: number, y?: number) => {
    const id = `${Date.now()}-${Math.random()}`;
    const badge: XPBadgeItem = {
      id,
      amount,
      x: x ?? window.innerWidth / 2,
      y: y ?? window.innerHeight / 2,
    };

    setBadges((prev) => [...prev, badge]);
  }, []);

  const removeBadge = useCallback((id: string) => {
    setBadges((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return (
    <XPBadgeContext.Provider value={{ showXP }}>
      {children}
      {badges.map((badge) => (
        <div
          key={badge.id}
          style={{
            position: "fixed",
            left: badge.x,
            top: badge.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <XPBadge amount={badge.amount} onComplete={() => removeBadge(badge.id)} />
        </div>
      ))}
    </XPBadgeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useXPBadge() {
  const context = useContext(XPBadgeContext);
  if (!context) {
    throw new Error("useXPBadge must be used within XPBadgeProvider");
  }
  return context;
}
