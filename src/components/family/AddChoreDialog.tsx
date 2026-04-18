import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFamilyDailyLife } from '@/hooks/useFamilyDailyLife';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export function AddChoreDialog({ open, onOpenChange }: Props) {
  const { addChore } = useFamilyDailyLife();
  const { members } = useFamilyMembers();
  const [title, setTitle] = useState('');
  const [memberId, setMemberId] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [points, setPoints] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setSubmitting(true);
    const ok = await addChore({
      title,
      family_member_id: memberId || null,
      frequency,
      points,
      is_active: true,
    });
    setSubmitting(false);
    if (ok) {
      setTitle(''); setMemberId(''); setFrequency('weekly'); setPoints(5);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Chore</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Chore *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Take out trash" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select value={memberId || '_none'} onValueChange={v => setMemberId(v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Anyone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Anyone</SelectItem>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Points</Label>
            <Input type="number" min={1} value={points} onChange={e => setPoints(parseInt(e.target.value) || 0)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !title}>{submitting ? 'Adding…' : 'Add Chore'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
