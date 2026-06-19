import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Plane, Loader2 } from "lucide-react";
import { useTripOverview } from "@/hooks/useTripOverview";
import { TripCard } from "@/components/travel/TripCard";

export default function TravelPage() {
  const navigate = useNavigate();
  const {
    data,
    loading,
    busyTripId,
    refresh,
    refreshWeather,
    generatePacking,
    togglePackedItem,
    prepTrip,
  } = useTripOverview();

  const trips = data?.trips ?? [];
  // In-progress trips (started but not yet ended) belong with upcoming
  // so the user can still reach the active itinerary + packing list.
  const upcoming = trips.filter((t) => t.days_until_departure + t.trip_length_days >= 0);
  const past = trips.filter((t) => t.days_until_departure + t.trip_length_days < 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4 space-y-5">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={loading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
            Refresh
          </Button>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Plane className="w-6 h-6 text-primary" />
            Travel
          </h1>
          <p className="text-sm text-muted-foreground">
            Itinerary, weather forecast, and AI-generated packing list per trip.
          </p>
        </div>

        {loading && trips.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : trips.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Upcoming
                </h2>
                {upcoming.map((trip) => (
                  <TripCard
                    key={trip.trip_id}
                    trip={trip}
                    segments={data?.segments[trip.trip_id] ?? []}
                    bookings={data?.bookings[trip.trip_id] ?? []}
                    packingLists={data?.packing_lists[trip.trip_id] ?? []}
                    busy={busyTripId === trip.trip_id}
                    onRefreshWeather={() => refreshWeather(trip)}
                    onGeneratePacking={(opts) => generatePacking(trip.trip_id, opts)}
                    onTogglePackedItem={togglePackedItem}
                    onPrepTrip={() => prepTrip(trip.trip_id)}
                  />
                ))}
              </section>
            )}

            {past.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Past
                </h2>
                {past.map((trip) => (
                  <TripCard
                    key={trip.trip_id}
                    trip={trip}
                    segments={data?.segments[trip.trip_id] ?? []}
                    bookings={data?.bookings[trip.trip_id] ?? []}
                    packingLists={data?.packing_lists[trip.trip_id] ?? []}
                    busy={busyTripId === trip.trip_id}
                    onRefreshWeather={() => refreshWeather(trip)}
                    onGeneratePacking={(opts) => generatePacking(trip.trip_id, opts)}
                    onTogglePackedItem={togglePackedItem}
                    onPrepTrip={() => prepTrip(trip.trip_id)}
                    pastTrip
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 text-muted-foreground">
      <Plane className="w-12 h-12 mx-auto opacity-40 mb-3" />
      <p className="font-medium text-sm">No trips yet</p>
      <p className="text-xs mt-1 max-w-sm mx-auto">
        Add a trip from the Travel panel or ask the assistant to plan one. Trips you book on your
        calendar are also auto-detected.
      </p>
    </div>
  );
}
