import { useCallback } from "react";

type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error";

export function useHaptics() {
  const vibrate = useCallback(async (style: HapticStyle = "light") => {
    try {
      const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");

      switch (style) {
        case "light":
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case "medium":
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case "heavy":
          await Haptics.impact({ style: ImpactStyle.Heavy });
          break;
        case "success":
          await Haptics.notification({ type: NotificationType.Success });
          break;
        case "warning":
          await Haptics.notification({ type: NotificationType.Warning });
          break;
        case "error":
          await Haptics.notification({ type: NotificationType.Error });
          break;
      }
    } catch (error) {
      // Haptics not available (web browser)
      console.debug("Haptics not available:", error);
    }
  }, []);

  const selectionChanged = useCallback(async () => {
    try {
      const { Haptics } = await import("@capacitor/haptics");
      await Haptics.selectionChanged();
    } catch (error) {
      console.debug("Haptics not available:", error);
    }
  }, []);

  return { vibrate, selectionChanged };
}
