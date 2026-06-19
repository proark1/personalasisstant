import { useState, useEffect, useCallback, useRef } from "react";
import { UserSettings, defaultSettings, ColorScheme } from "@/types/flux";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

const SETTINGS_KEY = "darai-settings";

export function useSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        return { ...defaultSettings, ...JSON.parse(stored) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    // Apply theme
    document.documentElement.classList.remove("light", "dark", "colorful");
    document.documentElement.classList.add(settings.theme);

    // Apply color scheme via CSS custom properties
    applyColorScheme(settings.colorScheme);
  }, [settings]);

  // Load cloud settings once per user. Cloud wins when a row exists; if the
  // user_settings table is missing (migration not applied yet) or the query
  // fails, we silently keep the local settings — so this degrades gracefully.
  const cloudLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user || cloudLoadedFor.current === user.id) return;
    cloudLoadedFor.current = user.id;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("user_settings")
          .select("settings")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled || error || !data?.settings) return;
        setSettings((prev) => ({
          ...defaultSettings,
          ...prev,
          ...(data.settings as Partial<UserSettings>),
        }));
      } catch {
        /* table missing / offline — keep local settings */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Write-through to the cloud (fire-and-forget; ignored if the table is absent).
  const persistCloud = useCallback(
    (next: UserSettings) => {
      if (!user) return;
      void supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            settings: next as unknown as Json,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        .then(({ error }) => {
          if (error) {
            /* table missing / offline — ignore */
          }
        });
    },
    [user],
  );

  const updateSettings = useCallback(
    (updates: Partial<UserSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...updates };
        persistCloud(next);
        return next;
      });
    },
    [persistCloud],
  );

  const updateNotifications = useCallback(
    (updates: Partial<UserSettings["notifications"]>) => {
      setSettings((prev) => {
        const next = { ...prev, notifications: { ...prev.notifications, ...updates } };
        persistCloud(next);
        return next;
      });
    },
    [persistCloud],
  );

  return { settings, updateSettings, updateNotifications };
}

function applyColorScheme(scheme: ColorScheme) {
  const root = document.documentElement;

  const schemes: Record<ColorScheme, { primary: string; accent: string; ghost: string }> = {
    emerald: { primary: "160 84% 39%", accent: "173 80% 40%", ghost: "160 84% 45%" },
    cyan: { primary: "187 94% 43%", accent: "270 60% 50%", ghost: "270 80% 60%" },
    purple: { primary: "270 60% 50%", accent: "187 94% 43%", ghost: "270 80% 60%" },
    green: { primary: "142 71% 45%", accent: "187 94% 43%", ghost: "142 80% 50%" },
    orange: { primary: "25 95% 53%", accent: "270 60% 50%", ghost: "25 90% 55%" },
    pink: { primary: "330 80% 55%", accent: "270 60% 50%", ghost: "330 85% 60%" },
  };

  const colors = schemes[scheme];
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--glow-primary", colors.primary);
  root.style.setProperty("--ring", colors.primary);
  root.style.setProperty("--sidebar-primary", colors.primary);
  root.style.setProperty("--sidebar-ring", colors.primary);
  // Keep accent in sync with the chosen scheme (previously defined but never
  // applied, which left a mismatched accent hue behind).
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--glow-accent", colors.accent);
  root.style.setProperty("--ghost-primary", colors.ghost);
}
