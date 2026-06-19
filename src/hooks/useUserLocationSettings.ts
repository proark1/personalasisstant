import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export interface UserLocationSettings {
  id: string;
  user_id: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  show_weather: boolean;
  temperature_unit: "celsius" | "fahrenheit";
  prayer_calculation_method: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_LOCATION: Partial<UserLocationSettings> = {
  city: "Berlin",
  country: "Germany",
  timezone: "Europe/Berlin",
  show_weather: true,
  temperature_unit: "celsius",
  prayer_calculation_method: 2,
};

// List of major cities with coordinates for quick selection
export const MAJOR_CITIES = [
  { city: "Berlin", country: "Germany", lat: 52.52, lng: 13.405, tz: "Europe/Berlin" },
  { city: "London", country: "United Kingdom", lat: 51.5074, lng: -0.1278, tz: "Europe/London" },
  { city: "Paris", country: "France", lat: 48.8566, lng: 2.3522, tz: "Europe/Paris" },
  { city: "New York", country: "USA", lat: 40.7128, lng: -74.006, tz: "America/New_York" },
  { city: "Los Angeles", country: "USA", lat: 34.0522, lng: -118.2437, tz: "America/Los_Angeles" },
  { city: "Dubai", country: "UAE", lat: 25.2048, lng: 55.2708, tz: "Asia/Dubai" },
  { city: "Istanbul", country: "Turkey", lat: 41.0082, lng: 28.9784, tz: "Europe/Istanbul" },
  { city: "Cairo", country: "Egypt", lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo" },
  { city: "Toronto", country: "Canada", lat: 43.6629, lng: -79.3957, tz: "America/Toronto" },
  { city: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney" },
];

export function useUserLocationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch settings
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["user-location", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_location_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      // Create default settings if none exist
      if (!data && user?.id) {
        const { data: created, error: createError } = await supabase
          .from("user_location_settings")
          .insert([
            {
              user_id: user.id,
              ...DEFAULT_LOCATION,
            },
          ])
          .select()
          .maybeSingle();

        if (createError) throw createError;
        return created;
      }

      return data;
    },
    enabled: !!user?.id,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<UserLocationSettings>) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_location_settings")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;
      return updates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-location", user?.id] });
      toast({ title: "Location saved", description: "Your location settings have been updated." });
    },
    onError: (error) => {
      toast({
        title: "Failed to save location",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const updateLocation = (
    city: string,
    country: string,
    latitude?: number,
    longitude?: number,
    timezone?: string,
  ) => {
    updateSettingsMutation.mutate({
      city,
      country,
      latitude: latitude || null,
      longitude: longitude || null,
      timezone,
    });
  };

  const updateTemperatureUnit = (unit: "celsius" | "fahrenheit") => {
    updateSettingsMutation.mutate({ temperature_unit: unit });
  };

  const updateWeatherVisibility = (show: boolean) => {
    updateSettingsMutation.mutate({ show_weather: show });
  };

  const updatePrayerCalculationMethod = (method: number) => {
    updateSettingsMutation.mutate({ prayer_calculation_method: method });
  };

  return {
    settings: settings as UserLocationSettings | null,
    isLoading,
    error,
    isSaving: updateSettingsMutation.isPending,
    updateLocation,
    updateTemperatureUnit,
    updateWeatherVisibility,
    updatePrayerCalculationMethod,
  };
}
