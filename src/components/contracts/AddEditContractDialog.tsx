import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Contract, ContractInput, ContractCategory, CostFrequency, CONTRACT_CATEGORIES } from '@/hooks/useContracts';
import { format } from 'date-fns';

interface AddEditContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: Contract | null;
  onSave: (data: ContractInput) => void;
}

export function AddEditContractDialog({
  open,
  onOpenChange,
  contract,
  onSave,
}: AddEditContractDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ContractCategory>('other');
  const [provider, setProvider] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [costFrequency, setCostFrequency] = useState<CostFrequency>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [cancellationNoticeDays, setCancellationNoticeDays] = useState('30');
  const [autoRenews, setAutoRenews] = useState(true);
  const [contractNumber, setContractNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (contract) {
      setName(contract.name);
      setCategory(contract.category);
      setProvider(contract.provider || '');
      setCostAmount(contract.costAmount?.toString() || '');
      setCostFrequency(contract.costFrequency);
      setStartDate(contract.startDate ? format(contract.startDate, 'yyyy-MM-dd') : '');
      setEndDate(contract.endDate ? format(contract.endDate, 'yyyy-MM-dd') : '');
      setRenewalDate(contract.renewalDate ? format(contract.renewalDate, 'yyyy-MM-dd') : '');
      setCancellationNoticeDays(contract.cancellationNoticeDays.toString());
      setAutoRenews(contract.autoRenews);
      setContractNumber(contract.contractNumber || '');
      setNotes(contract.notes || '');
      setDocumentUrl(contract.documentUrl || '');
      setIsActive(contract.isActive);
    } else {
      // Reset form
      setName('');
      setCategory('other');
      setProvider('');
      setCostAmount('');
      setCostFrequency('monthly');
      setStartDate('');
      setEndDate('');
      setRenewalDate('');
      setCancellationNoticeDays('30');
      setAutoRenews(true);
      setContractNumber('');
      setNotes('');
      setDocumentUrl('');
      setIsActive(true);
    }
  }, [contract, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: ContractInput = {
      name,
      category,
      provider: provider || undefined,
      costAmount: costAmount ? parseFloat(costAmount) : undefined,
      costFrequency,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      renewalDate: renewalDate ? new Date(renewalDate) : undefined,
      cancellationNoticeDays: parseInt(cancellationNoticeDays) || 30,
      autoRenews,
      contractNumber: contractNumber || undefined,
      notes: notes || undefined,
      documentUrl: documentUrl || undefined,
      isActive,
    };

    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contract ? 'Edit Contract' : 'Add Contract'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Home Insurance"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ContractCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Input
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Company name"
            />
          </div>

          {/* Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="costAmount">Cost (€)</Label>
              <Input
                id="costAmount"
                type="number"
                step="0.01"
                min="0"
                value={costAmount}
                onChange={(e) => setCostAmount(e.target.value)}
                placeholder="29.99"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costFrequency">Frequency</Label>
              <Select value={costFrequency} onValueChange={(v) => setCostFrequency(v as CostFrequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="renewalDate">Renewal Date</Label>
              <Input
                id="renewalDate"
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
              />
            </div>
          </div>

          {/* Auto-renew & Cancellation */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <Label htmlFor="autoRenews" className="cursor-pointer">Auto-renews</Label>
              <Switch
                id="autoRenews"
                checked={autoRenews}
                onCheckedChange={setAutoRenews}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancellationNoticeDays">Cancel notice (days)</Label>
              <Input
                id="cancellationNoticeDays"
                type="number"
                min="0"
                value={cancellationNoticeDays}
                onChange={(e) => setCancellationNoticeDays(e.target.value)}
              />
            </div>
          </div>

          {/* Contract Number */}
          <div className="space-y-2">
            <Label htmlFor="contractNumber">Contract Number</Label>
            <Input
              id="contractNumber"
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              placeholder="Optional reference number"
            />
          </div>

          {/* Document URL */}
          <div className="space-y-2">
            <Label htmlFor="documentUrl">Document Link</Label>
            <Input
              id="documentUrl"
              type="url"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Notes */}
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

          {/* Active Status */}
          {contract && (
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {contract ? 'Save Changes' : 'Add Contract'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
