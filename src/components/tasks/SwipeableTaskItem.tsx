import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { useHaptics } from "@/hooks/useHaptics";
import { cn } from "@/lib/utils";

interface SwipeableTaskItemProps {
  children: React.ReactNode;
  onComplete?: () => void;
  onDelete?: () => void;
  isCompleted?: boolean;
  disabled?: boolean;
  className?: string;
}

const SWIPE_THRESHOLD = 80;

export function SwipeableTaskItem({
  children,
  onComplete,
  onDelete,
  isCompleted = false,
  disabled = false,
  className,
}: SwipeableTaskItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef(null);
  const { vibrate } = useHaptics();
  const hasTriggeredHapticRef = useRef(false);

  const x = useMotionValue(0);

  // Left swipe reveals delete (red) - progressive intensity
  const deleteOpacity = useTransform(
    x,
    [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD, -20, 0],
    [1, 0.9, 0.3, 0],
  );
  const deleteScale = useTransform(x, [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD, 0], [1, 0.9, 0.5]);
  const deleteBg = useTransform(
    x,
    [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD, -40, 0],
    ["hsl(0 84% 50%)", "hsl(0 84% 55%)", "hsl(0 60% 65%)", "hsl(0 60% 70%)"],
  );

  // Right swipe reveals complete (green) - progressive intensity
  const completeOpacity = useTransform(
    x,
    [0, 20, SWIPE_THRESHOLD, SWIPE_THRESHOLD * 1.5],
    [0, 0.3, 0.9, 1],
  );
  const completeScale = useTransform(x, [0, SWIPE_THRESHOLD, SWIPE_THRESHOLD * 1.5], [0.5, 0.9, 1]);
  const completeBg = useTransform(
    x,
    [0, 40, SWIPE_THRESHOLD, SWIPE_THRESHOLD * 1.5],
    ["hsl(142 70% 55%)", "hsl(142 60% 50%)", "hsl(142 70% 45%)", "hsl(142 76% 40%)"],
  );

  // Text label opacity - only show near threshold
  const deleteLabelOpacity = useTransform(
    x,
    [-SWIPE_THRESHOLD * 1.2, -SWIPE_THRESHOLD * 0.7, 0],
    [1, 0.5, 0],
  );
  const completeLabelOpacity = useTransform(
    x,
    [0, SWIPE_THRESHOLD * 0.7, SWIPE_THRESHOLD * 1.2],
    [0, 0.5, 1],
  );

  const handleDragStart = () => {
    setIsDragging(true);
    hasTriggeredHapticRef.current = false;
  };

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Trigger haptic when crossing threshold
    if (!hasTriggeredHapticRef.current && Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      vibrate("light");
      hasTriggeredHapticRef.current = true;
    }
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    hasTriggeredHapticRef.current = false;

    if (info.offset.x > SWIPE_THRESHOLD && onComplete && !isCompleted) {
      vibrate("success");
      onComplete();
    } else if (info.offset.x < -SWIPE_THRESHOLD && onDelete) {
      vibrate("warning");
      onDelete();
    }
  };

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={constraintsRef} className="relative overflow-hidden rounded-xl">
      {/* Complete action (right swipe) */}
      {!isCompleted && onComplete && (
        <motion.div
          className="absolute inset-y-0 left-0 w-24 flex items-center justify-center gap-1.5"
          style={{ opacity: completeOpacity, backgroundColor: completeBg }}
        >
          <motion.div style={{ scale: completeScale }} className="flex items-center gap-1.5">
            <Check className="w-5 h-5 text-white" />
            <motion.span
              className="text-xs font-medium text-white"
              style={{ opacity: completeLabelOpacity }}
            >
              Done
            </motion.span>
          </motion.div>
        </motion.div>
      )}

      {/* Delete action (left swipe) */}
      {onDelete && (
        <motion.div
          className="absolute inset-y-0 right-0 w-24 flex items-center justify-center gap-1.5"
          style={{ opacity: deleteOpacity, backgroundColor: deleteBg }}
        >
          <motion.div style={{ scale: deleteScale }} className="flex items-center gap-1.5">
            <motion.span
              className="text-xs font-medium text-white"
              style={{ opacity: deleteLabelOpacity }}
            >
              Delete
            </motion.span>
            <Trash2 className="w-5 h-5 text-white" />
          </motion.div>
        </motion.div>
      )}

      {/* Main content */}
      <motion.div
        drag="x"
        dragConstraints={{
          left: onDelete ? -SWIPE_THRESHOLD * 1.5 : 0,
          right: onComplete && !isCompleted ? SWIPE_THRESHOLD * 1.5 : 0,
        }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={cn(
          "relative bg-card cursor-grab active:cursor-grabbing touch-pan-y",
          isDragging && "z-10",
          className,
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}
