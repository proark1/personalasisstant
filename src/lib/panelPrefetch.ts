/**
 * Panel chunk prefetch registry.
 *
 * StandardMode code-splits every feature panel with `lazy(() => import(...))`.
 * Vite resolves each dynamic import to a stable chunk, so calling the SAME
 * import() ahead of time (e.g. on sidebar hover/focus) warms the module
 * cache — the chunk is already in memory by the time the user clicks, which
 * removes the Suspense flash and makes navigation feel instant.
 *
 * Keep the import specifiers identical to the ones in StandardMode so they
 * map to the same chunk and dedupe.
 */
const PANEL_IMPORTS: Record<string, () => Promise<unknown>> = {
  assistant: () => import('../components/chat/ChatPanel'),
  tasks: () => import('../components/tasks/TaskList'),
  calendar: () => import('../components/calendar/CalendarPanel'),
  social: () => import('../components/social/SocialPanel'),
  dashboard: () => import('../components/dashboard/DashboardPanel'),
  projects: () => import('../components/projects/ProjectManager'),
  contacts: () => import('../components/contacts/ContactsPanel'),
  contracts: () => import('../components/contracts/ContractsPanel'),
  activity: () => import('../components/activity/ActivityFeed'),
  settings: () => import('../components/settings/SettingsPanelContent'),
  notes: () => import('../components/notes/NotesPanel'),
  habits: () => import('../components/habits/HabitsPanel'),
  family: () => import('../components/family/FamilyPanel'),
  cooking: () => import('../components/family/FamilyPanel'),
  islam: () => import('../components/islam/IslamEnhancedPanel'),
  properties: () => import('../components/property/PropertyPanel'),
  startups: () => import('../components/startup/StartupWorkspacePanel'),
  news: () => import('../components/news/TechNewsPanel'),
  email: () => import('../components/email/EmailPanel'),
  health: () => import('../components/health/HealthHubPanel'),
  finances: () => import('../components/finances/FinancesPanel'),
  travel: () => import('../components/travel/TravelPanel'),
  assets: () => import('../components/assets/AssetsPanel'),
  'personal-health': () => import('../components/health/PersonalHealthPanel'),
  'relationships-plus': () => import('../components/relationships/RelationshipsPlusPanel'),
  learning: () => import('../components/learning/LearningPanel'),
  journal: () => import('../components/journal/JournalPanel'),
  challenges: () => import('../components/gamification/ChallengesPanel'),
  'location-reminders': () => import('../components/location/LocationRemindersPanel'),
  'family-members': () => import('../components/family/FamilyMembersList'),
  'family-calendar': () => import('../components/family/FamilyCalendarView'),
  'child-mode': () => import('../components/family/ChildDashboard'),
  correlations: () => import('../components/insights/CorrelationsDashboard'),
  meetings: () => import('../components/assistant/MeetingBotsPanel'),
};

// Only warm each chunk once per session.
const prefetched = new Set<string>();

export function prefetchPanel(panelId: string | null | undefined): void {
  if (!panelId || prefetched.has(panelId)) return;
  const importer = PANEL_IMPORTS[panelId];
  if (!importer) return;
  prefetched.add(panelId);
  // Swallow errors — prefetch is best-effort; the Suspense boundary will
  // retry on the real navigation if this fails (e.g. offline).
  void importer().catch(() => prefetched.delete(panelId));
}
