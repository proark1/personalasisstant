import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFamilyHealth } from '@/hooks/useFamilyHealth';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

const DOC_TYPES = ['Passport', 'National ID', 'Birth Certificate', 'Residence Permit', 'Visa', 'Driver License', 'Other'];

export function AddImportantDocumentDialog({ open, onOpenChange }: Props) {
  const { addDocument } = useFamilyHealth();
  const { members } = useFamilyMembers();
  const [type, setType] = useState('Passport');
  const [number, setNumber] = useState('');
  const [country, setCountry] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [memberId, setMemberId] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    await addDocument({
      document_type: type,
      document_number: number || null,
      issuing_country: country || null,
      issuing_authority: null,
      issue_date: issueDate || null,
      expiry_date: expiryDate || null,
      file_url: null,
      reminder_days_before: 180,
      notes: notes || null,
      family_member_id: memberId || null,
    });
    setNumber(''); setCountry(''); setIssueDate(''); setExpiryDate(''); setMemberId(''); setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Important Document</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>For</Label>
              <Select value={memberId || '_me'} onValueChange={v => setMemberId(v === '_me' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_me">Me</SelectItem>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Document Number</Label>
            <Input value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g., AB1234567" />
          </div>
          <div className="space-y-2">
            <Label>Issuing Country</Label>
            <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Germany" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Add Document</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
