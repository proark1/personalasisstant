import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, onCheckedChange, ...props }, ref) => {
  const { vibrate } = useHaptics();

  const handleCheckedChange = React.useCallback(
    (checked: boolean) => {
      vibrate("medium");
      onCheckedChange?.(checked);
    },
    [vibrate, onCheckedChange],
  );

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
        "touch-manipulation select-none",
        "transition-all duration-200 ease-out",
        "active:scale-95",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      onCheckedChange={handleCheckedChange}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-6 w-6 rounded-full bg-background shadow-lg ring-0",
          "transition-transform duration-200 ease-out",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
