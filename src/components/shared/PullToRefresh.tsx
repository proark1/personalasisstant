import { useState, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useHaptics } from "@/hooks/useHaptics";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className = "" }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const { vibrate } = useHaptics();

  const pullDistance = useMotionValue(0);
  const pullThreshold = 80;

  const spinnerOpacity = useTransform(pullDistance, [0, pullThreshold], [0, 1]);
  const spinnerRotation = useTransform(pullDistance, [0, pullThreshold], [0, 180]);
  const translateY = useTransform(pullDistance, [0, pullThreshold * 1.5], [0, pullThreshold]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (containerRef.current?.scrollTop === 0 && !isRefreshing) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    },
    [isRefreshing],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = Math.max(0, currentY - startY.current);
      const dampedDiff = diff * 0.5; // Damping for natural feel

      pullDistance.set(Math.min(dampedDiff, pullThreshold * 1.5));

      if (dampedDiff >= pullThreshold && pullDistance.get() < pullThreshold) {
        vibrate("medium");
      }
    },
    [isPulling, isRefreshing, pullDistance, vibrate],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    const currentPull = pullDistance.get();

    if (currentPull >= pullThreshold && !isRefreshing) {
      setIsRefreshing(true);
      vibrate("success");

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    pullDistance.set(0);
    setIsPulling(false);
    startY.current = 0;
  }, [isPulling, isRefreshing, onRefresh, pullDistance, vibrate]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center"
        style={{
          opacity: spinnerOpacity,
          y: useTransform(pullDistance, [0, pullThreshold], [-40, 10]),
        }}
      >
        <motion.div
          className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"
          style={{ rotate: isRefreshing ? undefined : spinnerRotation }}
          animate={isRefreshing ? { rotate: 360 } : {}}
          transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
        >
          <RefreshCw className="w-5 h-5 text-primary" />
        </motion.div>
      </motion.div>

      {/* Content */}
      <motion.div style={{ y: isPulling || isRefreshing ? translateY : 0 }}>{children}</motion.div>
    </div>
  );
}
