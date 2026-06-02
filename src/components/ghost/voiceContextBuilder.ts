// Builds the `contextData` bag passed into the OpenAI realtime voice
// session. Pure transformation — extracted from GhostMode.tsx so it can
// be unit-tested and reasoned about independently. The exact shape is
// preserved 1:1 from the previous inline `useMemo` body.
import type { Task, CalendarEvent, Project } from '@/types/flux';
import type { Contact } from '@/hooks/useContacts';
import type { Contract } from '@/hooks/useContracts';
import type { HealthMetric, DailyHealthSummary } from '@/hooks/useAppleHealth';
import type { Habit, HabitLog } from '@/hooks/useHabits';
import type { Note } from '@/hooks/useNotes';
import type { Conversation } from '@/hooks/useDirectMessages';
import type { StartupIdea } from '@/hooks/useStartupIdeas';
import type { Email } from '@/hooks/useEmails';
import type { FamilyMember } from '@/hooks/useFamilyMembers';
import type { FamilyContext } from '@/hooks/useFamilyContext';
import type { ShoppingList } from '@/hooks/useShoppingLists';

export interface BuildVoiceContextInputs {
  tasks: Task[];
  events: CalendarEvent[];
  contacts: Contact[];
  contracts: Contract[];
  projects: Project[];
  healthMetrics: HealthMetric[];
  todaySummary: DailyHealthSummary | null;
  weeklyData: DailyHealthSummary[];
  healthConnected: boolean;
  habits: Habit[];
  habitLogs: HabitLog[];
  notes: Note[];
  conversations: Conversation[];
  startupIdeas: StartupIdea[];
  emailList: Email[];
  totalUnreadEmails: number;
  familyMembers: FamilyMember[];
  familyContext: FamilyContext;
  shoppingLists: ShoppingList[];
  now?: Date;
}

export function buildVoiceContextData(inputs: BuildVoiceContextInputs) {
  const {
    tasks,
    events,
    contacts,
    contracts,
    projects,
    healthMetrics,
    todaySummary,
    weeklyData,
    healthConnected,
    habits,
    habitLogs,
    notes,
    conversations,
    startupIdeas,
    emailList,
    totalUnreadEmails,
    familyMembers,
    familyContext,
    shoppingLists,
    now = new Date(),
  } = inputs;

  const todayStr = now.toISOString().split('T')[0];
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Filter tasks
  const pendingTasks = tasks.filter(t => !t.completed && !t.trashed);
  const overdueTasks = pendingTasks.filter(t => t.dueDate && t.dueDate < now);
  const todayTasks = pendingTasks.filter(t => {
    if (!t.dueDate) return false;
    return t.dueDate.toISOString().split('T')[0] === todayStr;
  });
  const upcomingTasks = pendingTasks.filter(t => {
    if (!t.dueDate) return false;
    return t.dueDate > now && t.dueDate <= nextWeek;
  });

  // Filter events for next 7 days
  const upcomingEvents = events.filter(e => {
    return e.startTime >= now && e.startTime <= nextWeek;
  }).slice(0, 10);

  // Get key contacts (due for follow-up or recently added)
  const contactsDue = contacts.filter(c =>
    c.nextContactDue && c.nextContactDue <= now
  ).slice(0, 5);

  // Get active contracts with upcoming renewals
  const activeContracts = contracts.filter(c => c.isActive);
  const contractsWithRenewals = activeContracts.filter(c => {
    if (!c.renewalDate) return false;
    return c.renewalDate <= nextWeek;
  }).slice(0, 5);

  // Active projects
  const activeProjects = projects.filter(p => !p.isArchived);

  // All tasks for voice command matching (include id)
  const allTasks = tasks.filter(t => !t.trashed).map(t => ({
    id: t.id,
    title: t.title,
    category: String(t.category),
    priority: String(t.priority),
    dueDate: t.dueDate?.toISOString() || null,
    completed: t.completed,
    projectId: t.projectId || null,
  }));

  // All events for matching
  const allEvents = events.map(e => ({
    id: e.id,
    title: e.title,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
    location: e.location || null,
  }));

  // All contacts for matching (include familyRelationship for voice commands like "call my wife")
  const allContacts = contacts.slice(0, 100).map(c => ({
    id: c.id,
    name: c.name,
    company: c.company || null,
    role: c.role || null,
    city: c.city || null,
    country: c.country || null,
    contactType: c.contactType,
    personalTier: c.personalTier || null,
    businessLevel: c.businessLevel || null,
    notes: c.notes || null,
    tags: c.tags || [],
    phone: c.phone || null,
    email: c.email || null,
    nextContactDue: c.nextContactDue?.toISOString() || null,
    lastContactedAt: c.lastContactedAt?.toISOString() || null,
    familyRelationship: c.familyRelationship || null,
  }));

  // All contracts for matching
  const allContracts = activeContracts.map(c => ({
    id: c.id,
    name: c.name,
    provider: c.provider || null,
    category: String(c.category),
    costAmount: c.costAmount || null,
    costFrequency: c.costFrequency || null,
    renewalDate: c.renewalDate?.toISOString() || null,
    autoRenews: c.autoRenews,
    isActive: c.isActive,
    notes: c.notes || null,
  }));

  // All projects for matching
  const allProjects = activeProjects.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description || null,
    color: p.color,
  }));

  // Health data for AI access - include all available metrics
  const healthData = {
    isConnected: healthConnected,
    todaySummary: todaySummary ? {
      date: todaySummary.date,
      steps: todaySummary.steps,
      calories: todaySummary.calories,
      activeMinutes: todaySummary.activeMinutes,
      sleepHours: todaySummary.sleepHours,
      heartRateAvg: todaySummary.heartRateAvg,
      weight: todaySummary.weight,
      waterIntake: todaySummary.waterIntake,
      restingHeartRate: todaySummary.restingHeartRate,
      hrv: todaySummary.hrv,
      respiratoryRate: todaySummary.respiratoryRate,
      bloodOxygen: todaySummary.bloodOxygen,
      bloodPressureSystolic: todaySummary.bloodPressureSystolic,
      bloodPressureDiastolic: todaySummary.bloodPressureDiastolic,
      distance: todaySummary.distance,
      flightsClimbed: todaySummary.flightsClimbed,
      bodyFat: todaySummary.bodyFat,
      mindfulnessMinutes: todaySummary.mindfulnessMinutes,
      sleepStartTime: todaySummary.sleepStartTime,
      sleepEndTime: todaySummary.sleepEndTime,
      sleepRemMinutes: todaySummary.sleepRemMinutes,
      sleepDeepMinutes: todaySummary.sleepDeepMinutes,
      sleepCoreMinutes: todaySummary.sleepCoreMinutes,
      sleepAwakeMinutes: todaySummary.sleepAwakeMinutes,
      sleepEfficiency: todaySummary.sleepEfficiency,
      sleepInBedMinutes: todaySummary.sleepInBedMinutes,
    } : null,
    weeklyData: weeklyData.map(d => ({
      date: d.date,
      steps: d.steps,
      calories: d.calories,
      activeMinutes: d.activeMinutes,
      sleepHours: d.sleepHours,
      heartRateAvg: d.heartRateAvg,
      // Include sleep details in weekly data too. These fields aren't on
      // DailyHealthSummary's static type — they're attached by upstream
      // aggregation. Cast through the extended type to preserve runtime behavior.
      sleepRemMinutes: (d as DailyHealthSummary & Record<string, unknown>).sleepRemMinutes as number | undefined,
      sleepDeepMinutes: (d as DailyHealthSummary & Record<string, unknown>).sleepDeepMinutes as number | undefined,
      sleepCoreMinutes: (d as DailyHealthSummary & Record<string, unknown>).sleepCoreMinutes as number | undefined,
      sleepAwakeMinutes: (d as DailyHealthSummary & Record<string, unknown>).sleepAwakeMinutes as number | undefined,
      sleepEfficiency: (d as DailyHealthSummary & Record<string, unknown>).sleepEfficiency as number | undefined,
      hrv: (d as DailyHealthSummary & Record<string, unknown>).hrv as number | undefined,
      restingHeartRate: (d as DailyHealthSummary & Record<string, unknown>).restingHeartRate as number | undefined,
    })),
    recentMetrics: healthMetrics.slice(0, 100).map(m => ({
      type: m.metric_type,
      value: m.value,
      unit: m.unit,
      recordedAt: m.recorded_at,
      source: m.source,
    })),
  };

  // Habit data for AI access
  const habitData = {
    habits: habits.map(h => ({
      id: h.id,
      name: h.name,
      description: h.description,
      icon: h.icon,
      frequency: h.frequency,
      targetCount: h.targetCount,
      isActive: h.isActive,
    })),
    recentLogs: habitLogs.slice(0, 50).map(l => ({
      habitId: l.habitId,
      date: l.logDate.toISOString().split('T')[0],
      completedCount: l.completedCount,
    })),
  };

  // Notes data for AI access
  const notesData = notes.slice(0, 50).map(n => ({
    id: n.id,
    title: n.title,
    contentPreview: n.content.substring(0, 100),
    tags: n.tags,
    isPinned: n.isPinned,
    updatedAt: n.updatedAt.toISOString(),
  }));

  // Conversations data for AI access (who can receive messages)
  const conversationPartners = conversations.map(c => ({
    partnerId: c.partnerId,
    partnerName: c.partnerName,
    partnerEmail: c.partnerEmail,
  }));

  return {
    allTasks,
    allEvents,
    allContacts,
    allContracts,
    allProjects,
    healthData,
    habitData,
    notesData,
    conversationPartners,
    overdueTasks: overdueTasks.slice(0, 5).map(t => ({
      title: t.title,
      category: String(t.category),
      priority: String(t.priority),
      dueDate: t.dueDate?.toISOString() || null,
    })),
    todayTasks: todayTasks.slice(0, 5).map(t => ({
      title: t.title,
      category: String(t.category),
      priority: String(t.priority),
      dueDate: t.dueDate?.toISOString() || null,
    })),
    upcomingTasks: upcomingTasks.slice(0, 5).map(t => ({
      title: t.title,
      category: String(t.category),
      priority: String(t.priority),
      dueDate: t.dueDate?.toISOString() || null,
    })),
    upcomingEvents: upcomingEvents.map(e => ({
      title: e.title,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      location: e.location || null,
      category: e.category || null,
    })),
    contactsDue: contactsDue.map(c => ({
      name: c.name,
      company: c.company || null,
      role: c.role || null,
      nextContactDue: c.nextContactDue?.toISOString() || null,
    })),
    contractsWithRenewals: contractsWithRenewals.map(c => ({
      name: c.name,
      category: String(c.category),
      renewalDate: c.renewalDate?.toISOString() || null,
      costAmount: c.costAmount || null,
      costFrequency: c.costFrequency || null,
    })),
    totalPendingTasks: pendingTasks.length,
    totalOverdue: overdueTasks.length,
    totalEvents: events.length,
    totalContacts: contacts.length,
    totalContracts: activeContracts.length,
    totalProjects: activeProjects.length,
    totalHabits: habits.length,
    totalNotes: notes.length,
    startupIdeas: startupIdeas.map(idea => ({
      id: idea.id,
      name: idea.name,
      description: idea.description,
      status: idea.status,
      problem_statement: idea.problem_statement,
      target_audience: idea.target_audience,
      created_at: idea.created_at,
    })),
    unreadEmails: emailList
      .filter(e => !e.is_read)
      .slice(0, 10)
      .map(e => ({
        subject: e.subject,
        from: e.from_name || e.from_email,
        from_email: e.from_email,
        gmail_message_id: e.gmail_message_id,
        thread_id: e.thread_id,
        snippet: e.snippet,
        category: e.category,
        priority: e.priority_score,
        receivedAt: e.received_at,
      })),
    totalUnreadEmails,
    familyMembers: familyMembers.map(m => ({
      name: m.name,
      relationship: m.relationship,
      age: m.birth_date
        ? Math.floor((Date.now() - new Date(m.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null,
      school: m.attends_school ? m.school_name : null,
      grade: m.school_grade,
      kindergarten: m.attends_kindergarten ? m.kindergarten_name : null,
      activities: (m.activities || []).map(a => ({
        name: a.name,
        schedule: a.schedule,
        location: a.location,
      })),
      allergies: m.allergies || [],
      medicalNotes: m.medical_notes,
    })),
    familySchedule: {
      todayEvents: familyContext.schedule.todayEvents.map(e => ({
        title: e.title,
        startTime: e.start_time,
        endTime: e.end_time,
        location: e.location,
      })),
      tomorrowEvents: familyContext.schedule.tomorrowEvents.map(e => ({
        title: e.title,
        startTime: e.start_time,
        location: e.location,
      })),
      upcomingBirthdays: familyContext.schedule.upcomingBirthdays,
    },
    shoppingLists: shoppingLists
      .filter(l => !l.is_template && !l.is_completed)
      .map(l => ({
        id: l.id,
        name: l.name,
        category: l.category,
        dueDate: l.due_date,
      })),
  };
}
