import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { UserProfile } from "./useSmartContext";

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (fetchError) {
        console.error("Error fetching profile:", fetchError);
        setError(fetchError.message);
        return;
      }

      if (data) {
        // Telegram and cron paths can't detect a timezone, so the web client is
        // the source of truth. The first time we see an empty timezone, capture
        // the browser's and persist it — otherwise Dori resolves "today"/
        // "tonight" in UTC and schedules on the wrong day near midnight.
        const browserTz =
          typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : undefined;
        const effectiveTz = data.timezone || browserTz || undefined;
        if (!data.timezone && browserTz) {
          void supabase
            .from("profiles")
            .update({ timezone: browserTz })
            .eq("user_id", user.id)
            .then(({ error: tzErr }) => {
              if (tzErr) console.warn("Failed to persist timezone:", tzErr.message);
            });
        }

        setProfile({
          id: data.id,
          displayName: data.display_name,
          email: data.email,
          bio: data.bio,
          birthDate: data.birth_date,
          businesses: data.businesses || [],
          role: data.role,
          interests: data.interests || [],
          skills: data.skills || [],
          goals: data.goals,
          locationCity: data.location_city,
          locationCountry: data.location_country,
          preferredWorkHours: data.preferred_work_hours,
          timezone: effectiveTz,
          locale: data.locale ?? undefined,
        });
      }
    } catch (err) {
      console.error("Error in fetchProfile:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Map camelCase to snake_case for database
      const dbUpdates: Record<string, unknown> = {};
      if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
      if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
      if (updates.birthDate !== undefined) dbUpdates.birth_date = updates.birthDate;
      if (updates.businesses !== undefined) dbUpdates.businesses = updates.businesses;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.interests !== undefined) dbUpdates.interests = updates.interests;
      if (updates.skills !== undefined) dbUpdates.skills = updates.skills;
      if (updates.goals !== undefined) dbUpdates.goals = updates.goals;
      if (updates.locationCity !== undefined) dbUpdates.location_city = updates.locationCity;
      if (updates.locationCountry !== undefined)
        dbUpdates.location_country = updates.locationCountry;
      if (updates.preferredWorkHours !== undefined)
        dbUpdates.preferred_work_hours = updates.preferredWorkHours;
      if (updates.timezone !== undefined) dbUpdates.timezone = updates.timezone;
      if (updates.locale !== undefined) dbUpdates.locale = updates.locale || null;

      const { error: updateError } = await supabase
        .from("profiles")
        .update(dbUpdates as TablesUpdate<"profiles">)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Update local state
      setProfile((prev) => (prev ? { ...prev, ...updates } : null));

      return { success: true };
    } catch (err) {
      console.error("Error updating profile:", err);
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }, []);

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    refetch: fetchProfile,
  };
}
