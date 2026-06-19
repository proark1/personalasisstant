import { useState } from "react";
import { Plane, Plus, Trash2 } from "lucide-react";
import { PanelShell } from "@/components/ui/panel-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useTravel } from "@/hooks/useTravel";

export function TravelPanel() {
  const {
    trips,
    bookings,
    loyalty,
    essentials,
    isLoading,
    addTrip,
    addBooking,
    addLoyalty,
    addEssential,
    remove,
  } = useTravel();
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [bType, setBType] = useState("flight");
  const [bProvider, setBProvider] = useState("");
  const [bConf, setBConf] = useState("");
  const [progName, setProgName] = useState("");
  const [country, setCountry] = useState("");
  const [plug, setPlug] = useState("");

  return (
    <PanelShell
      icon={Plane}
      title="Travel"
      subtitle={`${trips.length} trips · ${loyalty.length} loyalty programs`}
      loading={isLoading}
    >
      <Tabs defaultValue="trips" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
          <TabsTrigger value="countries">Countries</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Trip title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              placeholder="Destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (title && destination && start && end) {
                addTrip({ title, destination, start_date: start, end_date: end });
                setTitle("");
                setDestination("");
                setStart("");
                setEnd("");
              }
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add trip
          </Button>
          {trips.map((t) => (
            <Card key={t.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">
                  {t.title} → {t.destination}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.start_date} → {t.end_date}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("trips", t.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="bookings" className="space-y-3 mt-4">
          <div className="grid grid-cols-3 gap-2">
            <select
              className="border rounded px-2 bg-background"
              value={bType}
              onChange={(e) => setBType(e.target.value)}
            >
              <option value="flight">Flight</option>
              <option value="hotel">Hotel</option>
              <option value="car">Car</option>
              <option value="train">Train</option>
            </select>
            <Input
              placeholder="Provider"
              value={bProvider}
              onChange={(e) => setBProvider(e.target.value)}
            />
            <Input
              placeholder="Confirmation #"
              value={bConf}
              onChange={(e) => setBConf(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (bProvider) {
                addBooking({
                  booking_type: bType,
                  provider: bProvider,
                  confirmation_number: bConf,
                });
                setBProvider("");
                setBConf("");
              }
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add booking
          </Button>
          {bookings.map((b) => (
            <Card key={b.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">
                  {b.booking_type.toUpperCase()} · {b.provider}
                </p>
                <p className="text-xs text-muted-foreground">{b.confirmation_number || "—"}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("trip_bookings", b.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="loyalty" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Program name (e.g. Miles & More)"
              value={progName}
              onChange={(e) => setProgName(e.target.value)}
            />
            <Button
              onClick={() => {
                if (progName) {
                  addLoyalty({ program_name: progName });
                  setProgName("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {loyalty.map((l) => (
            <Card key={l.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{l.program_name}</p>
                <p className="text-xs text-muted-foreground">
                  {l.tier || "—"} · {l.points_balance ?? 0} pts
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("loyalty_programs", l.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="countries" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
            <Input
              placeholder="Plug type"
              value={plug}
              onChange={(e) => setPlug(e.target.value)}
              className="w-32"
            />
            <Button
              onClick={() => {
                if (country) {
                  addEssential({ country, plug_type: plug });
                  setCountry("");
                  setPlug("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {essentials.map((e) => (
            <Card key={e.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{e.country}</p>
                <p className="text-xs text-muted-foreground">
                  Plug: {e.plug_type || "—"} · Currency: {e.currency || "—"} · Emergency:{" "}
                  {e.emergency_number || "—"}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove("country_essentials", e.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}
