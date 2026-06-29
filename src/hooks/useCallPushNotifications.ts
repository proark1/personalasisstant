import { useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Dynamic imports for Capacitor plugins
interface PushNotificationsPlugin {
  register(): Promise<void>;
  requestPermissions(): Promise<{ receive: string }>;
  addListener(event: string, callback: (data: unknown) => void): Promise<PluginListenerHandle>;
}

interface PluginListenerHandle {
  remove(): Promise<void> | void;
}
let PushNotifications: PushNotificationsPlugin | null = null;

const loadPushNotifications = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const module = await import("@capacitor/push-notifications");
      PushNotifications = module.PushNotifications;
      return true;
    } catch (e) {
      console.warn("[CallPush] Plugin not available:", e);
      return false;
    }
  }
  return false;
};

interface UseCallPushNotificationsOptions {
  userId: string | null;
  onIncomingCall?: (callerId: string, callerName: string, sessionId: string) => void;
  enabled?: boolean;
}

export function useCallPushNotifications({
  userId,
  onIncomingCall,
  enabled = true,
}: UseCallPushNotificationsOptions) {
  const { toast } = useToast();
  const tokenRef = useRef<string | null>(null);
  const listenerHandlesRef = useRef<Promise<PluginListenerHandle>[]>([]);

  // Register push token with backend
  const registerToken = useCallback(
    async (token: string) => {
      if (!userId) return;

      try {
        const { error } = await supabase.from("push_tokens").upsert(
          {
            user_id: userId,
            token,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,token",
          },
        );

        if (error) {
          console.error("[CallPush] Error registering token:", error);
        } else {
          tokenRef.current = token;
        }
      } catch (e) {
        console.error("[CallPush] Failed to register token:", e);
      }
    },
    [userId],
  );

  // Initialize push notifications
  const initializePushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const loaded = await loadPushNotifications();
    if (!loaded || !PushNotifications) {
      console.warn("[CallPush] PushNotifications plugin not available");
      return;
    }

    try {
      // Request permission
      const permResult = await PushNotifications.requestPermissions();

      if (permResult.receive !== "granted") {
        toast({
          title: "Push Notifications Disabled",
          description: "Enable notifications in settings to receive call alerts.",
          variant: "destructive",
        });
        return;
      }

      // Register for push notifications
      await PushNotifications.register();

      await Promise.all(
        listenerHandlesRef.current.map(async (handlePromise) => {
          const handle = await handlePromise;
          await handle.remove();
        }),
      );

      // Listen for registration success
      listenerHandlesRef.current = [
        PushNotifications.addListener("registration", (token: unknown) => {
          registerToken((token as { value: string }).value);
        }),

        // Listen for registration errors
        PushNotifications.addListener("registrationError", (error: unknown) => {
          console.error("[CallPush] Registration error:", error);
        }),

        // Listen for push notifications received
        PushNotifications.addListener("pushNotificationReceived", (notification: unknown) => {
          const n = notification as {
            data?: { type?: string; caller_id: string; caller_name: string; session_id: string };
          };
          if (n?.data?.type === "incoming_call" && onIncomingCall) {
            onIncomingCall(n.data.caller_id, n.data.caller_name, n.data.session_id);
          }
        }),

        // Listen for push notification action performed
        PushNotifications.addListener("pushNotificationActionPerformed", (action: unknown) => {
          const a = action as {
            notification?: {
              data?: { type?: string; caller_id: string; caller_name: string; session_id: string };
            };
          };
          if (a?.notification?.data?.type === "incoming_call" && onIncomingCall) {
            onIncomingCall(
              a.notification.data.caller_id,
              a.notification.data.caller_name,
              a.notification.data.session_id,
            );
          }
        }),
      ];
    } catch (error) {
      console.error("[CallPush] Initialization error:", error);
    }
  }, [registerToken, toast, onIncomingCall]);

  // Cleanup on unmount
  const cleanup = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !PushNotifications) return;

    try {
      await Promise.all(
        listenerHandlesRef.current.map(async (handlePromise) => {
          const handle = await handlePromise;
          await handle.remove();
        }),
      );
      listenerHandlesRef.current = [];
    } catch (e) {
      console.error("[CallPush] Cleanup error:", e);
    }
  }, []);

  useEffect(() => {
    if (enabled && userId) {
      initializePushNotifications();
    }

    return () => {
      cleanup();
    };
  }, [userId, enabled, initializePushNotifications, cleanup]);

  return {
    token: tokenRef.current,
    reinitialize: initializePushNotifications,
  };
}
