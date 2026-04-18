import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Sunrise } from "lucide-react";
import { format } from "date-fns";

interface ThreadItem {
  id: string;
  item_type: string;
  rank: number;
  title: string;
  body: string | null;
}

export function MorningThreadCard() {
  const { user } = useAuth();
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const today = format(new Date(), "yyyy-MM-dd");
    supabase
      .from("morning_thread_items")
      .select("id, item_type, rank, title, body")
      .eq("user_id", user.id)
      .eq("thread_date", today)
      .eq("is_dismissed", false)
      .order("rank")
      .then(({ data }) => {
        setItems((data || []) as ThreadItem[]);
        setLoading(false);
      });
  }, [user?.id]);

  if (loading || items.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sunrise className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Morning thread</h3>
      </div>
      <div className="space-y-2.5">
        {items.map((i) => (
          <div key={i.id} className="p-2.5 rounded-md bg-muted/40">
            <p className="text-sm font-medium">{i.title}</p>
            {i.body && <p className="text-xs text-muted-foreground whitespace-pre-line mt-1">{i.body}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
