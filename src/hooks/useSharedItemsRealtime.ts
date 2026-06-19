import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseSharedItemsRealtimeProps {
  userId: string | undefined;
  onNewShare?: () => void;
}

export function useSharedItemsRealtime({ userId, onNewShare }: UseSharedItemsRealtimeProps) {
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    // The INSERT handler awaits two queries before toasting / calling
    // onNewShare; guard against the channel being torn down (unmount or
    // userId change) mid-flight so we don't toast or call back afterwards.
    let active = true;

    const channel = supabase
      .channel("shared-items-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "shared_items",
          filter: `shared_with_id=eq.${userId}`,
        },
        async (payload) => {
          const newShare = payload.new as {
            item_type: string;
            item_id: string;
            owner_id: string;
            permission: string;
          };

          // Fetch owner's profile to show who shared
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("display_name, email")
            .eq("user_id", newShare.owner_id)
            .single();

          // Fetch item title
          let itemTitle = "item";
          if (newShare.item_type === "task") {
            const { data: task } = await supabase
              .from("tasks")
              .select("title")
              .eq("id", newShare.item_id)
              .single();
            if (task) itemTitle = task.title;
          } else if (newShare.item_type === "event") {
            const { data: event } = await supabase
              .from("events")
              .select("title")
              .eq("id", newShare.item_id)
              .single();
            if (event) itemTitle = event.title;
          }

          const ownerName = ownerProfile?.display_name || ownerProfile?.email || "Someone";

          if (!active) return;

          toast({
            title: `New ${newShare.item_type} shared with you`,
            description: `${ownerName} shared "${itemTitle}" with ${newShare.permission} access`,
          });

          onNewShare?.();
        },
      )
      .subscribe();

    return () => {
      active = false;
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId, toast, onNewShare]);
}
