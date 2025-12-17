import { useEffect, useRef, useCallback } from 'react';
import { Contract } from './useContracts';
import { Task } from '@/types/flux';
import { isPast, differenceInDays, format } from 'date-fns';

interface UseContractRemindersProps {
  contracts: Contract[];
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onShowToast?: (title: string, description?: string) => void;
  enabled?: boolean;
}

export function useContractReminders({
  contracts,
  tasks,
  onAddTask,
  onShowToast,
  enabled = true,
}: UseContractRemindersProps) {
  const hasCheckedRef = useRef(false);

  const createContractReminders = useCallback(() => {
    if (!enabled || contracts.length === 0) return [];

    const createdReminders: string[] = [];
    const now = new Date();

    for (const contract of contracts) {
      if (!contract.isActive || !contract.renewalDate) continue;

      // Calculate cancellation deadline
      const cancellationDate = new Date(contract.renewalDate);
      cancellationDate.setDate(cancellationDate.getDate() - contract.cancellationNoticeDays);

      // Check if we should create a reminder
      const daysUntilCancellation = differenceInDays(cancellationDate, now);
      const daysUntilRenewal = differenceInDays(contract.renewalDate, now);

      // Skip if already past
      if (daysUntilRenewal < 0) continue;

      // Create cancellation deadline reminder (if within 14 days and auto-renews)
      if (contract.autoRenews && daysUntilCancellation >= 0 && daysUntilCancellation <= 14) {
        const cancellationTaskTitle = `⚠️ Contract: ${contract.name} - Cancellation deadline`;
        const existingCancellationTask = tasks.find(t =>
          t.title.includes(contract.name) &&
          t.title.includes('Cancellation deadline') &&
          !t.completed
        );

        if (!existingCancellationTask) {
          onAddTask({
            title: cancellationTaskTitle,
            description: `Cancel by this date if you don't want auto-renewal. Provider: ${contract.provider || 'N/A'}`,
            category: 'personal',
            priority: 'high',
            completed: false,
            dueDate: cancellationDate,
          });
          createdReminders.push(`${contract.name} (cancellation)`);
        }
      }

      // Create task for contracts ending within 3 months (90 days)
      if (daysUntilRenewal >= 0 && daysUntilRenewal <= 90) {
        const renewalTaskTitle = `📋 Contract: ${contract.name} - Ends ${format(contract.renewalDate, 'MMM d')}`;
        const existingRenewalTask = tasks.find(t =>
          t.title.includes(contract.name) &&
          (t.title.includes('Ends') || t.title.includes('Renewal')) &&
          !t.completed
        );

        if (!existingRenewalTask) {
          const costInfo = contract.costAmount 
            ? ` Cost: €${contract.costAmount} (${contract.costFrequency})`
            : '';
          
          // Set priority based on urgency
          let priority: 'low' | 'medium' | 'high' = 'low';
          if (daysUntilRenewal <= 7) priority = 'high';
          else if (daysUntilRenewal <= 30) priority = 'medium';
          
          onAddTask({
            title: renewalTaskTitle,
            description: `Contract ends/renews on this date.${costInfo} Provider: ${contract.provider || 'N/A'}`,
            category: 'personal',
            priority,
            completed: false,
            dueDate: contract.renewalDate,
          });
          createdReminders.push(`${contract.name} (ending)`);
        }
      }
    }

    // Show toast if reminders were created
    if (createdReminders.length > 0 && onShowToast) {
      const names = createdReminders.slice(0, 3).join(', ');
      const extra = createdReminders.length > 3 ? ` and ${createdReminders.length - 3} more` : '';
      onShowToast(
        'Contract Reminders Created',
        `Upcoming: ${names}${extra}`
      );
    }

    return createdReminders;
  }, [contracts, tasks, onAddTask, onShowToast, enabled]);

  // Run once on mount (after contracts and tasks are loaded)
  useEffect(() => {
    if (hasCheckedRef.current || contracts.length === 0 || !enabled) return;

    // Small delay to ensure data is fully loaded
    const timer = setTimeout(() => {
      if (!hasCheckedRef.current) {
        hasCheckedRef.current = true;
        createContractReminders();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [contracts, enabled, createContractReminders]);

  // Manual trigger
  const checkAndCreateReminders = useCallback(() => {
    hasCheckedRef.current = false;
    return createContractReminders();
  }, [createContractReminders]);

  return {
    checkAndCreateReminders,
  };
}
