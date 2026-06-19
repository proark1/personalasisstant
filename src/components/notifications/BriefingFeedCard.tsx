import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBriefingDeliveries } from "@/hooks/useBriefingDeliveries";
import { formatDistanceToNow } from "date-fns";

interface BriefingFeedCardProps {
  /** How many recent briefings to show. */
  limit?: number;
  /** Hide the card entirely when there are no deliveries yet. */
  hideWhenEmpty?: boolean;
}

/**
 * In-app feed of recently delivered briefings, read from `briefing_deliveries`.
 * Lets users read their briefings inside the app regardless of which channel
 * (Telegram / push) delivered them.
 */
export function BriefingFeedCard({ limit = 5, hideWhenEmpty = false }: BriefingFeedCardProps) {
  const { deliveries, loading, refetch } = useBriefingDeliveries(limit);

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (deliveries.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          <Newspaper className="h-6 w-6 mx-auto mb-2" />
          No briefings delivered yet. They'll appear here once your first one is sent.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            Recent briefings
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {deliveries.map((d) => (
          <div key={d.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{d.briefing_name || "Briefing"}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(d.generated_at), { addSuffix: true })}
              </span>
            </div>
            {d.content.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notable updates in this briefing.</p>
            ) : (
              <ul className="space-y-2">
                {d.content.map((item, i) => (
                  <li key={i} className="text-sm">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline inline-flex items-start gap-1"
                    >
                      {item.headline}
                      <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                    </a>
                    {item.summary && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.summary}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {d.channels_sent.length > 0 && (
              <div className="flex gap-1">
                {d.channels_sent.map((c) => (
                  <Badge key={c} variant="outline" className="text-[10px] capitalize">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
