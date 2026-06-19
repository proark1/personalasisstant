import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Commentary {
  id: string;
  headline: string;
  commentary: string;
  current_score: number;
  previous_score: number;
  trend: string;
  delta: number;
  observation_date: string;
}

export function LifeScoreCommentaryCard() {
  const { user } = useAuth();
  const [item, setItem] = useState<Commentary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("life_score_commentary")
      .select(
        "id, headline, commentary, current_score, previous_score, trend, delta, observation_date",
      )
      .eq("user_id", user.id)
      .order("observation_date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setItem(data as Commentary | null);
        setLoading(false);
      });
  }, [user?.id]);

  if (loading || !item) return null;

  const Icon = item.trend === "up" ? TrendingUp : item.trend === "down" ? TrendingDown : Minus;
  const tone =
    item.trend === "up"
      ? "text-green-600"
      : item.trend === "down"
        ? "text-amber-600"
        : "text-muted-foreground";

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${tone}`} />
        <h3 className="text-sm font-semibold flex-1">{item.headline}</h3>
        <span className={`text-xs font-mono ${tone}`}>
          {item.previous_score} → {item.current_score}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{item.commentary}</p>
    </Card>
  );
}
