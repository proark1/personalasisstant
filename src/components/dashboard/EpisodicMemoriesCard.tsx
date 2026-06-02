import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { BookOpen, MapPin, Users } from "lucide-react";
import { format } from "date-fns";

interface Memory {
  id: string;
  title: string;
  summary: string | null;
  occurred_on: string;
  location: string | null;
  people: Array<{ name: string; contact_id: string }> | null;
  tags: string[];
}

export function EpisodicMemoriesCard() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("episodic_memories")
      .select("id, title, summary, occurred_on, location, people, tags")
      .eq("user_id", user.id)
      .order("occurred_on", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setMemories((data || []) as Memory[]);
        setLoading(false);
      });
  }, [user?.id]);

  if (loading || memories.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Recent memories</h3>
      </div>
      <div className="space-y-2">
        {memories.map((m) => {
          const people = Array.isArray(m.people) ? m.people : [];
          const peopleCount = people.length;
          const peopleNames = people.map((p) => p.name).filter(Boolean).join(", ");
          return (
            <div key={m.id} className="p-2 rounded-md bg-muted/40 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{m.title}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(new Date(m.occurred_on), "MMM d, yyyy")}
                </span>
              </div>
              {m.summary && <p className="text-xs text-muted-foreground line-clamp-2">{m.summary}</p>}
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                {m.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {m.location}
                  </span>
                )}
                {peopleCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {peopleNames || peopleCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
