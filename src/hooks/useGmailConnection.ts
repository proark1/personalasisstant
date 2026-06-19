import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export function useGmailConnection() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkConnection = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("external_calendar_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("provider", "google")
        .limit(1);

      setIsConnected((data?.length || 0) > 0);
    } catch (e) {
      console.error("Check gmail connection error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connectGmail = useCallback(async () => {
    if (!user) return;
    try {
      // Use the calendar OAuth flow but it will redirect to Google
      // The existing calendar-oauth-start function handles Google OAuth
      const { data, error } = await supabase.functions.invoke("calendar-oauth-start", {
        body: { provider: "google" },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error("Gmail connect error:", e);
      toast.error(await describeEdgeError(e, "Failed to start Google connection"));
    }
  }, [user]);

  return {
    isConnected,
    loading,
    connectGmail,
    recheckConnection: checkConnection,
  };
}
