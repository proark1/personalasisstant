import { cn } from "@/lib/utils";

interface OnlineIndicatorProps {
  isOnline: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function OnlineIndicator({ isOnline, className, size = "md" }: OnlineIndicatorProps) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  return (
    <span
      className={cn(
        "rounded-full border-2 border-background",
        sizeClasses[size],
        isOnline ? "bg-success" : "bg-muted-foreground/50",
        className,
      )}
      title={isOnline ? "Online" : "Offline"}
    />
  );
}
