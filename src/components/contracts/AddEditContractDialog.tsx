import { useState, useEffect, useRef } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload, FileText, X, Loader2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

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
      // Extract filename from URL
      if (contract.documentUrl) {
        const parts = contract.documentUrl.split('/');
        setFileName(parts[parts.length - 1]);
      } else {
        setFileName(null);
      }
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
      setFileName(null);
    }
  }, [contract, open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload a PDF or image file (JPG, PNG, WebP)',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Maximum file size is 10MB',
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const filePath = `${user.id}/${timestamp}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('contract-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('contract-documents')
        .getPublicUrl(filePath);

      // For private buckets, we need to use createSignedUrl
      const { data: signedUrlData } = await supabase.storage
        .from('contract-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

      const url = signedUrlData?.signedUrl || urlData.publicUrl;
      
      setDocumentUrl(filePath); // Store path, not URL
      setFileName(file.name);
      
      toast({
        title: 'Document uploaded',
        description: file.name,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'Could not upload document. Please try again.',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveDocument = async () => {
    if (!documentUrl || !user) return;

    try {
      // Only delete from storage if it's a storage path (not external URL)
      if (!documentUrl.startsWith('http')) {
        await supabase.storage
          .from('contract-documents')
          .remove([documentUrl]);
      }
      
      setDocumentUrl('');
      setFileName(null);
      
      toast({
        title: 'Document removed',
      });
    } catch (error) {
      console.error('Remove error:', error);
    }
  };

  const handleViewDocument = async () => {
    if (!documentUrl) return;

    // If it's an external URL, open directly
    if (documentUrl.startsWith('http')) {
      window.open(documentUrl, '_blank');
      return;
    }

    // Get signed URL for private bucket
    const { data } = await supabase.storage
      .from('contract-documents')
      .createSignedUrl(documentUrl, 60 * 60); // 1 hour

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

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

          {/* Document Upload */}
          <div className="space-y-2">
            <Label>Contract Document</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {fileName ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{fileName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleViewDocument}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  onClick={handleRemoveDocument}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload PDF or Image
                  </>
                )}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              PDF, JPG, PNG, or WebP. Max 10MB.
            </p>
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