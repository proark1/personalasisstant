import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Car, Users, Package, Plus, AlertCircle } from "lucide-react";
import { useFamilySchool } from "@/hooks/useFamilySchool";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { AddSchoolEventDialog } from "./AddSchoolEventDialog";
import { AddPickupRotaDialog } from "./AddPickupRotaDialog";
import { AddEquipmentDialog } from "./AddEquipmentDialog";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function FamilySchoolLogisticsCard() {
  const {
    upcomingSchoolEvents,
    todaysRota,
    rota,
    classmates,
    equipmentNeedingReplacement,
    isLoading,
  } = useFamilySchool();
  const { members } = useFamilyMembers();
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [rotaOpen, setRotaOpen] = useState(false);
  const [eqOpen, setEqOpen] = useState(false);

  const memberName = (id: string | null) =>
    id ? members.find((m) => m.id === id)?.name || "—" : "All";

  const daysUntil = (date: string) =>
    Math.floor((new Date(date).getTime() - Date.now()) / 86400000);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-5 w-5 text-primary" />
            School & Activities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {/* School calendar */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4" /> School Events (
                    {upcomingSchoolEvents.length})
                  </h4>
                  <Button size="sm" variant="ghost" onClick={() => setSchoolOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {upcomingSchoolEvents.slice(0, 3).map((e) => {
                  const d = daysUntil(e.start_date);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between text-sm rounded-md bg-muted/50 px-2 py-1.5"
                    >
                      <div className="truncate">
                        <span className="font-medium">{e.title}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">
                          {memberName(e.family_member_id)} · {e.event_type}
                        </span>
                      </div>
                      <Badge variant={d <= 3 ? "destructive" : d <= 7 ? "default" : "secondary"}>
                        {d === 0 ? "Today" : d === 1 ? "Tomorrow" : `${d}d`}
                      </Badge>
                    </div>
                  );
                })}
                {upcomingSchoolEvents.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No upcoming school events. Add term dates, exams, parent-teacher meetings.
                  </p>
                )}
              </section>

              {/* Pickup Rota */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Car className="h-4 w-4" /> Today's Rota ({todaysRota.length})
                  </h4>
                  <Button size="sm" variant="ghost" onClick={() => setRotaOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {todaysRota.length > 0 ? (
                  todaysRota.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between text-sm rounded-md bg-muted/50 px-2 py-1.5"
                    >
                      <div className="truncate">
                        <span className="font-medium">{memberName(r.family_member_id)}</span>
                        {r.location && (
                          <span className="text-xs text-muted-foreground ml-1.5">
                            · {r.location}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-right">
                        {r.pickup_time && <div>↑ {r.pickup_time.slice(0, 5)}</div>}
                        {r.dropoff_time && <div>↓ {r.dropoff_time.slice(0, 5)}</div>}
                        {r.responsible_person && (
                          <div className="text-muted-foreground">{r.responsible_person}</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : rota.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing scheduled for {DAYS[new Date().getDay()]}.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No rota set up. Add weekly pickup/dropoff schedule.
                  </p>
                )}
              </section>

              {/* Equipment */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Package className="h-4 w-4" /> Equipment
                    {equipmentNeedingReplacement.length > 0 && (
                      <Badge variant="destructive" className="ml-1">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {equipmentNeedingReplacement.length}
                      </Badge>
                    )}
                  </h4>
                  <Button size="sm" variant="ghost" onClick={() => setEqOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {equipmentNeedingReplacement.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between text-sm rounded-md bg-destructive/10 px-2 py-1.5"
                  >
                    <div className="truncate">
                      <span className="font-medium">{e.item_name}</span>
                      {e.size && (
                        <span className="text-xs text-muted-foreground ml-1.5">size {e.size}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {memberName(e.family_member_id)}
                    </span>
                  </div>
                ))}
                {equipmentNeedingReplacement.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No replacement needed. Track gear sizes for outgrown alerts.
                  </p>
                )}
              </section>

              {/* Classmates */}
              {classmates.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> Classmates ({classmates.length})
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {classmates
                      .slice(0, 4)
                      .map((c) => c.child_name)
                      .join(" · ")}
                  </p>
                </section>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <AddSchoolEventDialog open={schoolOpen} onOpenChange={setSchoolOpen} />
      <AddPickupRotaDialog open={rotaOpen} onOpenChange={setRotaOpen} />
      <AddEquipmentDialog open={eqOpen} onOpenChange={setEqOpen} />
    </>
  );
}
