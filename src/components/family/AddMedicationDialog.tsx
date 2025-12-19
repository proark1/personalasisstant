import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useHealthTracking } from '@/hooks/useHealthTracking';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';

interface AddMedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMedicationDialog({ open, onOpenChange }: AddMedicationDialogProps) {
  const { addMedication } = useHealthTracking();
  const { members } = useFamilyMembers();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [memberId, setMemberId] = useState<string>('');
  const [prescribingDoctor, setPrescribingDoctor] = useState('');
  const [pharmacy, setPharmacy] = useState('');
  const [refillDate, setRefillDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;

    await addMedication({
      name: name.trim(),
      dosage: dosage.trim() || null,
      frequency: frequency.trim() || null,
      family_member_id: memberId || null,
      prescribing_doctor: prescribingDoctor.trim() || null,
      pharmacy: pharmacy.trim() || null,
      refill_date: refillDate || null,
      start_date: null,
      end_date: null,
      notes: notes.trim() || null,
      is_active: true,
    });

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setName('');
    setDosage('');
    setFrequency('');
    setMemberId('');
    setPrescribingDoctor('');
    setPharmacy('');
    setRefillDate('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Medication</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Medication Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Ibuprofen"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member">For</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Me</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g., 200mg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Input
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                placeholder="e.g., Twice daily"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doctor">Prescribing Doctor</Label>
              <Input
                id="doctor"
                value={prescribingDoctor}
                onChange={(e) => setPrescribingDoctor(e.target.value)}
                placeholder="Doctor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pharmacy">Pharmacy</Label>
              <Input
                id="pharmacy"
                value={pharmacy}
                onChange={(e) => setPharmacy(e.target.value)}
                placeholder="Pharmacy name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refillDate">Refill Date</Label>
            <Input
              id="refillDate"
              type="date"
              value={refillDate}
              onChange={(e) => setRefillDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>Add Medication</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
