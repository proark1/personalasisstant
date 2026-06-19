import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Scale } from "lucide-react";

interface Breakdown {
  user_id: string;
  display_name?: string;
  total: number;
}

export function MentalLoadCard() {
  const { user } = useAuth();
  const [breakdown, setBreakdown] = useState<Breakdown[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: membership } = await supabase
        .from("family_agent_members")
        .select("group_id")
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle();
      if (!membership) {
        setLoading(false);
        return;
      }
      setGroupId(membership.group_id);

      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data: rows } = await supabase
        .from("mental_load_log")
        .select("handled_by, weight")
        .eq("group_id", membership.group_id)
        .gte("occurred_at", since);

      const totals = new Map<string, number>();
      for (const r of rows || [])
        totals.set(r.handled_by, (totals.get(r.handled_by) || 0) + (r.weight || 1));

      const userIds = Array.from(totals.keys());
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const nameMap = new Map((profiles || []).map((p) => [p.user_id, p.display_name]));

      setBreakdown(
        Array.from(totals.entries())
          .map(([uid, total]) => ({
            user_id: uid,
            total,
            display_name: nameMap.get(uid) || "Member",
          }))
          .sort((a, b) => b.total - a.total),
      );
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading || !groupId || breakdown.length === 0) return null;

  const max = breakdown[0].total || 1;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Scale className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Mental load (30d)</h3>
      </div>
      <div className="space-y-2">
        {breakdown.map((b) => (
          <div key={b.user_id} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>{b.display_name}</span>
              <span className="font-mono text-muted-foreground">{b.total}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(b.total / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
