import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Contact } from './useContacts';
import { differenceInDays, addDays, format, isPast, isToday } from 'date-fns';

interface UseSmartContactRemindersProps {
  contacts: Contact[];
  userId?: string;
  enabled?: boolean;
}

// Reminder stages in days before due
const REMINDER_STAGES = [7, 3, 1, 0];

export function useSmartContactReminders({
  contacts,
  userId,
  enabled = true,
}: UseSmartContactRemindersProps) {
  const hasCheckedRef = useRef(false);

  const createReminders = useCallback(async () => {
    if (!enabled || !userId || contacts.length === 0) return;

    const now = new Date();
    const notifications: Array<{
      user_id: string;
      type: string;
      title: string;
      message: string;
      data: Record<string, unknown>;
    }> = [];

    // Get existing notifications to avoid duplicates
    const { data: existingNotifications } = await supabase
      .from('user_notifications')
      .select('data')
      .eq('user_id', userId)
      .eq('type', 'contact_reminder')
      .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

    const existingContactIds = new Set(
      (existingNotifications || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((n: any) => (n.data as { contact_id?: string } | null)?.contact_id)
        .filter(Boolean)
    );

    for (const contact of contacts) {
      if (!contact.nextContactDue) continue;
      if (existingContactIds.has(contact.id)) continue;

      const daysUntilDue = differenceInDays(contact.nextContactDue, now);
      const isPastDue = isPast(contact.nextContactDue);
      const isDueToday = isToday(contact.nextContactDue);

      // Check if we should send a reminder for this stage
      let shouldRemind = false;
      let reminderType = '';

      if (isPastDue) {
        const daysOverdue = -daysUntilDue;
        if (daysOverdue === 1 || daysOverdue === 3 || daysOverdue === 7) {
          shouldRemind = true;
          reminderType = 'overdue';
        }
      } else if (isDueToday) {
        shouldRemind = true;
        reminderType = 'due_today';
      } else if (REMINDER_STAGES.includes(daysUntilDue)) {
        shouldRemind = true;
        reminderType = 'upcoming';
      }

      if (!shouldRemind) continue;

      // Build notification message
      let title = '';
      let message = '';

      if (reminderType === 'overdue') {
        title = `📞 Overdue: Contact ${contact.name}`;
        message = `You're ${-daysUntilDue} days overdue to contact ${contact.name}. Time to reach out!`;
      } else if (reminderType === 'due_today') {
        title = `⏰ Today: Contact ${contact.name}`;
        message = `Today is the day to reach out to ${contact.name}!`;
      } else {
        title = `🔔 Upcoming: Contact ${contact.name}`;
        message = `Remember to contact ${contact.name} in ${daysUntilDue} days (${format(contact.nextContactDue, 'MMM d')}).`;
      }

      // Add context
      if (contact.company) {
        message += ` (${contact.company})`;
      }
      if (contact.notes) {
        message += `\n\nNote: ${contact.notes.slice(0, 100)}${contact.notes.length > 100 ? '...' : ''}`;
      }

      notifications.push({
        user_id: userId,
        type: 'contact_reminder',
        title,
        message,
        data: {
          contact_id: contact.id,
          contact_name: contact.name,
          reminder_type: reminderType,
          days_until_due: daysUntilDue,
        },
      });
    }

    // Insert all notifications
    if (notifications.length > 0) {
      const { error } = await supabase
        .from('user_notifications')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(notifications as any);

      if (error) {
        console.error('Error creating contact reminders:', error);
      } else {
        console.log(`Created ${notifications.length} contact reminders`);
      }
    }
  }, [contacts, userId, enabled]);

  // Run once on mount
  useEffect(() => {
    if (hasCheckedRef.current || !userId) return;
    
    const timer = setTimeout(() => {
      hasCheckedRef.current = true;
      createReminders();
    }, 3000);

    return () => clearTimeout(timer);
  }, [userId, createReminders]);

  // Sync upcoming contacts to calendar
  const syncToCalendar = useCallback(async () => {
    if (!userId) return;

    const now = new Date();
    const upcomingContacts = contacts.filter(c => {
      if (!c.nextContactDue) return false;
      const daysUntil = differenceInDays(c.nextContactDue, now);
      return daysUntil >= 0 && daysUntil <= 14;
    });

    for (const contact of upcomingContacts) {
      if (!contact.nextContactDue) continue;

      // Check if event already exists
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', userId)
        .ilike('title', `%Contact: ${contact.name}%`)
        .gte('start_time', contact.nextContactDue.toISOString().split('T')[0])
        .lt('start_time', addDays(contact.nextContactDue, 1).toISOString().split('T')[0]);

      if (existing && existing.length > 0) continue;

      // Create calendar event
      const startTime = new Date(contact.nextContactDue);
      startTime.setHours(10, 0, 0, 0); // Default to 10 AM

      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      await supabase.from('events').insert({
        user_id: userId,
        title: `📞 Contact: ${contact.name}`,
        description: contact.notes || `Time to reach out to ${contact.name}`,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        category: contact.contactType === 'business' ? 'business' : 'personal',
      });
    }
  }, [contacts, userId]);

  return {
    createReminders,
    syncToCalendar,
  };
}
