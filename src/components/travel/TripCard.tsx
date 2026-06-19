import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Cloud,
  MapPin,
  Plane,
  Building2,
  Train,
  Bus,
  Car,
  Ship,
  Sparkles,
  Loader2,
  ChevronRight,
  CheckCircle2,
  Circle,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { TripOverviewRow, TripSegment, TripBookingRow, PackingList } from "@/hooks/useTripOverview";
import { cn } from "@/lib/utils";

interface TripCardProps {
  trip: TripOverviewRow;
  segments: TripSegment[];
  bookings: TripBookingRow[];
  packingLists: PackingList[];
  busy: boolean;
  onRefreshWeather: () => void;
  onGeneratePacking: (opts?: { replace?: boolean; extraContext?: string }) => void;
  onTogglePackedItem: (list: PackingList, idx: number) => void;
  onPrepTrip?: () => void;
  pastTrip?: boolean;
}

export function TripCard({
  trip,
  segments,
  bookings,
  packingLists,
  busy,
  onRefreshWeather,
  onGeneratePacking,
  onTogglePackedItem,
  onPrepTrip,
  pastTrip,
}: TripCardProps) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const aiList = packingLists.find((p) => p.source === "ai_generated");

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold">{trip.title}</h3>
            <DepartureBadge daysUntil={trip.days_until_departure} pastTrip={pastTrip} />
            {trip.purpose && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {trip.purpose}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            {trip.destination}
            {trip.destination_country && <span>· {trip.destination_country}</span>}
            <span className="mx-1">·</span>
            <Calendar className="w-3 h-3" />
            {trip.start_date} → {trip.end_date} ({trip.trip_length_days + 1} day
            {trip.trip_length_days === 0 ? "" : "s"})
          </p>
        </div>
      </div>

      {/* Weather strip */}
      <div className="rounded-md border border-dashed border-border/70 bg-muted/30 px-2.5 py-1.5 flex items-center gap-2">
        <Cloud className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs text-muted-foreground flex-1 truncate">
          {trip.weather_summary
            ? trip.weather_summary
            : trip.destination_lat == null
              ? "No coordinates set — add lat/lon to fetch weather."
              : "Weather not loaded yet."}
        </span>
        {trip.destination_lat != null && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] gap-1"
            onClick={onRefreshWeather}
            disabled={busy || pastTrip}
          >
            {busy ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Refresh
          </Button>
        )}
      </div>

      {/* Segments preview */}
      {segments.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Itinerary · {segments.length} step{segments.length === 1 ? "" : "s"}
          </p>
          <div className="space-y-1">
            {segments.slice(0, 4).map((s) => (
              <SegmentRow key={s.id} segment={s} />
            ))}
            {segments.length > 4 && (
              <p className="text-[10px] text-muted-foreground italic">
                +{segments.length - 4} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Packing */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Packing · {trip.packing_packed_items}/{trip.packing_total_items}
            {trip.packing_pct != null && <span className="ml-1">({trip.packing_pct}%)</span>}
          </p>
          <div className="flex items-center gap-1">
            {!pastTrip && onPrepTrip && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] gap-1"
                onClick={onPrepTrip}
                disabled={busy}
                title="Auto-create the 'Pack for X' task and (when imminent) generate the packing list"
              >
                {busy ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Auto-prep
              </Button>
            )}
            {!pastTrip && (
              <Button
                size="sm"
                variant={aiList ? "ghost" : "default"}
                className="h-6 text-[10px] gap-1"
                onClick={() => onGeneratePacking({ replace: !!aiList })}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {aiList ? "Regenerate list" : "Generate list"}
              </Button>
            )}
          </div>
        </div>
        {trip.packing_total_items > 0 && (
          <div className="h-1 w-full rounded bg-muted/40 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${trip.packing_pct ?? 0}%` }}
            />
          </div>
        )}
      </div>

      {/* Expand: full packing list */}
      {packingLists.length > 0 && (
        <Collapsible open={stepsOpen} onOpenChange={setStepsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-full text-[10px] text-muted-foreground gap-1"
            >
              {stepsOpen ? "Hide" : "Show"} packing details
              <ChevronRight
                className={cn("w-3 h-3 transition-transform", stepsOpen && "rotate-90")}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-1">
            {packingLists.map((list) => (
              <PackingListView
                key={list.id}
                list={list}
                onToggle={(idx) => onTogglePackedItem(list, idx)}
                disabled={busy || pastTrip}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Bookings hint */}
      {bookings.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"} on file
          {bookings.some((b) => b.confirmation_number) && " · confirmation numbers ready"}
        </p>
      )}
    </Card>
  );
}

function DepartureBadge({ daysUntil, pastTrip }: { daysUntil: number; pastTrip?: boolean }) {
  if (pastTrip) {
    return (
      <Badge variant="outline" className="text-[10px]">
        past
      </Badge>
    );
  }
  if (daysUntil === 0) {
    return <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600">today</Badge>;
  }
  if (daysUntil < 0) {
    return (
      <Badge variant="outline" className="text-[10px]">
        in progress
      </Badge>
    );
  }
  if (daysUntil === 1) {
    return <Badge className="text-[10px] bg-amber-500/15 text-amber-600">tomorrow</Badge>;
  }
  if (daysUntil <= 7) {
    return <Badge className="text-[10px] bg-amber-500/15 text-amber-600">in {daysUntil}d</Badge>;
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      in {daysUntil}d
    </Badge>
  );
}

const SEGMENT_ICONS: Record<string, typeof Plane> = {
  flight: Plane,
  train: Train,
  bus: Bus,
  car: Car,
  ferry: Ship,
  hotel: Building2,
  activity: Sparkles,
  free: Sparkles,
};

function SegmentRow({ segment }: { segment: TripSegment }) {
  const Icon = SEGMENT_ICONS[segment.segment_type] || Plane;
  // Render in the segment's local timezone when set ("flight lands at
  // 14:30" means the destination's clock, not the traveller's home clock).
  // Falls back to the browser's local zone otherwise.
  const time = segment.start_time
    ? new Date(segment.start_time).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: segment.timezone || undefined,
      })
    : null;
  return (
    <div className="flex items-start gap-2 rounded px-2 py-1.5 bg-background/50 text-xs">
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{segment.title}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {segment.origin && segment.destination && segment.origin !== segment.destination && (
            <span>
              {segment.origin} → {segment.destination}
            </span>
          )}
          {time && <span>{time}</span>}
          {segment.reference && <span>· {segment.reference}</span>}
        </div>
      </div>
    </div>
  );
}

function PackingListView({
  list,
  onToggle,
  disabled,
}: {
  list: PackingList;
  onToggle: (idx: number) => void;
  disabled?: boolean;
}) {
  // Group items by category for cleaner rendering.
  const groups: Record<string, Array<{ idx: number; item: PackingList["items"][0] }>> = {};
  (list.items ?? []).forEach((item, idx) => {
    const cat = item.category || "other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ idx, item });
  });
  const orderedCats = Object.keys(groups).sort();

  return (
    <div className="rounded-md border border-border/60 p-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">{list.name}</p>
        {list.source === "ai_generated" && (
          <Badge variant="outline" className="text-[9px] gap-1">
            <Sparkles className="w-2.5 h-2.5" /> AI
          </Badge>
        )}
      </div>
      {orderedCats.map((cat) => (
        <div key={cat}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground capitalize mb-0.5">
            {cat}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2">
            {groups[cat].map(({ idx, item }) => (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(idx)}
                className={cn(
                  "flex items-center gap-1.5 px-1 py-0.5 text-xs text-left rounded hover:bg-muted/40 transition-colors",
                  item.packed && "text-muted-foreground line-through",
                  disabled && "opacity-60 cursor-not-allowed",
                )}
              >
                {item.packed ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
                <span className="truncate">
                  {item.name}
                  {item.qty && item.qty > 1 ? (
                    <span className="text-muted-foreground"> ×{item.qty}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
