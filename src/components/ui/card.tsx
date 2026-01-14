import * as React from "react";

import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
));
Card.displayName = "Card";

interface CardInteractiveProps extends React.HTMLAttributes<HTMLDivElement> {
  haptic?: "light" | "medium" | false;
}

const CardInteractive = React.forwardRef<HTMLDivElement, CardInteractiveProps>(
  ({ className, haptic = "light", onClick, ...props }, ref) => {
    const { vibrate } = useHaptics();
    
    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (haptic) {
          vibrate(haptic);
        }
        onClick?.(e);
      },
      [haptic, vibrate, onClick]
    );
    
    return (
      <div 
        ref={ref} 
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          "touch-manipulation select-none cursor-pointer",
          "transition-all duration-150 ease-out",
          "active:scale-[0.98] active:shadow-none",
          "hover:shadow-md hover:border-primary/20",
          className
        )} 
        onClick={handleClick}
        {...props} 
      />
    );
  }
);
CardInteractive.displayName = "CardInteractive";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-4 sm:p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg sm:text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-4 sm:p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-4 sm:p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardInteractive, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
