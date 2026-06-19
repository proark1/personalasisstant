import * as React from "react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

interface TouchableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  haptic?: "light" | "medium" | "heavy" | "success" | "warning" | "error" | false;
  scale?: "sm" | "md" | "lg" | false;
  asChild?: boolean;
  disabled?: boolean;
}

const scaleClasses = {
  sm: "active:scale-[0.98]",
  md: "active:scale-95",
  lg: "active:scale-90",
};

const Touchable = React.forwardRef<HTMLDivElement, TouchableProps>(
  (
    { children, className, haptic = "light", scale = "md", disabled = false, onClick, ...props },
    ref,
  ) => {
    const { vibrate } = useHaptics();

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (disabled) return;

        if (haptic) {
          vibrate(haptic);
        }

        onClick?.(e);
      },
      [disabled, haptic, vibrate, onClick],
    );

    return (
      <div
        ref={ref}
        className={cn(
          "touch-manipulation select-none transition-transform duration-150 ease-out",
          scale && scaleClasses[scale],
          disabled && "opacity-50 pointer-events-none",
          className,
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Touchable.displayName = "Touchable";

export { Touchable };
