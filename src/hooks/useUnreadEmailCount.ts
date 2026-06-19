import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useUnreadEmailCount() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchCount = async () => {
      const { count, error } = await supabase
        .from("user_emails")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .eq("user_archived", false);

      if (!error && count !== null) {
        setUnreadCount(count);
      }
    };

    fetchCount();

    // Refresh every 2 minutes
    const interval = setInterval(fetchCount, 120000);
    return () => clearInterval(interval);
  }, [user]);

  return { unreadCount };
}
