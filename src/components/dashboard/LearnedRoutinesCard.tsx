import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X } from "lucide-react";

interface Routine {
  id: string;
  title: string;
  description: string;
  confidence: number;
  occurrences: number;
  status: string;
}

export function LearnedRoutinesCard() {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("learned_routines")
      .select("id, title, description, confidence, occurrences, status")
      .eq("user_id", user.id)
      .eq("status", "suggested")
      .order("confidence", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setRoutines((data || []) as Routine[]);
        setLoading(false);
      });
  }, [user?.id]);

  const respond = async (id: string, status: "accepted" | "dismissed") => {
    await supabase
      .from("learned_routines")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", id);
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading || routines.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Routines Dori spotted</h3>
      </div>
      <div className="space-y-2">
        {routines.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-2 p-2 rounded-md bg-muted/40">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Seen {r.occurrences}× · {Math.round(r.confidence * 100)}% confidence
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => respond(r.id, "accepted")}>
                <Check className="w-3.5 h-3.5 text-success" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => respond(r.id, "dismissed")}>
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
