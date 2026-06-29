import { useEffect, useCallback, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from "@capacitor/push-notifications";
import {
  LocalNotifications,
  ScheduleOptions,
  LocalNotificationSchema,
} from "@capacitor/local-notifications";
import { supabase } from "@/integrations/supabase/client";
import { registerServiceWorker } from "@/lib/notificationSounds";

interface UsePushNotificationsOptions {
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationAction?: (action: ActionPerformed) => void;
  onLocalNotificationReceived?: (notification: LocalNotificationSchema) => void;
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const tokenRef = useRef<string | null>(null);
  const registeredRef = useRef(false);
  const optionsRef = useRef(options);
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<"granted" | "denied" | "prompt">(
    "prompt",
  );

  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform() as "ios" | "android" | "web";

  const saveTokenToDatabase = useCallback(
    async (token: string) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Upsert the token - update if exists, insert if new
        const { error } = await supabase.from("push_tokens").upsert(
          {
            user_id: user.id,
            token,
            platform,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,token",
          },
        );

        if (error) {
          console.error("Error saving push token:", error);
        } else {
          tokenRef.current = token;
          setToken(token);
        }
      } catch (error) {
        console.error("Error saving push token:", error);
      }
    },
    [platform],
  );

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const removeTokenFromDatabase = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !tokenRef.current) return;

      await supabase
        .from("push_tokens")
        .delete()
        .eq("user_id", user.id)
        .eq("token", tokenRef.current);
      tokenRef.current = null;
      setToken(null);
    } catch (error) {
      console.error("Error removing push token:", error);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      // Fall back to web notifications for non-native platforms
      interface BrowserNotificationAPI {
        requestPermission(): Promise<NotificationPermission>;
        permission: NotificationPermission;
        new (title: string, opts?: NotificationOptions): Notification;
      }
      const BrowserNotification =
        typeof window !== "undefined"
          ? (window as unknown as { Notification?: BrowserNotificationAPI }).Notification
          : undefined;

      if (BrowserNotification?.permission === "granted") {
        setPermissionStatus("granted");
        await registerServiceWorker();
        return true;
      }

      if (typeof BrowserNotification?.requestPermission === "function") {
        const permission = await BrowserNotification.requestPermission();
        setPermissionStatus(permission === "granted" ? "granted" : "denied");
        if (permission === "granted") {
          await registerServiceWorker();
        }
        return permission === "granted";
      }

      return false;
    }

    try {
      // Check current permission status for push notifications
      const permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === "granted") {
        setPermissionStatus("granted");
        return true;
      }

      if (permStatus.receive === "denied") {
        setPermissionStatus("denied");
        return false;
      }

      // Request permission
      const result = await PushNotifications.requestPermissions();
      setPermissionStatus(result.receive === "granted" ? "granted" : "denied");
      return result.receive === "granted";
    } catch (error) {
      console.error("Error requesting push permission:", error);
      return false;
    }
  }, [isNative]);

  const requestLocalNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;

    try {
      const permStatus = await LocalNotifications.checkPermissions();

      if (permStatus.display === "granted") {
        return true;
      }

      if (permStatus.display === "denied") {
        return false;
      }

      const result = await LocalNotifications.requestPermissions();
      return result.display === "granted";
    } catch (error) {
      console.error("Error requesting local notification permission:", error);
      return false;
    }
  }, [isNative]);

  const register = useCallback(async () => {
    if (registeredRef.current || !isNative) return;

    const hasPermission = await requestPermission();
    if (!hasPermission) {
      console.warn("Push notification permission denied");
      return;
    }

    // Also request local notification permission
    await requestLocalNotificationPermission();

    try {
      // Register with Apple / Google to receive push
      await PushNotifications.register();
      registeredRef.current = true;
    } catch (error) {
      console.error("Error registering push notifications:", error);
    }
  }, [isNative, requestPermission, requestLocalNotificationPermission]);

  const scheduleLocalNotification = useCallback(
    async (
      title: string,
      body: string,
      scheduledAt: Date,
      data?: Record<string, string>,
    ): Promise<number | null> => {
      if (!isNative) {
        // For web, we can't schedule local notifications, so just set a timeout
        const delay = scheduledAt.getTime() - Date.now();
        if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
          // Max 24 hours
          setTimeout(() => {
            interface BrowserNotifAPI {
              permission: NotificationPermission;
              new (title: string, opts?: NotificationOptions): Notification;
            }
            const BrowserNotification =
              typeof window !== "undefined"
                ? (window as unknown as { Notification?: BrowserNotifAPI }).Notification
                : undefined;

            if (BrowserNotification?.permission === "granted") {
              new BrowserNotification(title, { body, icon: "/favicon.ico" });
            }
          }, delay);
        }
        return null;
      }

      try {
        const notificationId = Math.floor(Math.random() * 2147483647);

        const scheduleOptions: ScheduleOptions = {
          notifications: [
            {
              id: notificationId,
              title,
              body,
              schedule: { at: scheduledAt },
              extra: data,
              sound: "default",
              smallIcon: "ic_stat_icon_config_sample",
              iconColor: "#6366f1",
            },
          ],
        };

        await LocalNotifications.schedule(scheduleOptions);
        console.log("Local notification scheduled:", { notificationId, title, scheduledAt });
        return notificationId;
      } catch (error) {
        console.error("Error scheduling local notification:", error);
        return null;
      }
    },
    [isNative],
  );

  const cancelLocalNotification = useCallback(
    async (notificationId: number) => {
      if (!isNative) return;

      try {
        await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
        console.log("Local notification cancelled:", notificationId);
      } catch (error) {
        console.error("Error cancelling local notification:", error);
      }
    },
    [isNative],
  );

  const cancelAllLocalNotifications = useCallback(async () => {
    if (!isNative) return;

    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
        console.log("All local notifications cancelled");
      }
    } catch (error) {
      console.error("Error cancelling all local notifications:", error);
    }
  }, [isNative]);

  const getPendingNotifications = useCallback(async () => {
    if (!isNative) return [];

    try {
      const pending = await LocalNotifications.getPending();
      return pending.notifications;
    } catch (error) {
      console.error("Error getting pending notifications:", error);
      return [];
    }
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return;

    // Push notification listeners
    const registrationListener = PushNotifications.addListener("registration", (token: Token) => {
      saveTokenToDatabase(token.value);
    });

    const errorListener = PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration error:", error);
    });

    const notificationListener = PushNotifications.addListener(
      "pushNotificationReceived",
      (notification: PushNotificationSchema) => {
        optionsRef.current.onNotificationReceived?.(notification);
      },
    );

    const actionListener = PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action: ActionPerformed) => {
        optionsRef.current.onNotificationAction?.(action);
      },
    );

    // Local notification listeners
    const localNotificationListener = LocalNotifications.addListener(
      "localNotificationReceived",
      (notification: LocalNotificationSchema) => {
        optionsRef.current.onLocalNotificationReceived?.(notification);
      },
    );

    const localActionListener = LocalNotifications.addListener(
      "localNotificationActionPerformed",
      () => {},
    );

    // Auto-register on mount
    register();

    return () => {
      registrationListener.then((l) => l.remove());
      errorListener.then((l) => l.remove());
      notificationListener.then((l) => l.remove());
      actionListener.then((l) => l.remove());
      localNotificationListener.then((l) => l.remove());
      localActionListener.then((l) => l.remove());
    };
  }, [isNative, register, saveTokenToDatabase]);

  // Clean up token on logout
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && tokenRef.current) {
        saveTokenToDatabase(tokenRef.current);
      }
      if (event === "SIGNED_OUT") {
        removeTokenFromDatabase();
        tokenRef.current = null;
        setToken(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [removeTokenFromDatabase, saveTokenToDatabase]);

  return {
    isNative,
    token,
    permissionStatus,
    requestPermission,
    requestLocalNotificationPermission,
    register,
    scheduleLocalNotification,
    cancelLocalNotification,
    cancelAllLocalNotifications,
    getPendingNotifications,
  };
}
