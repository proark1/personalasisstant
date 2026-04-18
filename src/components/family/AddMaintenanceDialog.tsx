import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFamilyMemoryHome } from '@/hooks/useFamilyMemoryHome';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export function AddMaintenanceDialog({ open, onOpenChange }: Props) {
  const { addMaintenance } = useFamilyMemoryHome();
  const [taskName, setTaskName] = useState('');
  const [category, setCategory] = useState('general');
  const [frequencyMonths, setFrequencyMonths] = useState('12');
  const [lastDone, setLastDone] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [providerName, setProviderName] = useState('');
  const [providerPhone, setProviderPhone] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName) return;
    await addMaintenance({
      task_name: taskName, category,
      frequency_months: frequencyMonths ? parseInt(frequencyMonths) : null,
      last_done_date: lastDone || null,
      next_due_date: nextDue || null,
      provider_name: providerName || null,
      provider_phone: providerPhone || null,
      cost_estimate: cost ? parseFloat(cost) : null,
      notes: notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Household Maintenance</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Task *</Label>
            <Input value={taskName} onChange={e => setTaskName(e.target.value)} placeholder="Boiler service" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="heating">Heating</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="garden">Garden</SelectItem>
                  <SelectItem value="appliances">Appliances</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency (months)</Label>
              <Input type="number" value={frequencyMonths} onChange={e => setFrequencyMonths(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last done</Label>
              <Input type="date" value={lastDone} onChange={e => setLastDone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Next due</Label>
              <Input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Input value={providerName} onChange={e => setProviderName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Provider phone</Label>
              <Input value={providerPhone} onChange={e => setProviderPhone(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Cost estimate</Label>
              <Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!taskName}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
