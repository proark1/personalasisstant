import { useState } from "react";
import { Heart, Plus, Trash2 } from "lucide-react";
import { PanelShell } from "@/components/ui/panel-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useRelationshipsPlus } from "@/hooks/useRelationshipsPlus";

export function RelationshipsPlusPanel() {
  const { specialDates, gifts, circles, isLoading, addSpecialDate, addGift, addCircle, remove } =
    useRelationshipsPlus();
  const [dType, setDType] = useState("birthday");
  const [dDate, setDDate] = useState("");
  const [giftDesc, setGiftDesc] = useState("");
  const [circleName, setCircleName] = useState("");

  return (
    <PanelShell
      icon={Heart}
      title="Relationships+"
      subtitle={`${specialDates.length} dates · ${gifts.length} gifts · ${circles.length} circles`}
      loading={isLoading}
    >
      <Tabs defaultValue="dates" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="dates">Special Dates</TabsTrigger>
          <TabsTrigger value="gifts">Gift Log</TabsTrigger>
          <TabsTrigger value="circles">Circles</TabsTrigger>
        </TabsList>

        <TabsContent value="dates" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <select
              className="border rounded px-2 bg-background"
              value={dType}
              onChange={(e) => setDType(e.target.value)}
            >
              <option value="birthday">Birthday</option>
              <option value="anniversary">Anniversary</option>
              <option value="other">Other</option>
            </select>
            <Input type="date" value={dDate} onChange={(e) => setDDate(e.target.value)} />
            <Button
              onClick={() => {
                if (dDate) {
                  addSpecialDate({ date_type: dType, occurs_on: dDate });
                  setDDate("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {specialDates.map((d) => (
            <Card key={d.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium capitalize">{d.date_type}</p>
                <p className="text-xs text-muted-foreground">
                  {d.occurs_on} · reminder {d.reminder_days_before ?? 7}d before
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove("contact_special_dates", d.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="gifts" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Gift description"
              value={giftDesc}
              onChange={(e) => setGiftDesc(e.target.value)}
            />
            <Button
              onClick={() => {
                if (giftDesc) {
                  addGift({ gift_description: giftDesc });
                  setGiftDesc("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {gifts.map((g) => (
            <Card key={g.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{g.gift_description}</p>
                <p className="text-xs text-muted-foreground">
                  {g.given_on} · {g.occasion || "—"} · {g.cost ? `${g.cost}` : ""}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("gift_log", g.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="circles" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Circle name (e.g. School Parents)"
              value={circleName}
              onChange={(e) => setCircleName(e.target.value)}
            />
            <Button
              onClick={() => {
                if (circleName) {
                  addCircle({ name: circleName });
                  setCircleName("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {circles.map((c) => (
            <Card key={c.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.description || "—"}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("friend_circles", c.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}
