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
import { Upload, FileText, X, Loader2, ExternalLink, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface AddEditContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: Contract | null;
  onSave: (data: ContractInput) => void;
  prefill?: Partial<ContractInput> | null;
}

export function AddEditContractDialog({
  open,
  onOpenChange,
  contract,
  onSave,
  prefill,
}: AddEditContractDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
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
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);

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
      setIsActive(contract.isActive);
      if (contract.documentUrl) {
        const urls = contract.documentUrl.split(',').map(u => u.trim()).filter(Boolean);
        setDocumentUrls(urls);
        setFileNames(urls.map(url => {
          const parts = url.split('/');
          return parts[parts.length - 1];
        }));
      } else {
        setDocumentUrls([]);
        setFileNames([]);
      }
    } else if (prefill) {
      // Pre-fill from detected payment
      setName(prefill.name || '');
      setCategory(prefill.category || 'other');
      setProvider(prefill.provider || '');
      setCostAmount(prefill.costAmount?.toString() || '');
      setCostFrequency(prefill.costFrequency || 'monthly');
      setStartDate(prefill.startDate ? format(new Date(prefill.startDate), 'yyyy-MM-dd') : '');
      setEndDate('');
      setRenewalDate(prefill.renewalDate ? format(new Date(prefill.renewalDate), 'yyyy-MM-dd') : '');
      setCancellationNoticeDays('30');
      setAutoRenews(prefill.autoRenews ?? true);
      setContractNumber(prefill.contractNumber || '');
      setNotes(prefill.notes || '');
      setDocumentUrls([]);
      setFileNames([]);
      setIsActive(true);
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
      setDocumentUrls([]);
      setFileNames([]);
      setIsActive(true);
    }
  }, [contract, prefill, open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const filesToUpload: File[] = [];

    // Validate all files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!validTypes.includes(file.type)) {
        toast({
          variant: 'destructive',
          title: t('contracts.toast.invalidFileType'),
          description: t('contracts.toast.invalidFileTypeDesc').replace('{name}', () => file.name),
        });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: t('contracts.toast.fileTooLarge'),
          description: t('contracts.toast.fileTooLargeDesc').replace('{name}', () => file.name),
        });
        continue;
      }
      filesToUpload.push(file);
    }

    if (filesToUpload.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];
    const newNames: string[] = [];

    try {
      for (const file of filesToUpload) {
        const timestamp = Date.now();
        const filePath = `${user.id}/${timestamp}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('contract-documents')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error for', file.name, uploadError);
          toast({
            variant: 'destructive',
            title: t('contracts.toast.uploadFailed'),
            description: t('contracts.toast.uploadFileFailedDesc').replace('{name}', () => file.name),
          });
          continue;
        }

        newUrls.push(filePath);
        newNames.push(file.name);
      }

      if (newUrls.length > 0) {
        setDocumentUrls(prev => [...prev, ...newUrls]);
        setFileNames(prev => [...prev, ...newNames]);
        
        toast({
          title: t('contracts.toast.documentsUploaded'),
          description: t('contracts.toast.documentsUploadedDesc').replace('{count}', String(newUrls.length)),
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: t('contracts.toast.uploadFailed'),
        description: t('contracts.toast.uploadDocsFailedDesc'),
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveDocument = async (index: number) => {
    const urlToRemove = documentUrls[index];
    if (!urlToRemove || !user) return;

    try {
      // Only delete from storage if it's a storage path (not external URL)
      if (!urlToRemove.startsWith('http')) {
        await supabase.storage
          .from('contract-documents')
          .remove([urlToRemove]);
      }
      
      setDocumentUrls(prev => prev.filter((_, i) => i !== index));
      setFileNames(prev => prev.filter((_, i) => i !== index));
      
      toast({
        title: t('contracts.toast.documentRemoved'),
      });
    } catch (error) {
      console.error('Remove error:', error);
    }
  };

  const handleViewDocument = async (url: string) => {
    if (!url) return;

    // If it's an external URL, open directly
    if (url.startsWith('http')) {
      window.open(url, '_blank');
      return;
    }

    // Get signed URL for private bucket
    const { data } = await supabase.storage
      .from('contract-documents')
      .createSignedUrl(url, 60 * 60); // 1 hour

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
      documentUrl: documentUrls.length > 0 ? documentUrls.join(',') : undefined,
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
          {/* Prefill banner */}
          {prefill && !contract && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span className="text-muted-foreground">Pre-filled from email analysis. Please review and adjust before saving.</span>
            </div>
          )}
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
            <Label>Contract Documents</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileUpload}
              multiple
              className="hidden"
            />
            
            {/* List of uploaded files */}
            {fileNames.length > 0 && (
              <div className="space-y-2">
                {fileNames.map((name, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <span className="text-sm truncate flex-1">{name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleViewDocument(documentUrls[index])}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveDocument(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Upload button */}
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
                  {fileNames.length > 0 ? 'Add More Documents' : 'Upload PDF or Image'}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              PDF, JPG, PNG, or WebP. Max 10MB per file. Select multiple files at once.
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