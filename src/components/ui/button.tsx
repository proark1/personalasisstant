import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 touch-manipulation select-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 shadow-lg shadow-primary/20",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        outline:
          "border border-border bg-transparent hover:bg-muted active:bg-muted/80 hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
        ghost: "hover:bg-muted active:bg-muted/80 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline active:opacity-70",
        glass:
          "bg-glass/60 backdrop-blur-lg border border-glass-border/50 text-foreground hover:bg-glass/80 active:bg-glass/90 hover:border-primary/30",
        glow: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:shadow-xl",
        ghost_mode:
          "bg-ghost-primary/20 text-ghost-primary border border-ghost-primary/30 hover:bg-ghost-primary/30 active:bg-ghost-primary/40 hover:shadow-lg hover:shadow-ghost-primary/20",
        voice_mode:
          "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 active:bg-primary/40 hover:shadow-lg hover:shadow-primary/20",
      },
      size: {
        default: "h-10 px-4 py-2 min-h-[44px]",
        sm: "h-9 rounded-md px-3 text-xs min-h-[36px]",
        lg: "h-12 rounded-lg px-6 text-base min-h-[48px]",
        xl: "h-14 rounded-xl px-8 text-lg min-h-[56px]",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
        iconSm: "h-9 w-9 min-h-[36px] min-w-[36px]",
        iconLg: "h-12 w-12 min-h-[48px] min-w-[48px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  haptic?: "light" | "medium" | "heavy" | "success" | false;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      haptic = "light",
      loading = false,
      onClick,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const { vibrate } = useHaptics();
    const Comp = asChild ? Slot : "button";

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (haptic) {
          vibrate(haptic);
        }
        onClick?.(e);
      },
      [haptic, vibrate, onClick],
    );

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          onClick={onClick}
          aria-busy={loading || undefined}
          data-loading={loading ? "true" : undefined}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
