import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { moduleBus } from '@/lib/moduleEventBus';
import { moduleHealth } from '@/lib/moduleHealth';
import { useAppNotifications } from './useAppNotifications';
export type ContractCategory = 'insurance' | 'utilities' | 'subscription' | 'phone' | 'internet' | 'streaming' | 'other';
export type CostFrequency = 'monthly' | 'quarterly' | 'yearly' | 'one_time';

export interface Contract {
  id: string;
  userId: string;
  contactId?: string;
  name: string;
  category: ContractCategory;
  provider?: string;
  costAmount?: number;
  costFrequency: CostFrequency;
  startDate?: Date;
  endDate?: Date;
  renewalDate?: Date;
  cancellationNoticeDays: number;
  autoRenews: boolean;
  contractNumber?: string;
  notes?: string;
  documentUrl?: string;
  isActive: boolean;
  reminderSnoozedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractInput {
  name: string;
  category: ContractCategory;
  contactId?: string;
  provider?: string;
  costAmount?: number;
  costFrequency?: CostFrequency;
  startDate?: Date;
  endDate?: Date;
  renewalDate?: Date;
  cancellationNoticeDays?: number;
  autoRenews?: boolean;
  contractNumber?: string;
  notes?: string;
  documentUrl?: string;
  isActive?: boolean;
}

export const CONTRACT_CATEGORIES: { value: ContractCategory; label: string; icon: string }[] = [
  { value: 'insurance', label: 'Insurance', icon: '🛡️' },
  { value: 'utilities', label: 'Utilities', icon: '⚡' },
  { value: 'subscription', label: 'Subscription', icon: '📦' },
  { value: 'phone', label: 'Phone', icon: '📱' },
  { value: 'internet', label: 'Internet', icon: '🌐' },
  { value: 'streaming', label: 'Streaming', icon: '🎬' },
  { value: 'other', label: 'Other', icon: '📄' },
];

const EMPTY_CONTRACTS: Contract[] = [];

export function useContracts(userId: string | undefined) {
  const queryClient = useQueryClient();
  const { notifyContractCreated } = useAppNotifications();

  const mapDbToContract = (row: Tables<'contracts'>): Contract => ({
    id: row.id,
    userId: row.user_id,
    contactId: row.contact_id || undefined,
    name: row.name,
    category: row.category as ContractCategory,
    provider: row.provider || undefined,
    costAmount: row.cost_amount ? row.cost_amount : undefined,
    costFrequency: (row.cost_frequency || 'monthly') as CostFrequency,
    startDate: row.start_date ? new Date(row.start_date) : undefined,
    endDate: row.end_date ? new Date(row.end_date) : undefined,
    renewalDate: row.renewal_date ? new Date(row.renewal_date) : undefined,
    cancellationNoticeDays: row.cancellation_notice_days || 30,
    autoRenews: row.auto_renews ?? true,
    contractNumber: row.contract_number || undefined,
    notes: row.notes || undefined,
    documentUrl: row.document_url || undefined,
    isActive: row.is_active ?? true,
    reminderSnoozedUntil: row.reminder_snoozed_until ? new Date(row.reminder_snoozed_until) : undefined,
    createdAt: new Date(row.created_at ?? ''),
    updatedAt: new Date(row.updated_at ?? ''),
  });

  // Shared query so every useContracts consumer reads one cached
  // ['contracts', userId] entry and the cacheCoordinator ['contracts']
  // invalidations take effect.
  const query = useQuery({
    queryKey: ['contracts', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Contract[]> => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', userId!)
        .order('renewal_date', { ascending: true, nullsFirst: false });
      if (error) {
        moduleHealth.reportError('contracts', error);
        throw error;
      }
      moduleHealth.reportSuccess('contracts');
      return (data || []).map(mapDbToContract);
    },
  });

  const refetch = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: ['contracts', userId] });
  }, [queryClient, userId]);

  const contracts = query.data ?? EMPTY_CONTRACTS;
  const loading = query.isLoading;

  const addContract = useCallback(async (input: ContractInput): Promise<Contract | null> => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('contracts')
      .insert({
        user_id: userId,
        name: input.name,
        category: input.category,
        contact_id: input.contactId || null,
        provider: input.provider || null,
        cost_amount: input.costAmount || null,
        cost_frequency: input.costFrequency || 'monthly',
        start_date: input.startDate?.toISOString().split('T')[0] || null,
        end_date: input.endDate?.toISOString().split('T')[0] || null,
        renewal_date: input.renewalDate?.toISOString().split('T')[0] || null,
        cancellation_notice_days: input.cancellationNoticeDays || 30,
        auto_renews: input.autoRenews ?? true,
        contract_number: input.contractNumber || null,
        notes: input.notes || null,
        document_url: input.documentUrl || null,
        is_active: input.isActive ?? true,
      })
      .select()
      .single();

    if (data && !error) {
      const newContract = mapDbToContract(data);
      queryClient.setQueryData<Contract[]>(['contracts', userId], (prev) => [...(prev ?? []), newContract]);

      // Create in-app notification
      notifyContractCreated(newContract.name, newContract.id);
      moduleBus.emit('contract:created', { contractId: newContract.id }, 'useContracts');

      return newContract;
    }
    return null;
  }, [userId, queryClient, notifyContractCreated]);

  const updateContract = useCallback(async (
    id: string,
    updates: Partial<ContractInput>
  ): Promise<boolean> => {
    const dbUpdates: TablesUpdate<'contracts'> = {};

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.contactId !== undefined) dbUpdates.contact_id = updates.contactId || null;
    if (updates.provider !== undefined) dbUpdates.provider = updates.provider || null;
    if (updates.costAmount !== undefined) dbUpdates.cost_amount = updates.costAmount || null;
    if (updates.costFrequency !== undefined) dbUpdates.cost_frequency = updates.costFrequency;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate?.toISOString().split('T')[0] || null;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate?.toISOString().split('T')[0] || null;
    if (updates.renewalDate !== undefined) dbUpdates.renewal_date = updates.renewalDate?.toISOString().split('T')[0] || null;
    if (updates.cancellationNoticeDays !== undefined) dbUpdates.cancellation_notice_days = updates.cancellationNoticeDays;
    if (updates.autoRenews !== undefined) dbUpdates.auto_renews = updates.autoRenews;
    if (updates.contractNumber !== undefined) dbUpdates.contract_number = updates.contractNumber || null;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;
    if (updates.documentUrl !== undefined) dbUpdates.document_url = updates.documentUrl || null;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

    const { error } = await supabase
      .from('contracts')
      .update(dbUpdates)
      .eq('id', id);

    if (!error) {
      queryClient.setQueryData<Contract[]>(['contracts', userId], (prev) => (prev ?? []).map(c =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
      ));
      moduleBus.emit('contract:updated', { contractId: id, fields: Object.keys(updates) }, 'useContracts');
      return true;
    }
    return false;
  }, [userId, queryClient]);

  const deleteContract = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (!error) {
      queryClient.setQueryData<Contract[]>(['contracts', userId], (prev) => (prev ?? []).filter(c => c.id !== id));
      moduleBus.emit('contract:deleted', { contractId: id }, 'useContracts');
      return true;
    }
    return false;
  }, [userId, queryClient]);

  // Get contracts expiring soon (within X days)
  const getExpiringContracts = useCallback((withinDays: number = 30) => {
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + withinDays);

    return contracts.filter(c => 
      c.isActive && 
      c.renewalDate && 
      c.renewalDate >= now && 
      c.renewalDate <= threshold
    );
  }, [contracts]);

  // Get contracts with upcoming cancellation deadlines
  const getCancellationDeadlines = useCallback((withinDays: number = 30) => {
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + withinDays);

    return contracts.filter(c => {
      if (!c.isActive || !c.renewalDate || !c.autoRenews) return false;
      // Skip if reminder is snoozed
      if (c.reminderSnoozedUntil && c.reminderSnoozedUntil > now) return false;
      const cancellationDate = new Date(c.renewalDate);
      cancellationDate.setDate(cancellationDate.getDate() - c.cancellationNoticeDays);
      return cancellationDate >= now && cancellationDate <= threshold;
    }).map(c => {
      const cancellationDate = new Date(c.renewalDate!);
      cancellationDate.setDate(cancellationDate.getDate() - c.cancellationNoticeDays);
      return { ...c, cancellationDeadline: cancellationDate };
    });
  }, [contracts]);

  // Snooze contract reminders
  const snoozeReminder = useCallback(async (id: string, months: number): Promise<boolean> => {
    const snoozedUntil = new Date();
    snoozedUntil.setMonth(snoozedUntil.getMonth() + months);

    const { error } = await supabase
      .from('contracts')
      .update({ reminder_snoozed_until: snoozedUntil.toISOString() })
      .eq('id', id);

    if (!error) {
      queryClient.setQueryData<Contract[]>(['contracts', userId], (prev) => (prev ?? []).map(c =>
        c.id === id ? { ...c, reminderSnoozedUntil: snoozedUntil, updatedAt: new Date() } : c
      ));
      return true;
    }
    return false;
  }, [userId, queryClient]);

  // Calculate monthly cost
  const monthlyCost = useMemo(() => {
    return contracts
      .filter(c => c.isActive && c.costAmount)
      .reduce((total, c) => {
        const amount = c.costAmount || 0;
        switch (c.costFrequency) {
          case 'monthly': return total + amount;
          case 'quarterly': return total + (amount / 3);
          case 'yearly': return total + (amount / 12);
          case 'one_time': return total;
          default: return total + amount;
        }
      }, 0);
  }, [contracts]);

  // Calculate yearly cost
  const yearlyCost = useMemo(() => monthlyCost * 12, [monthlyCost]);

  // Active contracts
  const activeContracts = useMemo(() => 
    contracts.filter(c => c.isActive), [contracts]);

  // Contracts by category
  const contractsByCategory = useMemo(() => {
    const grouped: Record<ContractCategory, Contract[]> = {
      insurance: [],
      utilities: [],
      subscription: [],
      phone: [],
      internet: [],
      streaming: [],
      other: [],
    };
    contracts.forEach(c => {
      if (grouped[c.category]) {
        grouped[c.category].push(c);
      }
    });
    return grouped;
  }, [contracts]);

  return {
    contracts,
    activeContracts,
    loading,
    addContract,
    updateContract,
    deleteContract,
    snoozeReminder,
    getExpiringContracts,
    getCancellationDeadlines,
    monthlyCost,
    yearlyCost,
    contractsByCategory,
    refetch,
  };
}
