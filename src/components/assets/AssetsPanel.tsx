import { useState } from "react";
import { Home, Plus, Trash2 } from "lucide-react";
import { PanelShell } from "@/components/ui/panel-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useUserProperties } from "@/hooks/useUserProperties";

export function AssetsPanel() {
  const {
    properties,
    vehicles,
    maintenance,
    inventory,
    isLoading,
    addProperty,
    addVehicle,
    addMaintenance,
    addInventory,
    remove,
  } = useUserProperties();
  const [pName, setPName] = useState("");
  const [vName, setVName] = useState("");
  const [mTitle, setMTitle] = useState("");
  const [iName, setIName] = useState("");

  return (
    <PanelShell
      icon={Home}
      title="Properties & Vehicles"
      subtitle={`${properties.length} properties · ${vehicles.length} vehicles`}
      loading={isLoading}
    >
      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Property name"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
            />
            <Button
              onClick={() => {
                if (pName) {
                  addProperty({ name: pName });
                  setPName("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {properties.map((p) => (
            <Card key={p.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.address || "—"} · {p.city || ""}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("user_properties", p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Vehicle name (e.g. My BMW)"
              value={vName}
              onChange={(e) => setVName(e.target.value)}
            />
            <Button
              onClick={() => {
                if (vName) {
                  addVehicle({ name: vName });
                  setVName("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {vehicles.map((v) => (
            <Card key={v.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{v.name}</p>
                <p className="text-xs text-muted-foreground">
                  {v.make || ""} {v.model || ""} {v.year || ""} · {v.license_plate || ""}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("vehicles", v.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Maintenance title (e.g. Oil change)"
              value={mTitle}
              onChange={(e) => setMTitle(e.target.value)}
            />
            <Button
              onClick={() => {
                if (mTitle) {
                  addMaintenance({ title: mTitle });
                  setMTitle("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {maintenance.map((m) => (
            <Card key={m.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  {m.performed_on} · next: {m.next_due_date || "—"}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("maintenance_log", m.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="inventory" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Item name"
              value={iName}
              onChange={(e) => setIName(e.target.value)}
            />
            <Button
              onClick={() => {
                if (iName) {
                  addInventory({ name: iName });
                  setIName("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {inventory.map((i) => (
            <Card key={i.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{i.name}</p>
                <p className="text-xs text-muted-foreground">
                  {i.category || "—"} · warranty: {i.warranty_until || "—"}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("inventory_items", i.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}
