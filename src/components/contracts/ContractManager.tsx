import { useState } from 'react';
import { Contract, ContractCategory, CONTRACT_CATEGORIES, ContractInput } from '@/hooks/useContracts';
import { ContractCard } from './ContractCard';
import { AddEditContractDialog } from './AddEditContractDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
import { Plus, Search, DollarSign, Calendar, AlertTriangle, LayoutGrid, List, Pencil, Trash2, FileText } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface ContractManagerProps {
  contracts: Contract[];
  activeContracts: Contract[];
  monthlyCost: number;
  yearlyCost: number;
  contractsByCategory: Record<ContractCategory, Contract[]>;
  onAdd: (data: ContractInput) => Promise<Contract | null>;
  onUpdate: (id: string, data: Partial<ContractInput>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  getExpiringContracts: (withinDays?: number) => Contract[];
  getCancellationDeadlines: (withinDays?: number) => (Contract & { cancellationDeadline: Date })[];
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
  getExpiringContracts,
  getCancellationDeadlines,
}: ContractManagerProps) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deleteContract, setDeleteContract] = useState<Contract | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | ContractCategory>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

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
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {search ? 'No contracts match your search' : 'No contracts yet. Add your first contract!'}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Renewal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
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
                        {format(contract.renewalDate, 'MMM d, yyyy')}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {contract.isActive ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                      {contract.autoRenews && (
                        <Badge variant="outline" className="text-xs">Auto</Badge>
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
                          onClick={async () => {
                            if (contract.documentUrl?.startsWith('http')) {
                              window.open(contract.documentUrl, '_blank');
                            } else {
                              const { data } = await supabase.storage
                                .from('contract-documents')
                                .createSignedUrl(contract.documentUrl!, 60 * 60);
                              if (data?.signedUrl) {
                                window.open(data.signedUrl, '_blank');
                              }
                            }
                          }}
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Contracts & Subscriptions</h2>
          <p className="text-muted-foreground">
            Manage your contracts, subscriptions, and recurring payments
          </p>
        </div>
        <Button onClick={() => { setEditingContract(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contract
        </Button>
      </div>

      {/* Alerts */}
      {cancellationDeadlines.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Upcoming Cancellation Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {cancellationDeadlines.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <Badge variant="destructive">
                    Cancel by {format(c.cancellationDeadline, 'MMM d')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Monthly Cost
            </div>
            <p className="text-2xl font-bold">€{monthlyCost.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Yearly Cost
            </div>
            <p className="text-2xl font-bold">€{yearlyCost.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              Active Contracts
            </div>
            <p className="text-2xl font-bold">{activeContracts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="h-4 w-4" />
              Expiring Soon
            </div>
            <p className="text-2xl font-bold">{expiringContracts.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'cards' | 'table')}>
          <ToggleGroupItem value="cards" aria-label="Card view">
            <LayoutGrid className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <List className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">
            All ({contracts.length})
          </TabsTrigger>
          {CONTRACT_CATEGORIES.map(cat => {
            const count = contractsByCategory[cat.value].length;
            if (count === 0) return null;
            return (
              <TabsTrigger key={cat.value} value={cat.value}>
                {cat.icon} {cat.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-4">
          {viewMode === 'cards' ? (
            filteredContracts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {search ? 'No contracts match your search' : 'No contracts yet. Add your first contract!'}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredContracts.map(contract => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    onEdit={handleEdit}
                    onDelete={setDeleteContract}
                  />
                ))}
              </div>
            )
          ) : (
            <ContractTable />
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <AddEditContractDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contract={editingContract}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteContract} onOpenChange={() => setDeleteContract(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteContract?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
