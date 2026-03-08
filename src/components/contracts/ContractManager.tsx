import { useState } from 'react';
import { Contract, ContractCategory, CONTRACT_CATEGORIES, ContractInput } from '@/hooks/useContracts';
import { ContractCard } from './ContractCard';
import { AddEditContractDialog } from './AddEditContractDialog';
import { CancellationEmailDialog } from './CancellationEmailDialog';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';
import { ContractTimeline } from './ContractTimeline';
import { SnoozeReminderDialog } from './SnoozeReminderDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/components/ui/panel-shell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Search, 
  DollarSign, 
  Calendar, 
  AlertTriangle, 
  LayoutGrid, 
  List, 
  Pencil, 
  Trash2, 
  FileText,
  CalendarPlus,
  Clock,
  Sparkles,
  Loader2
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSmartContractReminders } from '@/hooks/useSmartContractReminders';
import { useContractAI } from '@/hooks/useContractAI';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ContractHealthBadge } from './ContractHealthScore';

interface ContractManagerProps {
  contracts: Contract[];
  activeContracts: Contract[];
  monthlyCost: number;
  yearlyCost: number;
  contractsByCategory: Record<ContractCategory, Contract[]>;
  onAdd: (data: ContractInput) => Promise<Contract | null>;
  onUpdate: (id: string, data: Partial<ContractInput>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onSnooze: (id: string, months: number) => Promise<boolean>;
  getExpiringContracts: (withinDays?: number) => Contract[];
  getCancellationDeadlines: (withinDays?: number) => (Contract & { cancellationDeadline: Date })[];
  onShareContract?: (contractId: string, contractName: string) => void;
}

export function ContractManager({
  contracts,
  activeContracts,
  monthlyCost,
  yearlyCost,
  contractsByCategory,
  onAdd,
  onUpdate,
  onDelete,
  onSnooze,
  getExpiringContracts,
  getCancellationDeadlines,
  onShareContract,
}: ContractManagerProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const dateLocale = language === 'de' ? de : enUS;
  
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deleteContract, setDeleteContract] = useState<Contract | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | ContractCategory>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'timeline'>('cards');
  
  // New states for enhanced features
  const [emailDialogContract, setEmailDialogContract] = useState<Contract | null>(null);
  const [previewDocument, setPreviewDocument] = useState<{ path: string; name: string } | null>(null);
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [showBulkSelect, setShowBulkSelect] = useState(false);
  const [syncingToCalendar, setSyncingToCalendar] = useState(false);
  const [snoozeContract, setSnoozeContract] = useState<Contract | null>(null);

  // Hooks
  const { syncToCalendar, syncAllToCalendar } = useSmartContractReminders({
    contracts,
    userId: user?.id
  });
  const { scanDocument, isScanning } = useContractAI();

  const expiringContracts = getExpiringContracts(30);
  const cancellationDeadlines = getCancellationDeadlines(14);

  const filteredContracts = contracts.filter(c => {
    const matchesSearch = !search || 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.provider?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || c.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSave = async (data: ContractInput) => {
    if (editingContract) {
      await onUpdate(editingContract.id, data);
    } else {
      await onAdd(data);
    }
    setEditingContract(null);
  };

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract);
    setDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteContract) {
      await onDelete(deleteContract.id);
      setDeleteContract(null);
    }
  };

  const handleSyncToCalendar = async (contract: Contract) => {
    const success = await syncToCalendar(contract);
    if (success) {
      toast({
        title: 'Added to calendar',
        description: `${contract.name} events added to your calendar`
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Sync failed',
        description: 'Could not add events to calendar'
      });
    }
  };

  const handleSyncAllToCalendar = async () => {
    setSyncingToCalendar(true);
    try {
      const count = await syncAllToCalendar();
      toast({
        title: 'Calendar synced',
        description: `${count} contract events added to calendar`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Sync failed',
        description: 'Could not sync contracts to calendar'
      });
    } finally {
      setSyncingToCalendar(false);
    }
  };

  const handleScanDocument = async (contract: Contract) => {
    if (!contract.documentUrl) return;
    
    const documentPath = contract.documentUrl.split(',')[0]; // Take first document
    const result = await scanDocument(documentPath);
    
    if (result) {
      // Pre-fill the edit dialog with scanned data
      setEditingContract({
        ...contract,
        ...result,
        // Convert string dates to Date objects
        startDate: result.startDate ? new Date(result.startDate) : contract.startDate,
        endDate: result.endDate ? new Date(result.endDate) : contract.endDate,
        renewalDate: result.renewalDate ? new Date(result.renewalDate) : contract.renewalDate,
      });
      setDialogOpen(true);
    }
  };

  const handlePreviewDocument = (contract: Contract) => {
    if (!contract.documentUrl) return;
    const firstDoc = contract.documentUrl.split(',')[0];
    setPreviewDocument({ path: firstDoc, name: contract.name });
  };

  const handleSnooze = async (months: number) => {
    if (!snoozeContract) return;
    const success = await onSnooze(snoozeContract.id, months);
    if (success) {
      toast({
        title: 'Reminders snoozed',
        description: `You won't be reminded about ${snoozeContract.name} for ${months} month${months > 1 ? 's' : ''}`
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Snooze failed',
        description: 'Could not snooze reminders'
      });
    }
    setSnoozeContract(null);
  };

  const handleBulkDelete = async () => {
    if (selectedContracts.size === 0) return;
    
    for (const id of selectedContracts) {
      await onDelete(id);
    }
    setSelectedContracts(new Set());
    setShowBulkSelect(false);
    toast({
      title: 'Contracts deleted',
      description: `${selectedContracts.size} contracts deleted`
    });
  };

  const toggleSelectAll = () => {
    if (selectedContracts.size === filteredContracts.length) {
      setSelectedContracts(new Set());
    } else {
      setSelectedContracts(new Set(filteredContracts.map(c => c.id)));
    }
  };

  const formatCost = (contract: Contract) => {
    if (!contract.costAmount) return null;
    const amount = contract.costAmount.toFixed(2);
    const freq = {
      monthly: '/mo',
      quarterly: '/qtr',
      yearly: '/yr',
      one_time: ' one-time',
    }[contract.costFrequency];
    return `€${amount}${freq}`;
  };

  const ContractTable = () => {
    if (filteredContracts.length === 0) {
      return (
        <EmptyState
          icon={FileText}
          title={search ? "No contracts found" : "No contracts yet"}
          description={search ? "Try a different search term" : "Add your first contract to get started"}
        />
      );
    }

    return (
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow>
              {showBulkSelect && (
                <TableHead className="w-[40px]">
                  <Checkbox 
                    checked={selectedContracts.size === filteredContracts.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead>{t('contracts.contract')}</TableHead>
              <TableHead>{t('contracts.provider')}</TableHead>
              <TableHead>{t('contracts.category')}</TableHead>
              <TableHead>{t('contracts.cost')}</TableHead>
              <TableHead>{t('contracts.renewal')}</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>{t('contracts.status')}</TableHead>
              <TableHead className="w-[100px]">{t('contracts.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContracts.map((contract) => {
              const categoryInfo = CONTRACT_CATEGORIES.find(c => c.value === contract.category);
              const daysUntilRenewal = contract.renewalDate 
                ? differenceInDays(contract.renewalDate, new Date()) 
                : null;
              const isRenewalSoon = daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30;
              
              return (
                <TableRow key={contract.id}>
                  {showBulkSelect && (
                    <TableCell>
                      <Checkbox 
                        checked={selectedContracts.has(contract.id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedContracts);
                          if (checked) {
                            newSet.add(contract.id);
                          } else {
                            newSet.delete(contract.id);
                          }
                          setSelectedContracts(newSet);
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{categoryInfo?.icon || '📄'}</span>
                      <span className="font-medium">{contract.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{contract.provider || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{categoryInfo?.label || contract.category}</Badge>
                  </TableCell>
                  <TableCell>{formatCost(contract) || '-'}</TableCell>
                  <TableCell>
                    {contract.renewalDate ? (
                      <span className={isRenewalSoon ? 'text-primary font-medium' : ''}>
                        {format(contract.renewalDate, 'PPP', { locale: dateLocale })}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <ContractHealthBadge contract={contract} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {contract.isActive ? (
                        <Badge variant="secondary">{t('contracts.active')}</Badge>
                      ) : (
                        <Badge variant="outline">{t('contracts.inactive')}</Badge>
                      )}
                      {contract.autoRenews && (
                        <Badge variant="outline" className="text-xs">{t('contracts.auto')}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {contract.documentUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePreviewDocument(contract)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(contract)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteContract(contract)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleSyncAllToCalendar}
          disabled={syncingToCalendar}
        >
          {syncingToCalendar ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CalendarPlus className="h-4 w-4 mr-2" />
          )}
          Sync to Calendar
        </Button>
        <Button size="sm" onClick={() => { setEditingContract(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          {t('contracts.addContract')}
        </Button>
      </div>

      {/* Alerts */}
      {cancellationDeadlines.length > 0 && (
        <GlassCard className="border-destructive/50 bg-destructive/5">
          <GlassCardHeader className="pb-2">
            <GlassCardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {t('contracts.cancellationDeadlines')}
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-1">
              {cancellationDeadlines.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setEmailDialogContract(c)}
                    >
                      Generate Cancellation
                    </Button>
                    <Badge variant="destructive">
                      {t('contracts.cancelBy')} {format(c.cancellationDeadline, 'MMM d', { locale: dateLocale })}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard pressable haptic="light">
          <GlassCardContent className="pt-4 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              {t('contracts.monthlyCost')}
            </div>
            <p className="text-2xl font-bold">€{monthlyCost.toFixed(2)}</p>
          </GlassCardContent>
        </GlassCard>
        <GlassCard pressable haptic="light">
          <GlassCardContent className="pt-4 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              {t('contracts.yearlyCost')}
            </div>
            <p className="text-2xl font-bold">€{yearlyCost.toFixed(2)}</p>
          </GlassCardContent>
        </GlassCard>
        <GlassCard pressable haptic="light">
          <GlassCardContent className="pt-4 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              {t('contracts.activeContracts')}
            </div>
            <p className="text-2xl font-bold">{activeContracts.length}</p>
          </GlassCardContent>
        </GlassCard>
        <GlassCard pressable haptic="light">
          <GlassCardContent className="pt-4 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <AlertTriangle className="h-4 w-4" />
              {t('contracts.expiringSoon')}
            </div>
            <p className="text-2xl font-bold">{expiringContracts.length}</p>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('contracts.searchContracts')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ToggleGroup 
          type="single" 
          value={viewMode} 
          onValueChange={(v) => v && setViewMode(v as 'cards' | 'table' | 'timeline')}
        >
          <ToggleGroupItem value="cards" aria-label="Card view">
            <LayoutGrid className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <List className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="timeline" aria-label="Timeline view">
            <Clock className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <Button
          variant={showBulkSelect ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setShowBulkSelect(!showBulkSelect);
            if (showBulkSelect) setSelectedContracts(new Set());
          }}
        >
          {showBulkSelect ? 'Cancel Selection' : 'Bulk Select'}
        </Button>
        {showBulkSelect && selectedContracts.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete ({selectedContracts.size})
          </Button>
        )}
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <ContractTimeline contracts={contracts} />
      )}

      {/* Category Tabs */}
      {viewMode !== 'timeline' && (
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)}>
          <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
            <TabsList className="inline-flex min-w-max h-auto gap-1">
              <TabsTrigger value="all" className="whitespace-nowrap">
                {t('contracts.all')} ({contracts.length})
              </TabsTrigger>
              {CONTRACT_CATEGORIES.map(cat => {
                const count = contractsByCategory[cat.value].length;
                if (count === 0) return null;
                return (
                  <TabsTrigger key={cat.value} value={cat.value} className="whitespace-nowrap">
                    {cat.icon} {cat.label} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <TabsContent value={activeCategory} className="mt-4">
            {viewMode === 'cards' ? (
              filteredContracts.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={search ? "No contracts found" : "No contracts yet"}
                  description={search ? "Try a different search term" : "Add your first contract to get started"}
                />
              ) : (
                <motion.div 
                  className="grid gap-3 md:grid-cols-2"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                >
                  {filteredContracts.map(contract => (
                    <ContractCard
                      key={contract.id}
                      contract={contract}
                      onEdit={handleEdit}
                      onDelete={setDeleteContract}
                      onShare={onShareContract ? (c) => onShareContract(c.id, c.name) : undefined}
                      onGenerateEmail={setEmailDialogContract}
                      onPreviewDocument={handlePreviewDocument}
                      onSyncToCalendar={handleSyncToCalendar}
                      onScanDocument={handleScanDocument}
                      onSnoozeReminder={setSnoozeContract}
                      isSelected={selectedContracts.has(contract.id)}
                      onSelectChange={(selected) => {
                        const newSet = new Set(selectedContracts);
                        if (selected) {
                          newSet.add(contract.id);
                        } else {
                          newSet.delete(contract.id);
                        }
                        setSelectedContracts(newSet);
                      }}
                      showBulkSelect={showBulkSelect}
                    />
                  ))}
                </div>
              )
            ) : (
              <ContractTable />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Add/Edit Dialog */}
      <AddEditContractDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contract={editingContract}
        onSave={handleSave}
      />

      {/* Cancellation Email Dialog */}
      <CancellationEmailDialog
        open={!!emailDialogContract}
        onOpenChange={(open) => !open && setEmailDialogContract(null)}
        contract={emailDialogContract}
      />

      {/* Document Preview Dialog */}
      <DocumentPreviewDialog
        open={!!previewDocument}
        onOpenChange={(open) => !open && setPreviewDocument(null)}
        documentPath={previewDocument?.path || null}
        contractName={previewDocument?.name}
      />

      {/* Snooze Reminder Dialog */}
      <SnoozeReminderDialog
        open={!!snoozeContract}
        onOpenChange={(open) => !open && setSnoozeContract(null)}
        contractName={snoozeContract?.name || ''}
        onSnooze={handleSnooze}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteContract} onOpenChange={() => setDeleteContract(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('contracts.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('contracts.confirmDeleteDesc').replace('this contract', `"${deleteContract?.name}"`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
