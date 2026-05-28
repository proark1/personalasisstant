import { Contact } from '@/hooks/useContacts';
import { UserProfile, Contract } from '@/hooks/useSmartContext';
import { Email } from '@/hooks/useEmails';
import { Note } from '@/hooks/useNotes';
import { FamilyMember } from '@/hooks/useFamilyMembers';
import { ShoppingList } from '@/hooks/useShoppingLists';
import { moduleHealth, type ModuleId } from './moduleHealth';

// Keyword categories for smart context injection. Kept broad (with common
// synonyms + German) so intent is caught even when the user doesn't use the
// "canonical" word — the previous lists were narrow enough to miss obvious
// phrasings (e.g. "subscriptions", "bill", "feeling swamped").
const CONTEXT_TRIGGERS = {
  email: ['email', 'inbox', 'unread', 'mail', 'message from', 'reply to', 'e-mail', 'gmail', 'outlook', 'respond to', 'forward', 'cc ', 'sender'],
  notes: ['note', 'notes', 'wrote', 'saved', 'remember', 'jot down', 'write down', 'notiz', 'memo', 'i noted', 'remind me what'],
  habits: ['habit', 'streak', 'routine', 'consistency', 'daily routine', 'gewohnheit', 'track', 'every day', 'keep up', 'stay on track'],
  family: ['family', 'kids', 'children', 'school', 'kindergarten', 'wife', 'husband', 'son', 'daughter', 'spouse', 'kinder', 'schule', 'familie', 'partner', 'mom', 'dad', 'mother', 'father', 'parents', 'household'],
  shopping: ['shopping', 'groceries', 'buy', 'shopping list', 'einkauf', 'einkaufen', 'pick up', 'store', 'supermarket', 'need to get'],
  contacts: ['who do i know', 'contact', 'investor', 'developer', 'designer', 'advisor', 'mentor', 'engineer', 'sales', 'marketing', 'lawyer', 'legal', 'accountant', 'finance', 'meeting with', 'call with', 'reach out', 'follow up with', 'introduce', 'connect me', 'recruiter', 'client', 'colleague'],
  contracts: ['contract', 'subscription', 'subscriptions', 'cost', 'renewal', 'renew', 'cancel', 'how much', 'spending', 'budget', 'expense', 'vertrag', 'kosten', 'bill', 'bills', 'invoice', 'payment', 'monthly fee', 'plan', 'provider'],
  cooking: ['recipe', 'meal', 'cook', 'dinner', 'lunch', 'breakfast', 'essen', 'kochen', 'rezept', 'food', 'eat', 'menu'],
  // Emotional / overload signals — when present, surface the user's habits &
  // routines so Dori can reason about wellbeing, not just tasks.
  wellbeing: ['stressed', 'overwhelmed', 'overwhelm', 'burned out', 'burnt out', 'burnout', 'exhausted', 'tired', 'anxious', 'anxiety', "can't focus", 'cant focus', 'swamped', 'too much', 'struggling', 'no energy', 'gestresst', 'überfordert', 'erschöpft', 'müde'],
  location: [] as string[], // Filled dynamically from contact cities
};

export type ContextIntent = keyof typeof CONTEXT_TRIGGERS;

/**
 * Pure, testable intent detector — returns which context categories a message
 * touches. Exposed for unit testing and reuse outside the payload builder.
 */
export function detectContextIntents(message: string): ContextIntent[] {
  const lower = message.toLowerCase();
  return (Object.keys(CONTEXT_TRIGGERS) as ContextIntent[]).filter(
    (cat) => cat !== 'location' && CONTEXT_TRIGGERS[cat].some((kw) => lower.includes(kw)),
  );
}

const LOCATIONS = [
  'dubai', 'uae', 'london', 'uk', 'new york', 'nyc', 'usa', 'berlin', 'germany',
  'paris', 'france', 'singapore', 'hong kong', 'tokyo', 'japan', 'san francisco',
  'los angeles', 'chicago', 'miami', 'boston', 'seattle', 'austin', 'denver',
  'toronto', 'vancouver', 'sydney', 'melbourne', 'amsterdam', 'zurich', 'switzerland',
  'portugal', 'lisbon', 'spain', 'madrid', 'barcelona', 'italy', 'rome', 'milan',
  'austria', 'vienna', 'poland', 'warsaw', 'czech', 'prague', 'hungary', 'budapest',
];

interface HabitSummary {
  name: string;
  streak: number;
  isCompletedToday: boolean;
  frequency: string;
}

interface SmartPayload {
  userProfile?: UserProfile | null;
  statsSummary?: string;
  relevantContacts?: { name: string; role?: string; company?: string; city?: string; country?: string; tags?: string[]; email?: string }[];
  relevantContracts?: { name: string; provider?: string; category: string; costAmount?: number; costFrequency?: string; renewalDate?: string }[];
  emailSummary?: { subject: string; from: string; from_email?: string; gmail_message_id?: string; thread_id?: string; priority: string; snippet: string }[];
  notesSummary?: { title: string; snippet: string; tags: string[] }[];
  habitsSummary?: HabitSummary[];
  familyContext?: {
    members: { name: string; relationship: string; age: number | null; school?: string; activities: string[] }[];
    shoppingLists: { name: string; itemCount: number }[];
  };
  memories?: { type: string; key: string; value: string; category?: string }[];
  /**
   * Freshness metadata so the AI knows which slices may be stale.
   * Edge functions can decide to re-fetch when a module is degraded.
   */
  _meta?: {
    builtAt: number;
    moduleStatus: Partial<Record<ModuleId, string>>;
  };
}

function matchesCategory(msg: string, keywords: string[]): boolean {
  return keywords.some(kw => msg.includes(kw));
}

function matchesLocation(msg: string): string[] {
  return LOCATIONS.filter(loc => msg.includes(loc));
}

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function buildSmartPayload({
  message,
  userProfile,
  contacts,
  contracts,
  emails,
  notes,
  habits,
  familyMembers,
  shoppingLists,
  stats,
  memories,
}: {
  message: string;
  userProfile?: UserProfile | null;
  contacts?: Contact[];
  contracts?: Contract[];
  emails?: Email[];
  notes?: Note[];
  habits?: HabitSummary[];
  familyMembers?: FamilyMember[];
  shoppingLists?: ShoppingList[];
  stats?: { totalContacts: number; totalContracts: number; pendingTasks: number; upcomingEvents: number; unreadEmails: number; activeHabits: number };
  memories?: { type: string; key: string; value: string; category?: string }[];
}): SmartPayload {
  const lowerMsg = message.toLowerCase();
  const payload: SmartPayload = {};

  // TIER 1: Always send (tiny)
  if (userProfile) {
    payload.userProfile = userProfile;
  }

  if (stats) {
    const parts = [];
    if (stats.totalContacts > 0) parts.push(`${stats.totalContacts} contacts`);
    if (stats.totalContracts > 0) parts.push(`${stats.totalContracts} contracts`);
    if (stats.pendingTasks > 0) parts.push(`${stats.pendingTasks} pending tasks`);
    if (stats.upcomingEvents > 0) parts.push(`${stats.upcomingEvents} upcoming events`);
    if (stats.unreadEmails > 0) parts.push(`${stats.unreadEmails} unread emails`);
    if (stats.activeHabits > 0) parts.push(`${stats.activeHabits} active habits`);
    payload.statsSummary = parts.join(', ');
  }

  // TIER 2: Smart-filtered (only when relevant)

  // Also check for family member names dynamically
  const familyNames = (familyMembers || []).map(m => m.name.toLowerCase());
  const mentionsFamilyMember = familyNames.some(name => lowerMsg.includes(name));

  // Contacts — triggered by location, role keywords, or direct name mention
  const detectedLocations = matchesLocation(lowerMsg);
  const wantsContacts = matchesCategory(lowerMsg, CONTEXT_TRIGGERS.contacts) || detectedLocations.length > 0;

  if (wantsContacts && contacts && contacts.length > 0) {
    const filtered = contacts.filter(c => {
      // Match by location
      if (detectedLocations.length > 0) {
        const contactLoc = [c.city, c.country].filter(Boolean).join(' ').toLowerCase();
        if (detectedLocations.some(loc => contactLoc.includes(loc))) return true;
      }
      // Match by name mention
      if (c.name && lowerMsg.includes(c.name.toLowerCase())) return true;
      // Match by role keywords
      if (c.company && lowerMsg.includes(c.company.toLowerCase())) return true;
      // Match by role/type keywords
      const contactText = [c.role, c.company, ...c.tags].filter(Boolean).join(' ').toLowerCase();
      const roleKeywords = [...CONTEXT_TRIGGERS.contacts];
      if (roleKeywords.some(kw => contactText.includes(kw))) return true;
      return false;
    }).slice(0, 10);

    if (filtered.length > 0) {
      payload.relevantContacts = filtered.map(c => ({
        name: c.name,
        role: c.role || undefined,
        company: c.company || undefined,
        city: c.city || undefined,
        country: c.country || undefined,
        tags: c.tags.length > 0 ? c.tags : undefined,
        email: c.email || undefined,
      }));
    }
  }

  // Contracts
  if (matchesCategory(lowerMsg, CONTEXT_TRIGGERS.contracts) && contracts && contracts.length > 0) {
    const filtered = contracts.filter(c => {
      if (!c.isActive) return false;
      // If asking about costs/renewal, include all active
      if (lowerMsg.includes('cost') || lowerMsg.includes('spending') || lowerMsg.includes('how much') || lowerMsg.includes('renewal')) return true;
      // Match by name/provider
      if (c.name && lowerMsg.includes(c.name.toLowerCase())) return true;
      if (c.provider && lowerMsg.includes(c.provider.toLowerCase())) return true;
      return false;
    }).slice(0, 10);

    if (filtered.length > 0) {
      payload.relevantContracts = filtered.map(c => ({
        name: c.name,
        provider: c.provider || undefined,
        category: c.category,
        costAmount: c.costAmount || undefined,
        costFrequency: c.costFrequency || undefined,
        renewalDate: c.renewalDate || undefined,
      }));
    }
  }

  // Emails
  if (matchesCategory(lowerMsg, CONTEXT_TRIGGERS.email) && emails && emails.length > 0) {
    const unread = emails.filter(e => !e.is_read && !e.user_archived).slice(0, 5);
    if (unread.length > 0) {
      payload.emailSummary = unread.map(e => ({
        subject: e.subject || '(no subject)',
        from: e.from_name || e.from_email,
        from_email: e.from_email || undefined,
        gmail_message_id: e.gmail_message_id || undefined,
        thread_id: e.thread_id || undefined,
        priority: e.priority_score <= 2 ? 'high' : e.priority_score <= 4 ? 'medium' : 'low',
        snippet: (e.snippet || '').slice(0, 80),
      }));
    }
  }

  // Notes
  if (matchesCategory(lowerMsg, CONTEXT_TRIGGERS.notes) && notes && notes.length > 0) {
    payload.notesSummary = notes.slice(0, 5).map(n => ({
      title: n.title,
      snippet: n.content.slice(0, 80),
      tags: n.tags,
    }));
  }

  // Habits — also surfaced when the user signals stress/overwhelm, so Dori
  // can reason about routines and wellbeing rather than only the task list.
  if ((matchesCategory(lowerMsg, CONTEXT_TRIGGERS.habits) || matchesCategory(lowerMsg, CONTEXT_TRIGGERS.wellbeing)) && habits && habits.length > 0) {
    payload.habitsSummary = habits.slice(0, 10);
  }

  // Family context
  if ((matchesCategory(lowerMsg, CONTEXT_TRIGGERS.family) || matchesCategory(lowerMsg, CONTEXT_TRIGGERS.shopping) || matchesCategory(lowerMsg, CONTEXT_TRIGGERS.cooking) || mentionsFamilyMember) && familyMembers && familyMembers.length > 0) {
    payload.familyContext = {
      members: familyMembers.map(m => ({
        name: m.name,
        relationship: m.relationship,
        age: calculateAge(m.birth_date),
        school: m.school_name || m.kindergarten_name || undefined,
        activities: (m.activities || []).map(a => a.name),
      })),
      shoppingLists: (shoppingLists || []).filter(l => !l.is_completed && !l.is_template).map(l => ({
        name: l.name,
        itemCount: 0, // We don't fetch item counts to save queries
      })),
    };
  }

  // Always include memories (Tier 1 — always-on)
  if (memories && memories.length > 0) {
    payload.memories = memories;
  }

  // Freshness metadata: tells the edge function which slices were sourced
  // from healthy modules vs stale/failed ones, so it can decide whether
  // to trust the snapshot or re-fetch on its side.
  const trackedModules: ModuleId[] = [
    'tasks', 'events', 'contacts', 'contracts', 'emails',
    'notes', 'habits', 'health', 'family', 'shopping',
  ];
  const moduleStatus: Partial<Record<ModuleId, string>> = {};
  trackedModules.forEach((m) => {
    const s = moduleHealth.status(m);
    if (s !== 'unknown' && s !== 'ok') {
      moduleStatus[m] = s;
    }
  });
  payload._meta = {
    builtAt: Date.now(),
    moduleStatus,
  };

  return payload;
}
