import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

// Capacitor's PushNotifications plugin yields a NATIVE APNs/FCM token, not an
// Expo push token. We persist the native token as-is and do NOT synthesize an
// `ExponentPushToken[...]` from it — Expo only delivers to tokens it minted
// server-side, so a fabricated token is rejected by Expo's push API
// (DeviceNotRegistered). Real native delivery (APNs/FCM) or genuine Expo token
// acquisition is a server-side concern; see supabase/functions/push-delivery.

export function useExpoPushNotifications() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<"granted" | "denied" | "prompt">(
    "prompt",
  );
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  const saveTokenToDatabase = useCallback(
    async (nativeToken: string, expoToken?: string) => {
      if (!user?.id) return;

      try {
        const platform = Capacitor.getPlatform();

        // Check if token already exists
        const { data: existing } = await supabase
          .from("push_tokens")
          .select("id")
          .eq("user_id", user.id)
          .eq("token", nativeToken)
          .single();

        if (existing) {
          // Update existing token
          await supabase
            .from("push_tokens")
            .update({
              expo_push_token: expoToken || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          // Insert new token
          await supabase.from("push_tokens").insert({
            user_id: user.id,
            token: nativeToken,
            expo_push_token: expoToken || null,
            platform,
          });
        }
      } catch (err) {
        console.error("Failed to save push token:", err);
      }
    },
    [user?.id],
  );

  const removeTokenFromDatabase = useCallback(async () => {
    if (!user?.id || !token) return;

    try {
      await supabase.from("push_tokens").delete().eq("user_id", user.id).eq("token", token);
    } catch (err) {
      console.error("Failed to remove push token:", err);
    }
  }, [token, user?.id]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      // For web, use browser notifications
      type NotificationCtor = typeof Notification;
      const BrowserNotification =
        typeof window !== "undefined"
          ? (window as unknown as { Notification?: NotificationCtor }).Notification
          : undefined;

      if (typeof BrowserNotification?.requestPermission === "function") {
        const permission = await BrowserNotification.requestPermission();
        setPermissionStatus(permission === "granted" ? "granted" : "denied");
        return permission === "granted";
      }

      return false;
    }

    try {
      let status = await PushNotifications.checkPermissions();

      if (status.receive === "prompt") {
        status = await PushNotifications.requestPermissions();
      }

      setPermissionStatus(status.receive === "granted" ? "granted" : "denied");
      return status.receive === "granted";
    } catch (err) {
      console.error("Failed to request push permission:", err);
      return false;
    }
  }, [isNative]);

  const register = useCallback(async () => {
    if (!isNative) {
      return;
    }

    const hasPermission = await requestPermission();
    if (!hasPermission) {
      console.warn("Push notification permission denied");
      return;
    }

    try {
      await PushNotifications.register();
    } catch (err) {
      console.error("Failed to register for push notifications:", err);
    }
  }, [isNative, requestPermission]);

  useEffect(() => {
    if (!isNative) return;

    // Listen for registration success
    const registrationListener = PushNotifications.addListener(
      "registration",
      async (tokenData: Token) => {
        setToken(tokenData.value);

        // Store ONLY the real native token. We have no genuine Expo push token
        // here, so we leave it null rather than fabricating one (a faked
        // `ExponentPushToken[...]` is rejected by Expo's push API).
        setExpoPushToken(null);

        await saveTokenToDatabase(tokenData.value);
      },
    );

    // Listen for registration errors
    const errorListener = PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration error:", error);
    });

    // Listen for push notifications received
    const receivedListener = PushNotifications.addListener(
      "pushNotificationReceived",
      (notification: PushNotificationSchema) => {
        // Show a toast for foreground notifications
        toast(notification.title || "Notification", {
          description: notification.body,
        });
      },
    );

    // Listen for push notification actions (tap)
    const actionListener = PushNotifications.addListener(
      "pushNotificationActionPerformed",
      async (action: ActionPerformed) => {
        const data = action.notification.data;

        // Handle reminder actions
        if (data?.reminder_id) {
          // Mark reminder as read/actioned
          await supabase
            .from("proactive_reminders")
            .update({
              read_at: new Date().toISOString(),
              action_taken: true,
              action_type: "opened",
            })
            .eq("id", data.reminder_id);

          // Update delivery log
          await supabase
            .from("reminder_delivery_log")
            .update({ clicked_at: new Date().toISOString() })
            .eq("reminder_id", data.reminder_id)
            .eq("delivery_channel", "push");
        }

        // Deep-link the user to the right entity. We dispatch a window
        // event instead of calling a router directly so this hook stays
        // context-free; whichever component mounts the StandardMode shell
        // listens and routes (see useDeepLinkHandler).
        if (data?.trigger_entity_type && data?.trigger_entity_id) {
          try {
            window.dispatchEvent(
              new CustomEvent("dori:open-entity", {
                detail: {
                  type: String(data.trigger_entity_type),
                  id: String(data.trigger_entity_id),
                  source: "push",
                },
              }),
            );
          } catch (e) {
            console.error("open-entity dispatch failed", e);
          }
        }
      },
    );

    // Auto-register on mount if user is logged in
    if (user?.id) {
      register();
    }

    return () => {
      registrationListener.then((l) => l.remove());
      errorListener.then((l) => l.remove());
      receivedListener.then((l) => l.remove());
      actionListener.then((l) => l.remove());
    };
  }, [isNative, user?.id, register, saveTokenToDatabase]);

  // Clean up token on logout
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        removeTokenFromDatabase();
        setToken(null);
        setExpoPushToken(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [removeTokenFromDatabase]);

  return {
    token,
    expoPushToken,
    permissionStatus,
    isNative,
    requestPermission,
    register,
  };
}
