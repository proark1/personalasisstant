import { useState } from 'react';
import { Contract, ContractCategory, CONTRACT_CATEGORIES, ContractInput } from '@/hooks/useContracts';
import { ContractCard } from './ContractCard';
import { AddEditContractDialog } from './AddEditContractDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Search, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

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
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
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
          {filteredContracts.length === 0 ? (
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
