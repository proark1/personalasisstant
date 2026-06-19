import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, X, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Conflict {
  id: string;
  conflict_type: string;
  severity: string;
  title: string;
  description: string;
  suggested_resolution: string | null;
}

export function ConflictAlertsCard() {
  const { user } = useAuth();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from("detected_conflicts")
        .select("id, conflict_type, severity, title, description, suggested_resolution")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("detected_at", { ascending: false })
        .limit(5);
      setConflicts((data ?? []) as Conflict[]);
    };
    load();
  }, [user?.id]);

  const dismiss = async (id: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("detected_conflicts")
      .update({ status: "dismissed" })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Could not dismiss");
      return;
    }
    setConflicts((prev) => prev.filter((c) => c.id !== id));
  };
  const ack = async (id: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("detected_conflicts")
      .update({ status: "acknowledged", resolved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Could not update");
      return;
    }
    setConflicts((prev) => prev.filter((c) => c.id !== id));
    toast.success("Marked as handled");
  };

  if (!conflicts.length) return null;

  return (
    <Card className="p-4 border-l-4 border-l-destructive">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h3 className="font-semibold text-sm">Schedule conflicts ({conflicts.length})</h3>
      </div>
      <div className="space-y-2">
        {conflicts.map((c) => (
          <div key={c.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/40">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge
                  variant={c.severity === "high" ? "destructive" : "secondary"}
                  className="text-[10px]"
                >
                  {c.conflict_type.replace("_", " ")}
                </Badge>
                <p className="text-xs font-medium truncate">{c.title}</p>
              </div>
              {c.suggested_resolution && (
                <p className="text-[11px] text-muted-foreground mt-1">{c.suggested_resolution}</p>
              )}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => ack(c.id)}>
                <Check className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => dismiss(c.id)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
