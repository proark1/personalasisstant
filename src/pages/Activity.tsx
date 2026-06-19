import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Activity, ShieldCheck, Undo2, Zap, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

// Unified "Dori did stuff on your behalf" timeline. Merges three
// independent log tables (auto_actions_log / dori_undo_log /
// dori_proactive_log) into one chronological feed so the user has a
// single audit surface. Tap a row to see the underlying JSON.

type Row = {
  kind: "auto" | "undo" | "proactive";
  id: string;
  when: string;
  title: string;
  subtitle: string;
  status?: string;
  source?: string;
  meta?: Record<string, unknown>;
};

export default function ActivityPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      // Wrap the whole fan-out so a failing query (RLS, network) doesn't
      // leave the page stuck on the skeleton forever — we either render
      // the rows we got or an explicit error state.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const [autoRes, undoRes, proactiveRes] = await Promise.all([
          db
            .from("auto_actions_log")
            .select(
              "id, action_type, entity_type, reason, status, source, source_ref, created_at, approved_at, rejected_at, action_data",
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(80),
          db
            .from("dori_undo_log")
            .select(
              "id, op, entity_type, entity_id, label, consumed_at, created_at, source, source_ref",
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(80),
          db
            .from("dori_proactive_log")
            .select("id, trigger_type, trigger_key, channel, channel_ref, message, sent_at")
            .eq("user_id", user.id)
            .order("sent_at", { ascending: false })
            .limit(80),
        ]);
        if (!alive) return;
        const merged: Row[] = [
          ...(autoRes.data || []).map((r: Record<string, unknown>) => ({
            kind: "auto" as const,
            id: r.id as string,
            when: r.created_at as string,
            title: r.reason as string,
            subtitle: `${r.action_type}${r.entity_type ? ` · ${r.entity_type}` : ""}`,
            status: r.status as string | undefined,
            source: r.source as string | undefined,
            meta: r,
          })),
          ...(undoRes.data || []).map((r: Record<string, unknown>) => ({
            kind: "undo" as const,
            id: r.id as string,
            when: r.created_at as string,
            title: r.label as string,
            subtitle: `${r.op} · ${r.entity_type}${r.consumed_at ? " · reverted" : ""}`,
            source: r.source as string | undefined,
            meta: r,
          })),
          ...(proactiveRes.data || []).map((r: Record<string, unknown>) => ({
            kind: "proactive" as const,
            id: r.id as string,
            when: r.sent_at as string,
            title: (r.message || r.trigger_type) as string,
            subtitle: `${r.trigger_type} → ${r.channel || "in-app"}`,
            source: r.channel as string | undefined,
            meta: r,
          })),
        ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
        setRows(merged);
      } catch (e) {
        if (!alive) return;
        console.error("Activity load failed", e);
        setLoadError((e as Error)?.message || "Could not load activity");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const kindIcon = (k: Row["kind"]) =>
    k === "auto" ? (
      <ShieldCheck className="w-4 h-4" />
    ) : k === "undo" ? (
      <Undo2 className="w-4 h-4" />
    ) : (
      <Zap className="w-4 h-4" />
    );

  const kindLabel = (k: Row["kind"]) =>
    k === "auto" ? "Confirmed action" : k === "undo" ? "Undo window" : "Proactive nudge";

  const statusBadge = (row: Row) => {
    if (row.kind !== "auto") return null;
    const s = row.status || "pending";
    const v: "default" | "destructive" | "outline" | "secondary" =
      s === "approved" || s === "auto_applied"
        ? "default"
        : s === "rejected"
          ? "destructive"
          : s === "expired"
            ? "outline"
            : "secondary";
    return (
      <Badge variant={v} className="text-[10px] px-1.5">
        {s}
      </Badge>
    );
  };

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      // `undefined` defers to the browser's locale so the page matches
      // the user's preferred date format instead of hard-coding en-GB.
      const d = new Date(r.when).toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(r);
    }
    return Array.from(groups.entries());
  }, [rows]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Activity
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything Dori did on your behalf, plus every proactive nudge. Audit trail for your own
          peace of mind.
        </p>
      </div>

      {loading ? (
        <>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </>
      ) : loadError ? (
        <Card className="border-destructive/40">
          <CardContent className="py-6 text-center text-sm text-destructive">
            {loadError}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-60" />
            Nothing to show yet.
          </CardContent>
        </Card>
      ) : (
        groupedByDay.map(([day, items]) => (
          <Card key={day}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground font-normal">{day}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5">
              {items.map((row) => (
                <button
                  type="button"
                  key={`${row.kind}-${row.id}`}
                  onClick={() => setSelected(row)}
                  className="w-full flex items-start gap-3 px-2 py-2 rounded-md hover:bg-accent/60 text-left transition-colors"
                >
                  <div className="mt-0.5 text-muted-foreground">{kindIcon(row.kind)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm leading-tight">{row.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{kindLabel(row.kind)}</span>
                      <span>·</span>
                      <span className="truncate">{row.subtitle}</span>
                      {row.source && (
                        <>
                          <span>·</span>
                          <span>{row.source}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {statusBadge(row)}
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(row.when), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {selected && (
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Why did Dori do this?</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
            <CardDescription>{selected.title}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-80">
              {JSON.stringify(selected.meta, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
