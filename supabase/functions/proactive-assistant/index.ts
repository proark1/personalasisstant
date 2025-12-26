import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProactiveSettings {
  user_id: string;
  enabled: boolean;
  forgotten_tasks_enabled: boolean;
  contract_renewals_enabled: boolean;
  contact_checkins_enabled: boolean;
  event_prep_enabled: boolean;
  habit_streaks_enabled: boolean;
  weekly_planning_enabled: boolean;
  weekly_planning_day: number;
  daily_review_enabled: boolean;
  calendar_overload_enabled: boolean;
  calendar_overload_threshold: number;
  forgotten_task_days: number;
  contact_checkin_days: number;
  contract_reminder_days: number[];
  habit_streak_warning_hours: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  push_notifications_enabled: boolean;
  in_app_notifications_enabled: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, trigger_type } = await req.json().catch(() => ({}));

    // If specific user_id provided, process just that user
    // Otherwise, process all users (for scheduled cron)
    let usersToProcess: string[] = [];
    
    if (user_id) {
      usersToProcess = [user_id];
    } else {
      // Get all users with proactive settings enabled
      const { data: settings } = await supabase
        .from('proactive_settings')
        .select('user_id')
        .eq('enabled', true);
      
      usersToProcess = settings?.map(s => s.user_id) || [];
      
      // Also get users without settings (they use defaults)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id');
      
      const allUsers = profiles?.map(p => p.user_id) || [];
      const usersWithSettings = new Set(usersToProcess);
      
      for (const u of allUsers) {
        if (!usersWithSettings.has(u)) {
          usersToProcess.push(u);
        }
      }
    }

    console.log(`Processing ${usersToProcess.length} users for proactive reminders`);

    const remindersCreated: any[] = [];
    const now = new Date();

    for (const userId of usersToProcess) {
      // Get user's settings or use defaults
      const { data: userSettings } = await supabase
        .from('proactive_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      const settings: ProactiveSettings = userSettings || {
        user_id: userId,
        enabled: true,
        forgotten_tasks_enabled: true,
        contract_renewals_enabled: true,
        contact_checkins_enabled: true,
        event_prep_enabled: true,
        habit_streaks_enabled: true,
        weekly_planning_enabled: true,
        weekly_planning_day: 0, // Sunday
        daily_review_enabled: true,
        calendar_overload_enabled: true,
        calendar_overload_threshold: 6,
        forgotten_task_days: 3,
        contact_checkin_days: 14,
        contract_reminder_days: [30, 14, 7, 3, 1],
        habit_streak_warning_hours: 4,
        quiet_hours_enabled: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        push_notifications_enabled: true,
        in_app_notifications_enabled: true,
      };

      if (!settings.enabled) continue;

      // Check quiet hours
      if (settings.quiet_hours_enabled) {
        const currentHour = now.getHours();
        const quietStart = parseInt(settings.quiet_hours_start?.split(':')[0] || '22');
        const quietEnd = parseInt(settings.quiet_hours_end?.split(':')[0] || '7');
        
        if (quietStart > quietEnd) {
          // Quiet hours span midnight
          if (currentHour >= quietStart || currentHour < quietEnd) {
            console.log(`User ${userId} is in quiet hours, skipping`);
            continue;
          }
        } else {
          if (currentHour >= quietStart && currentHour < quietEnd) {
            console.log(`User ${userId} is in quiet hours, skipping`);
            continue;
          }
        }
      }

      // Process each reminder type
      if (!trigger_type || trigger_type === 'forgotten_tasks') {
        if (settings.forgotten_tasks_enabled) {
          const reminders = await checkForgottenTasks(supabase, userId, settings.forgotten_task_days);
          remindersCreated.push(...reminders);
        }
      }

      if (!trigger_type || trigger_type === 'contract_renewals') {
        if (settings.contract_renewals_enabled) {
          const reminders = await checkContractRenewals(supabase, userId, settings.contract_reminder_days);
          remindersCreated.push(...reminders);
        }
      }

      if (!trigger_type || trigger_type === 'contact_checkins') {
        if (settings.contact_checkins_enabled) {
          const reminders = await checkContactCheckins(supabase, userId, settings.contact_checkin_days);
          remindersCreated.push(...reminders);
        }
      }

      if (!trigger_type || trigger_type === 'event_prep') {
        if (settings.event_prep_enabled) {
          const reminders = await checkUpcomingEvents(supabase, userId);
          remindersCreated.push(...reminders);
        }
      }

      if (!trigger_type || trigger_type === 'habit_streaks') {
        if (settings.habit_streaks_enabled) {
          const reminders = await checkHabitStreaks(supabase, userId, settings.habit_streak_warning_hours);
          remindersCreated.push(...reminders);
        }
      }

      if (!trigger_type || trigger_type === 'daily_review') {
        if (settings.daily_review_enabled) {
          const reminders = await checkDailyReview(supabase, userId);
          remindersCreated.push(...reminders);
        }
      }

      // Calendar Overload Detection
      if (!trigger_type || trigger_type === 'calendar_overload') {
        if (settings.calendar_overload_enabled) {
          const reminders = await checkCalendarOverload(supabase, userId, settings.calendar_overload_threshold);
          remindersCreated.push(...reminders);
        }
      }

      // Weekly Planning Sunday Prompt
      if (!trigger_type || trigger_type === 'weekly_planning') {
        if (settings.weekly_planning_enabled) {
          const reminders = await checkWeeklyPlanning(supabase, userId, settings.weekly_planning_day);
          remindersCreated.push(...reminders);
        }
      }

      // Smart Follow-Ups (Phase 4)
      if (!trigger_type || trigger_type === 'smart_followups') {
        const followUps = await generateSmartFollowUps(supabase, userId);
        remindersCreated.push(...followUps);
      }
    }

    // Trigger push delivery for new reminders
    if (remindersCreated.length > 0) {
      console.log(`Created ${remindersCreated.length} proactive reminders`);
      
      // Call push-delivery function for each reminder
      for (const reminder of remindersCreated) {
        try {
          await supabase.functions.invoke('push-delivery', {
            body: { reminder_id: reminder.id }
          });
        } catch (err) {
          console.error('Failed to trigger push delivery:', err);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        reminders_created: remindersCreated.length,
        users_processed: usersToProcess.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in proactive-assistant:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Check for forgotten tasks (no updates in X days)
async function checkForgottenTasks(supabase: any, userId: string, thresholdDays: number) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);
  
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, updated_at, last_reminded_at, priority')
    .eq('user_id', userId)
    .eq('completed', false)
    .eq('trashed', false)
    .lt('updated_at', thresholdDate.toISOString())
    .or(`last_reminded_at.is.null,last_reminded_at.lt.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`);

  const reminders: any[] = [];

  for (const task of tasks || []) {
    const daysSinceUpdate = Math.floor((Date.now() - new Date(task.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    
    const reminder = {
      user_id: userId,
      reminder_type: 'forgotten_task',
      trigger_entity_type: 'task',
      trigger_entity_id: task.id,
      title: '📝 Forgotten Task',
      message: `"${task.title}" hasn't been touched in ${daysSinceUpdate} days. Still working on it?`,
      priority: task.priority === 'high' ? 'high' : 'medium',
      scheduled_for: new Date().toISOString(),
      metadata: { task_title: task.title, days_since_update: daysSinceUpdate }
    };

    const { data: created, error } = await supabase
      .from('proactive_reminders')
      .insert(reminder)
      .select()
      .single();

    if (created) {
      reminders.push(created);
      
      // Update last_reminded_at on the task
      await supabase
        .from('tasks')
        .update({ last_reminded_at: new Date().toISOString() })
        .eq('id', task.id);
    }
  }

  return reminders;
}

// Check for contract renewals coming up
async function checkContractRenewals(supabase: any, userId: string, reminderDays: number[]) {
  const reminders: any[] = [];
  
  for (const days of reminderDays) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

    const { data: contracts } = await supabase
      .from('contracts')
      .select('id, name, renewal_date, end_date, cancellation_notice_days, last_reminded_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`renewal_date.gte.${startOfDay},end_date.gte.${startOfDay}`)
      .or(`renewal_date.lte.${endOfDay},end_date.lte.${endOfDay}`)
      .or(`last_reminded_at.is.null,last_reminded_at.lt.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`);

    for (const contract of contracts || []) {
      const relevantDate = contract.renewal_date || contract.end_date;
      if (!relevantDate) continue;

      const daysUntil = Math.ceil((new Date(relevantDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (Math.abs(daysUntil - days) > 1) continue; // Only match exact day range

      const priority = days <= 3 ? 'urgent' : days <= 7 ? 'high' : 'medium';
      
      const reminder = {
        user_id: userId,
        reminder_type: 'contract_renewal',
        trigger_entity_type: 'contract',
        trigger_entity_id: contract.id,
        title: days <= 1 ? '🚨 Contract Expires Tomorrow!' : `📋 Contract Renewal in ${days} Days`,
        message: `"${contract.name}" ${contract.renewal_date ? 'renews' : 'expires'} in ${daysUntil} days. ${contract.cancellation_notice_days ? `Cancellation requires ${contract.cancellation_notice_days} days notice.` : ''}`,
        priority,
        scheduled_for: new Date().toISOString(),
        metadata: { contract_name: contract.name, days_until: daysUntil }
      };

      const { data: created } = await supabase
        .from('proactive_reminders')
        .insert(reminder)
        .select()
        .single();

      if (created) {
        reminders.push(created);
        await supabase
          .from('contracts')
          .update({ last_reminded_at: new Date().toISOString() })
          .eq('id', contract.id);
      }
    }
  }

  return reminders;
}

// Check for contacts that haven't been reached out to
async function checkContactCheckins(supabase: any, userId: string, thresholdDays: number) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);
  
  const { data: contacts } = await supabase
    .from('user_contacts')
    .select('id, name, last_contacted_at, last_reminded_at, is_favorite')
    .eq('user_id', userId)
    .or(`last_contacted_at.is.null,last_contacted_at.lt.${thresholdDate.toISOString()}`)
    .or(`last_reminded_at.is.null,last_reminded_at.lt.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`);

  const reminders: any[] = [];

  for (const contact of contacts || []) {
    const daysSinceContact = contact.last_contacted_at 
      ? Math.floor((Date.now() - new Date(contact.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    const reminder = {
      user_id: userId,
      reminder_type: 'contact_checkin',
      trigger_entity_type: 'contact',
      trigger_entity_id: contact.id,
      title: '👋 Time to Reconnect',
      message: daysSinceContact 
        ? `You haven't reached out to ${contact.name} in ${daysSinceContact} days. Want to send a quick message?`
        : `It's been a while since you connected with ${contact.name}. Time for a check-in?`,
      priority: contact.is_favorite ? 'high' : 'medium',
      scheduled_for: new Date().toISOString(),
      metadata: { contact_name: contact.name, days_since_contact: daysSinceContact }
    };

    const { data: created } = await supabase
      .from('proactive_reminders')
      .insert(reminder)
      .select()
      .single();

    if (created) {
      reminders.push(created);
      await supabase
        .from('user_contacts')
        .update({ last_reminded_at: new Date().toISOString() })
        .eq('id', contact.id);
    }
  }

  return reminders;
}

// Check for upcoming events that need preparation
async function checkUpcomingEvents(supabase: any, userId: string) {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_time, location, description, last_reminded_at')
    .eq('user_id', userId)
    .gte('start_time', oneHourFromNow.toISOString())
    .lte('start_time', twoHoursFromNow.toISOString())
    .or(`last_reminded_at.is.null,last_reminded_at.lt.${new Date(Date.now() - 60 * 60 * 1000).toISOString()}`);

  const reminders: any[] = [];

  for (const event of events || []) {
    const minutesUntil = Math.round((new Date(event.start_time).getTime() - Date.now()) / (1000 * 60));
    
    const reminder = {
      user_id: userId,
      reminder_type: 'event_prep',
      trigger_entity_type: 'event',
      trigger_entity_id: event.id,
      title: '🗓️ Upcoming Event',
      message: `"${event.title}" starts in ${minutesUntil} minutes${event.location ? ` at ${event.location}` : ''}. Time to prepare!`,
      priority: 'high',
      scheduled_for: new Date().toISOString(),
      metadata: { event_title: event.title, minutes_until: minutesUntil, location: event.location }
    };

    const { data: created } = await supabase
      .from('proactive_reminders')
      .insert(reminder)
      .select()
      .single();

    if (created) {
      reminders.push(created);
      await supabase
        .from('events')
        .update({ last_reminded_at: new Date().toISOString() })
        .eq('id', event.id);
    }
  }

  return reminders;
}

// Check for habit streaks at risk
async function checkHabitStreaks(supabase: any, userId: string, warningHours: number) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: habits } = await supabase
    .from('habits')
    .select('id, name, icon, last_reminded_at')
    .eq('user_id', userId)
    .eq('is_active', true);

  const reminders: any[] = [];

  for (const habit of habits || []) {
    // Check if habit was logged today
    const { data: todayLog } = await supabase
      .from('habit_logs')
      .select('id')
      .eq('habit_id', habit.id)
      .eq('log_date', today)
      .single();

    if (todayLog) continue; // Already logged today

    // Check if we already reminded in the last few hours
    if (habit.last_reminded_at) {
      const hoursSinceReminder = (Date.now() - new Date(habit.last_reminded_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceReminder < warningHours) continue;
    }

    // Check the streak
    const { data: recentLogs } = await supabase
      .from('habit_logs')
      .select('log_date')
      .eq('habit_id', habit.id)
      .order('log_date', { ascending: false })
      .limit(7);

    const hasStreak = recentLogs && recentLogs.length > 0;
    const currentHour = new Date().getHours();
    
    // Only remind in evening hours (after 6 PM) or if it's a long streak
    if (currentHour < 18 && (!recentLogs || recentLogs.length < 3)) continue;

    const reminder = {
      user_id: userId,
      reminder_type: 'habit_streak',
      trigger_entity_type: 'habit',
      trigger_entity_id: habit.id,
      title: hasStreak ? '🔥 Streak at Risk!' : `${habit.icon || '✓'} Don't Forget`,
      message: hasStreak 
        ? `Your ${recentLogs.length}-day streak for "${habit.name}" is at risk! Log it before midnight.`
        : `Have you done "${habit.name}" today? Keep building the habit!`,
      priority: hasStreak && recentLogs.length >= 7 ? 'high' : 'medium',
      scheduled_for: new Date().toISOString(),
      metadata: { habit_name: habit.name, streak_length: recentLogs?.length || 0 }
    };

    const { data: created } = await supabase
      .from('proactive_reminders')
      .insert(reminder)
      .select()
      .single();

    if (created) {
      reminders.push(created);
      await supabase
        .from('habits')
        .update({ last_reminded_at: new Date().toISOString() })
        .eq('id', habit.id);
    }
  }

  return reminders;
}

// Check for calendar overload (too many meetings in a day)
async function checkCalendarOverload(supabase: any, userId: string, threshold: number) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Check tomorrow's events in evening, or today's events in morning
  const currentHour = now.getHours();
  let targetDate: Date;
  let dayLabel: string;
  
  if (currentHour >= 18) {
    // Evening: check tomorrow
    targetDate = tomorrow;
    dayLabel = 'Tomorrow';
  } else if (currentHour >= 7 && currentHour <= 10) {
    // Morning: check today
    targetDate = now;
    dayLabel = 'Today';
  } else {
    return []; // Only check in morning or evening
  }
  
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Count events for the target day
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_time, end_time')
    .eq('user_id', userId)
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString());

  const eventCount = events?.length || 0;
  
  if (eventCount < threshold) return [];

  // Check if we already reminded today
  const { data: existingReminder } = await supabase
    .from('proactive_reminders')
    .select('id')
    .eq('user_id', userId)
    .eq('reminder_type', 'calendar_overload')
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    .single();

  if (existingReminder) return [];

  // Calculate total meeting time
  let totalMinutes = 0;
  for (const event of events || []) {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
  }
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  // Find potential events to reschedule (lowest priority, non-recurring)
  const rescheduleHint = eventCount > threshold + 2 
    ? ' Consider rescheduling some non-critical meetings.'
    : '';

  const reminder = {
    user_id: userId,
    reminder_type: 'calendar_overload',
    trigger_entity_type: 'calendar',
    title: `📅 ${dayLabel} Looks Busy!`,
    message: `You have ${eventCount} meetings scheduled (${totalHours} hours total).${rescheduleHint} Take breaks between calls.`,
    priority: eventCount >= threshold + 3 ? 'high' : 'medium',
    scheduled_for: new Date().toISOString(),
    metadata: { 
      event_count: eventCount, 
      total_hours: totalHours,
      target_date: targetDate.toISOString().split('T')[0],
      day_label: dayLabel
    }
  };

  const { data: created } = await supabase
    .from('proactive_reminders')
    .insert(reminder)
    .select()
    .single();

  return created ? [created] : [];
}

// Check if user needs a daily review prompt
async function checkDailyReview(supabase: any, userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const currentHour = new Date().getHours();
  
  // Only prompt for evening review between 7-10 PM
  if (currentHour < 19 || currentHour > 22) return [];

  // Check if evening check-in already done today
  const { data: checkin } = await supabase
    .from('daily_checkins')
    .select('id')
    .eq('user_id', userId)
    .eq('checkin_date', today)
    .eq('checkin_type', 'evening')
    .single();

  if (checkin) return []; // Already checked in

  // Check if we already reminded today
  const { data: existingReminder } = await supabase
    .from('proactive_reminders')
    .select('id')
    .eq('user_id', userId)
    .eq('reminder_type', 'daily_review')
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    .single();

  if (existingReminder) return [];

  const reminder = {
    user_id: userId,
    reminder_type: 'daily_review',
    trigger_entity_type: 'checkin',
    title: '🌙 How Was Your Day?',
    message: "Take a moment to reflect on your day. What went well? What could be better tomorrow?",
    priority: 'low',
    scheduled_for: new Date().toISOString(),
    metadata: { date: today }
  };

  const { data: created } = await supabase
    .from('proactive_reminders')
    .insert(reminder)
    .select()
    .single();

  return created ? [created] : [];
}

// Generate smart follow-ups for stalled tasks, post-events, goals
async function generateSmartFollowUps(supabase: any, userId: string) {
  const reminders: any[] = [];
  const now = new Date();
  
  // 1. Stalled tasks (in progress for 2+ days without updates)
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const { data: stalledTasks } = await supabase
    .from('tasks')
    .select('id, title, updated_at, status')
    .eq('user_id', userId)
    .eq('completed', false)
    .eq('trashed', false)
    .eq('status', 'in_progress')
    .lt('updated_at', twoDaysAgo.toISOString());

  for (const task of stalledTasks || []) {
    // Check if we already have a follow-up for this
    const { data: existing } = await supabase
      .from('follow_up_queue')
      .select('id')
      .eq('entity_id', task.id)
      .eq('follow_up_type', 'stalled_task')
      .eq('status', 'pending')
      .single();

    if (!existing) {
      await supabase.from('follow_up_queue').insert({
        user_id: userId,
        entity_type: 'task',
        entity_id: task.id,
        follow_up_type: 'stalled_task',
        check_at: now.toISOString(),
        message_template: `"${task.title}" has been in progress for a while. Still working on it, or should we reschedule?`,
        context: { title: task.title },
        status: 'pending',
      });
    }
  }

  // 2. Post-event follow-ups (events that ended in the last hour)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const { data: recentEvents } = await supabase
    .from('events')
    .select('id, title, end_time')
    .eq('user_id', userId)
    .gte('end_time', oneHourAgo.toISOString())
    .lt('end_time', now.toISOString());

  for (const event of recentEvents || []) {
    const { data: existing } = await supabase
      .from('follow_up_queue')
      .select('id')
      .eq('entity_id', event.id)
      .eq('follow_up_type', 'post_event')
      .single();

    if (!existing) {
      await supabase.from('follow_up_queue').insert({
        user_id: userId,
        entity_type: 'event',
        entity_id: event.id,
        follow_up_type: 'post_event',
        check_at: now.toISOString(),
        message_template: `How did "${event.title}" go? Any action items to capture?`,
        context: { title: event.title },
        status: 'pending',
      });
    }
  }

  // 3. Goal progress checks (goals with deadlines in next 7 days)
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data: upcomingGoals } = await supabase
    .from('goals')
    .select('id, name, target_date, current_value, target_value')
    .eq('user_id', userId)
    .eq('is_completed', false)
    .lte('target_date', sevenDaysFromNow.toISOString().split('T')[0])
    .gte('target_date', now.toISOString().split('T')[0]);

  for (const goal of upcomingGoals || []) {
    const progress = goal.target_value > 0 
      ? Math.round((goal.current_value / goal.target_value) * 100)
      : 0;
    
    const daysLeft = Math.ceil((new Date(goal.target_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Only create follow-up if behind schedule (less than 80% with 7 days or less)
    if (progress < 80) {
      const { data: existing } = await supabase
        .from('follow_up_queue')
        .select('id')
        .eq('entity_id', goal.id)
        .eq('follow_up_type', 'goal_check')
        .eq('status', 'pending')
        .single();

      if (!existing) {
        await supabase.from('follow_up_queue').insert({
          user_id: userId,
          entity_type: 'goal',
          entity_id: goal.id,
          follow_up_type: 'goal_check',
          check_at: now.toISOString(),
          message_template: `You're ${progress}% to "${goal.name}" with ${daysLeft} days left. Need to adjust the target?`,
          context: { title: goal.name, progress, daysLeft },
          status: 'pending',
        });
      }
    }
  }

  return reminders;
}

// Check if it's time for weekly planning prompt (Sunday evening by default)
async function checkWeeklyPlanning(supabase: any, userId: string, planningDay: number = 0) {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday
  const currentHour = now.getHours();
  
  // Only prompt on the configured planning day, between 6-8 PM
  if (currentDay !== planningDay || currentHour < 18 || currentHour > 20) {
    return [];
  }

  // Check if we already reminded this week
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - currentDay);
  startOfWeek.setHours(0, 0, 0, 0);

  const { data: existingReminder } = await supabase
    .from('proactive_reminders')
    .select('id')
    .eq('user_id', userId)
    .eq('reminder_type', 'weekly_planning')
    .gte('created_at', startOfWeek.toISOString())
    .single();

  if (existingReminder) return [];

  // Get stats for the week
  const { data: tasksCompleted } = await supabase
    .from('tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('completed_at', startOfWeek.toISOString());

  const { data: upcomingTasks } = await supabase
    .from('tasks')
    .select('id, title, priority')
    .eq('user_id', userId)
    .eq('completed', false)
    .eq('trashed', false)
    .order('priority', { ascending: false })
    .limit(5);

  const { data: upcomingEvents } = await supabase
    .from('events')
    .select('id')
    .eq('user_id', userId)
    .gte('start_time', now.toISOString())
    .lte('start_time', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());

  const completedCount = tasksCompleted?.length || 0;
  const upcomingTaskCount = upcomingTasks?.length || 0;
  const eventCount = upcomingEvents?.length || 0;

  const topPriorities = upcomingTasks?.slice(0, 3).map((t: any) => t.title).join(', ') || 'none yet';

  const reminder = {
    user_id: userId,
    reminder_type: 'weekly_planning',
    trigger_entity_type: 'review',
    title: '📋 Plan Your Week',
    message: `Great week! You completed ${completedCount} tasks. Next week: ${upcomingTaskCount} tasks, ${eventCount} events. Top priorities: ${topPriorities}. Ready to plan?`,
    priority: 'medium',
    action_type: 'weekly_review',
    scheduled_for: new Date().toISOString(),
    metadata: {
      completed_this_week: completedCount,
      upcoming_tasks: upcomingTaskCount,
      upcoming_events: eventCount,
      top_priorities: topPriorities,
    }
  };

  const { data: created } = await supabase
    .from('proactive_reminders')
    .insert(reminder)
    .select()
    .single();

  return created ? [created] : [];
}
