import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useHealthTracking } from '@/hooks/useHealthTracking';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';

interface AddVaccinationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddVaccinationDialog({ open, onOpenChange }: AddVaccinationDialogProps) {
  const { addVaccination } = useHealthTracking();
  const { members } = useFamilyMembers();
  const [vaccineName, setVaccineName] = useState('');
  const [memberId, setMemberId] = useState<string>('');
  const [dateAdministered, setDateAdministered] = useState('');
  const [administeredBy, setAdministeredBy] = useState('');
  const [location, setLocation] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [nextDoseDate, setNextDoseDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!vaccineName.trim() || !dateAdministered) return;

    await addVaccination({
      vaccine_name: vaccineName.trim(),
      family_member_id: memberId || null,
      date_administered: dateAdministered,
      administered_by: administeredBy.trim() || null,
      location: location.trim() || null,
      lot_number: lotNumber.trim() || null,
      next_dose_date: nextDoseDate || null,
      notes: notes.trim() || null,
    });

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setVaccineName('');
    setMemberId('');
    setDateAdministered('');
    setAdministeredBy('');
    setLocation('');
    setLotNumber('');
    setNextDoseDate('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Vaccination Record</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vaccine">Vaccine Name</Label>
              <Input
                id="vaccine"
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
                placeholder="e.g., COVID-19, Flu Shot"
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
              <Label htmlFor="dateAdmin">Date Administered</Label>
              <Input
                id="dateAdmin"
                type="date"
                value={dateAdministered}
                onChange={(e) => setDateAdministered(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextDose">Next Dose Date (if any)</Label>
              <Input
                id="nextDose"
                type="date"
                value={nextDoseDate}
                onChange={(e) => setNextDoseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adminBy">Administered By</Label>
              <Input
                id="adminBy"
                value={administeredBy}
                onChange={(e) => setAdministeredBy(e.target.value)}
                placeholder="Doctor or nurse name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lot">Lot Number</Label>
              <Input
                id="lot"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Vaccine lot number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Clinic or pharmacy"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any reactions or notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!vaccineName.trim() || !dateAdministered}>
            Add Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
