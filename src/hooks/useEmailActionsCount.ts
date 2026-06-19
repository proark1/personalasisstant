import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useEmailActionsCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = async () => {
    if (!user?.id) return;
    const { count: c } = await supabase
      .from("email_classifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending")
      .neq("suggested_action", "none");
    setCount(c ?? 0);
  };

  useEffect(() => {
    refresh();
    if (!user?.id) return;
    const channel = supabase
      .channel("email-actions-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "email_classifications",
          filter: `user_id=eq.${user.id}`,
        },
        refresh,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // intentionally excludes refresh — it's a plain function redefined each render; listing it would loop

  return count;
}
