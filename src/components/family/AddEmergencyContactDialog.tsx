import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFamilyHealth } from '@/hooks/useFamilyHealth';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export function AddEmergencyContactDialog({ open, onOpenChange }: Props) {
  const { addEmergencyContact } = useFamilyHealth();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [email, setEmail] = useState('');
  const [priority, setPriority] = useState(1);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) return;
    await addEmergencyContact({
      name: name.trim(),
      relationship: relationship || null,
      phone: phone.trim(),
      alt_phone: altPhone || null,
      email: email || null,
      priority,
      notes: null,
      family_member_id: null,
    });
    setName(''); setRelationship(''); setPhone(''); setAltPhone(''); setEmail(''); setPriority(1);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Emergency Contact</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Input value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="Spouse, Doctor…" />
            </div>
            <div className="space-y-2">
              <Label>Priority (1=top)</Label>
              <Input type="number" min={1} max={10} value={priority} onChange={e => setPriority(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Alt Phone</Label>
            <Input type="tel" value={altPhone} onChange={e => setAltPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || !phone.trim()}>Add Contact</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
