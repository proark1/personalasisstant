import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Sparkles, PawPrint, Wrench, Car } from 'lucide-react';
import { useFamilyMemoryHome } from '@/hooks/useFamilyMemoryHome';
import { AddTraditionDialog } from './AddTraditionDialog';
import { AddPetDialog } from './AddPetDialog';
import { AddMaintenanceDialog } from './AddMaintenanceDialog';
import { AddVehicleDialog } from './AddVehicleDialog';
import { format, parseISO, differenceInDays } from 'date-fns';

const dueLabel = (dateStr: string | null) => {
  if (!dateStr) return null;
  const d = differenceInDays(parseISO(dateStr), new Date());
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, variant: 'destructive' as const };
  if (d <= 14) return { text: `in ${d}d`, variant: 'default' as const };
  return { text: format(parseISO(dateStr), 'MMM d'), variant: 'secondary' as const };
};

export function FamilyMemoryHomeCard() {
  const { traditions, pets, maintenance, vehicles, loading } = useFamilyMemoryHome();
  const [tradOpen, setTradOpen] = useState(false);
  const [petOpen, setPetOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [vehOpen, setVehOpen] = useState(false);

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Traditions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Family traditions
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setTradOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {traditions.length === 0 && <p className="text-sm text-muted-foreground">Capture rituals like Friday pizza or annual anniversaries.</p>}
          {traditions.map(t => {
            const d = dueLabel(t.next_occurrence);
            return (
              <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">{t.cadence}</div>
                </div>
                {d && <Badge variant={d.variant} className="text-[10px]">{d.text}</Badge>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Pets */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PawPrint className="h-4 w-4 text-accent-foreground" /> Pets
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setPetOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {pets.length === 0 && <p className="text-sm text-muted-foreground">No pets yet.</p>}
          {pets.map(p => {
            const vacc = dueLabel(p.next_vaccination_date);
            const checkup = dueLabel(p.next_vet_checkup);
            return (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{[p.species, p.breed].filter(Boolean).join(' • ')}</div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {vacc && <Badge variant={vacc.variant}>💉 {vacc.text}</Badge>}
                  {checkup && <Badge variant={checkup.variant}>🏥 {checkup.text}</Badge>}
                  {p.vet_name && <span className="text-muted-foreground">Vet: {p.vet_name}</span>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Household Maintenance */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-warning" /> Household maintenance
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setMaintOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {maintenance.length === 0 && <p className="text-sm text-muted-foreground">Track boiler, smoke alarms, filter changes…</p>}
          {maintenance.map(m => {
            const d = dueLabel(m.next_due_date);
            return (
              <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{m.task_name}</div>
                  <div className="text-xs text-muted-foreground">{m.category} {m.provider_name && `• ${m.provider_name}`}</div>
                </div>
                {d && <Badge variant={d.variant} className="text-[10px]">{d.text}</Badge>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Vehicles */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="h-4 w-4 text-primary" /> Vehicles
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setVehOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {vehicles.length === 0 && <p className="text-sm text-muted-foreground">No vehicles yet.</p>}
          {vehicles.map(v => {
            const insp = dueLabel(v.next_inspection_date);
            const ins = dueLabel(v.insurance_renewal_date);
            const svc = dueLabel(v.next_service_date);
            return (
              <div key={v.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{v.nickname}</div>
                  <div className="text-xs text-muted-foreground">{[v.make, v.model, v.year].filter(Boolean).join(' ')}</div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {insp && <Badge variant={insp.variant}>🔍 Insp: {insp.text}</Badge>}
                  {ins && <Badge variant={ins.variant}>🛡️ Ins: {ins.text}</Badge>}
                  {svc && <Badge variant={svc.variant}>🔧 Svc: {svc.text}</Badge>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AddTraditionDialog open={tradOpen} onOpenChange={setTradOpen} />
      <AddPetDialog open={petOpen} onOpenChange={setPetOpen} />
      <AddMaintenanceDialog open={maintOpen} onOpenChange={setMaintOpen} />
      <AddVehicleDialog open={vehOpen} onOpenChange={setVehOpen} />
    </div>
  );
}
