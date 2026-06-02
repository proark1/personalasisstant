import { useEffect, useCallback, useRef } from 'react';
import { Contract } from './useContracts';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format, addDays } from 'date-fns';

interface ReminderSchedule {
  daysBeforeDeadline: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  body: string;
}

const REMINDER_SCHEDULES: ReminderSchedule[] = [
  { daysBeforeDeadline: 90, priority: 'low', title: 'Contract Renewal Notice', body: '3 months until renewal' },
  { daysBeforeDeadline: 30, priority: 'medium', title: 'Contract Renewal Reminder', body: '1 month until renewal' },
  { daysBeforeDeadline: 14, priority: 'high', title: 'Contract Deadline Approaching', body: '2 weeks until deadline' },
  { daysBeforeDeadline: 7, priority: 'critical', title: 'Urgent: Contract Action Required', body: '1 week until deadline' },
  { daysBeforeDeadline: 3, priority: 'critical', title: 'Critical: Contract Action Required', body: '3 days until deadline' },
  { daysBeforeDeadline: 1, priority: 'critical', title: 'Final Notice: Contract Action Tomorrow', body: 'Deadline is tomorrow' },
];

interface UseSmartContractRemindersProps {
  contracts: Contract[];
  userId: string | undefined;
  onCreateCalendarEvent?: (contract: Contract, date: Date, type: 'renewal' | 'cancellation') => Promise<void>;
}

export function useSmartContractReminders({
  contracts,
  userId,
  onCreateCalendarEvent: _onCreateCalendarEvent
}: UseSmartContractRemindersProps) {
  const processedRef = useRef<Set<string>>(new Set());

  // Check contracts and create appropriate reminders
  const checkAndScheduleReminders = useCallback(async () => {
    if (!userId || contracts.length === 0) return;

    const now = new Date();
    const remindersToCreate: Array<{
      contract: Contract;
      schedule: ReminderSchedule;
      date: Date;
      type: 'renewal' | 'cancellation';
    }> = [];

    for (const contract of contracts) {
      if (!contract.isActive) continue;

      // Check renewal date reminders
      if (contract.renewalDate) {
        const daysUntilRenewal = differenceInDays(contract.renewalDate, now);
        
        for (const schedule of REMINDER_SCHEDULES) {
          if (daysUntilRenewal === schedule.daysBeforeDeadline) {
            const reminderId = `${contract.id}-renewal-${schedule.daysBeforeDeadline}`;
            if (!processedRef.current.has(reminderId)) {
              remindersToCreate.push({
                contract,
                schedule,
                date: contract.renewalDate,
                type: 'renewal'
              });
              processedRef.current.add(reminderId);
            }
          }
        }
      }

      // Check cancellation deadline reminders (for auto-renewing contracts)
      if (contract.renewalDate && contract.autoRenews) {
        const cancellationDate = addDays(contract.renewalDate, -contract.cancellationNoticeDays);
        const daysUntilCancellation = differenceInDays(cancellationDate, now);

        for (const schedule of REMINDER_SCHEDULES) {
          if (daysUntilCancellation === schedule.daysBeforeDeadline) {
            const reminderId = `${contract.id}-cancellation-${schedule.daysBeforeDeadline}`;
            if (!processedRef.current.has(reminderId)) {
              remindersToCreate.push({
                contract,
                schedule: {
                  ...schedule,
                  title: `Cancellation Deadline: ${contract.name}`,
                  body: `Cancel by ${format(cancellationDate, 'MMM d')} to avoid auto-renewal`
                },
                date: cancellationDate,
                type: 'cancellation'
              });
              processedRef.current.add(reminderId);
            }
          }
        }
      }
    }

    // Create notifications for matching reminders
    for (const reminder of remindersToCreate) {
      try {
        // Create in-app notification
        await supabase.from('user_notifications').insert({
          user_id: userId,
          title: reminder.schedule.title,
          message: `${reminder.contract.name}: ${reminder.schedule.body}`,
          type: 'contract_reminder',
          data: {
            contractId: reminder.contract.id,
            contractName: reminder.contract.name,
            reminderType: reminder.type,
            deadline: reminder.date.toISOString(),
            priority: reminder.schedule.priority
          }
        });

        // Try to send push notification for critical reminders
        if (reminder.schedule.priority === 'critical' || reminder.schedule.priority === 'high') {
          try {
            await supabase.functions.invoke('push-delivery', {
              body: {
                user_ids: [userId],
                title: reminder.schedule.title,
                body: `${reminder.contract.name}: ${reminder.schedule.body}`,
                priority: reminder.schedule.priority,
                data: {
                  type: 'contract_reminder',
                  contractId: reminder.contract.id
                }
              }
            });
          } catch (pushError) {
            console.error('Push notification failed:', pushError);
          }
        }
      } catch (error) {
        console.error('Failed to create reminder:', error);
      }
    }

    return remindersToCreate.length;
  }, [contracts, userId]);

  // Create calendar events for contract deadlines
  const syncToCalendar = useCallback(async (contract: Contract) => {
    if (!userId || !contract.renewalDate) return;

    try {
      // Create renewal event
      const renewalEvent = {
        user_id: userId,
        title: `📋 Contract Renewal: ${contract.name}`,
        description: `Contract ${contract.autoRenews ? 'auto-renews' : 'expires'} on this date.\nProvider: ${contract.provider || 'N/A'}\nCost: ${contract.costAmount ? `€${contract.costAmount}` : 'N/A'}`,
        start_time: contract.renewalDate.toISOString(),
        end_time: new Date(contract.renewalDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour
        category: 'personal'
      };

      await supabase.from('events').upsert(renewalEvent, {
        onConflict: 'title,start_time,user_id'
      });

      // Create cancellation deadline event if auto-renews
      if (contract.autoRenews) {
        const cancellationDate = addDays(contract.renewalDate, -contract.cancellationNoticeDays);
        const cancellationEvent = {
          user_id: userId,
          title: `⚠️ Cancel Deadline: ${contract.name}`,
          description: `Last day to cancel ${contract.name} before auto-renewal.\nProvider: ${contract.provider || 'N/A'}`,
          start_time: cancellationDate.toISOString(),
          end_time: new Date(cancellationDate.getTime() + 60 * 60 * 1000).toISOString(),
          category: 'personal'
        };

        await supabase.from('events').upsert(cancellationEvent, {
          onConflict: 'title,start_time,user_id'
        });
      }

      // Update contract to mark calendar sync
      await supabase.from('contracts').update({
        last_reminded_at: new Date().toISOString()
      }).eq('id', contract.id).eq('user_id', userId);

      return true;
    } catch (error) {
      console.error('Failed to sync to calendar:', error);
      return false;
    }
  }, [userId]);

  // Sync all contracts to calendar
  const syncAllToCalendar = useCallback(async () => {
    const results = await Promise.all(
      contracts
        .filter(c => c.isActive && c.renewalDate)
        .map(contract => syncToCalendar(contract))
    );
    return results.filter(Boolean).length;
  }, [contracts, syncToCalendar]);

  // Check reminders on mount and daily
  useEffect(() => {
    if (!userId) return;

    // Initial check
    const timer = setTimeout(() => {
      checkAndScheduleReminders();
    }, 5000);

    // Daily check
    const dailyCheck = setInterval(() => {
      checkAndScheduleReminders();
    }, 24 * 60 * 60 * 1000); // Every 24 hours

    return () => {
      clearTimeout(timer);
      clearInterval(dailyCheck);
    };
  }, [userId, checkAndScheduleReminders]);

  return {
    checkAndScheduleReminders,
    syncToCalendar,
    syncAllToCalendar
  };
}
