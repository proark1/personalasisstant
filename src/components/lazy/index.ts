// Lazy loading utilities
export { 
  LazyLoader, 
  DefaultFallback, 
  PageFallback, 
  PanelFallback,
  withLazyLoading 
} from './LazyLoader';

// Feature chunk lazy imports
import { lazy } from 'react';

// ============================================
// PAGE COMPONENTS - Route-level code splitting
// ============================================
export const LazyIndex = lazy(() => import('@/pages/Index'));
export const LazyAuth = lazy(() => import('@/pages/Auth'));
export const LazyDashboard = lazy(() => import('@/pages/Dashboard'));
export const LazyContactsPage = lazy(() => import('@/pages/ContactsPage'));
export const LazyContractsPage = lazy(() => import('@/pages/Contracts'));
export const LazyNotFound = lazy(() => import('@/pages/NotFound'));

// ============================================
// FEATURE CHUNKS - Lazy loaded by feature area
// ============================================

// Calendar feature
export const LazyCalendarPanel = lazy(() => 
  import('@/components/calendar/CalendarPanel').then(m => ({ default: m.CalendarPanel }))
);
export const LazyCalendarHubPanel = lazy(() => 
  import('@/components/calendar/CalendarHubPanel').then(m => ({ default: m.CalendarHubPanel }))
);
export const LazyMonthCalendarView = lazy(() => 
  import('@/components/calendar/MonthCalendarView').then(m => ({ default: m.MonthCalendarView }))
);

// Family feature
export const LazyFamilyPanel = lazy(() => 
  import('@/components/family/FamilyPanel').then(m => ({ default: m.FamilyPanel }))
);
export const LazyMealPlanningPanel = lazy(() => 
  import('@/components/family/MealPlanningPanel').then(m => ({ default: m.MealPlanningPanel }))
);
export const LazyBudgetTrackingPanel = lazy(() => 
  import('@/components/family/BudgetTrackingPanel').then(m => ({ default: m.BudgetTrackingPanel }))
);
export const LazyHealthTrackingPanel = lazy(() => 
  import('@/components/family/HealthTrackingPanel').then(m => ({ default: m.HealthTrackingPanel }))
);
export const LazyDocumentStoragePanel = lazy(() => 
  import('@/components/family/DocumentStoragePanel').then(m => ({ default: m.DocumentStoragePanel }))
);
export const LazyShoppingListsPanel = lazy(() => 
  import('@/components/family/ShoppingListsPanel').then(m => ({ default: m.ShoppingListsPanel }))
);

// Chat feature
export const LazyChatPanel = lazy(() => 
  import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel }))
);
export const LazyTeamChatPanel = lazy(() => 
  import('@/components/chat/TeamChatPanel').then(m => ({ default: m.TeamChatPanel }))
);

// Tasks feature
export const LazyTaskList = lazy(() => 
  import('@/components/tasks/TaskList').then(m => ({ default: m.TaskList }))
);
export const LazyKanbanBoard = lazy(() => 
  import('@/components/tasks/KanbanBoard').then(m => ({ default: m.KanbanBoard }))
);

// Habits feature
export const LazyHabitsPanel = lazy(() => 
  import('@/components/habits/HabitsPanel').then(m => ({ default: m.HabitsPanel }))
);

// Notes feature
export const LazyNotesPanel = lazy(() => 
  import('@/components/notes/NotesPanel').then(m => ({ default: m.NotesPanel }))
);

// Contacts feature
export const LazyContactsPanel = lazy(() => 
  import('@/components/contacts/ContactsPanel').then(m => ({ default: m.ContactsPanel }))
);

// Contracts feature
export const LazyContractsPanel = lazy(() => 
  import('@/components/contracts/ContractsPanel').then(m => ({ default: m.ContractsPanel }))
);

// Dashboard feature
export const LazyDashboardPanel = lazy(() => 
  import('@/components/dashboard/DashboardPanel').then(m => ({ default: m.DashboardPanel }))
);

// Health feature
export const LazyHealthHubPanel = lazy(() => 
  import('@/components/health/HealthHubPanel').then(m => ({ default: m.HealthHubPanel }))
);

// Focus feature
export const LazyTodayFocusPanel = lazy(() => 
  import('@/components/focus/TodayFocusPanel').then(m => ({ default: m.TodayFocusPanel }))
);

// Insights feature
export const LazyWeeklyInsightsPanel = lazy(() => 
  import('@/components/insights/WeeklyInsightsPanel').then(m => ({ default: m.WeeklyInsightsPanel }))
);
export const LazyLifePatternsDashboard = lazy(() => 
  import('@/components/insights/LifePatternsDashboard').then(m => ({ default: m.LifePatternsDashboard }))
);

// Admin feature
export const LazyAdminAnalyticsPanel = lazy(() => 
  import('@/components/admin/AdminAnalyticsPanel').then(m => ({ default: m.AdminAnalyticsPanel }))
);

// Settings feature
export const LazySettingsPanel = lazy(() => 
  import('@/components/settings/SettingsPanel').then(m => ({ default: m.SettingsPanel }))
);

// AI/Assistant feature
export const LazyDoriPanel = lazy(() => 
  import('@/components/assistant/DoriPanel').then(m => ({ default: m.DoriPanel }))
);
export const LazyAICommandPanel = lazy(() => 
  import('@/components/ai/AICommandPanel').then(m => ({ default: m.AICommandPanel }))
);

// Ghost mode
export const LazyGhostMode = lazy(() => 
  import('@/components/ghost/GhostMode').then(m => ({ default: m.GhostMode }))
);

// Activity feature
export const LazyActivityPanel = lazy(() => 
  import('@/components/activity/ActivityPanel').then(m => ({ default: m.ActivityPanel }))
);

// Location feature
export const LazyLocationRemindersPanel = lazy(() => 
  import('@/components/location/LocationRemindersPanel').then(m => ({ default: m.LocationRemindersPanel }))
);

// Calling feature
export const LazyCallHistory = lazy(() => 
  import('@/components/calling/CallHistory').then(m => ({ default: m.CallHistory }))
);
export const LazyCallRecordings = lazy(() => 
  import('@/components/calling/CallRecordings').then(m => ({ default: m.CallRecordings }))
);

// Projects feature  
export const LazyProjectManager = lazy(() => 
  import('@/components/projects/ProjectManager').then(m => ({ default: m.ProjectManager }))
);

// Capture feature
export const LazyBrainDumpInbox = lazy(() => 
  import('@/components/capture/BrainDumpInbox').then(m => ({ default: m.BrainDumpInbox }))
);

// Notifications feature
export const LazyNotificationCenter = lazy(() => 
  import('@/components/notifications/NotificationCenter').then(m => ({ default: m.NotificationCenter }))
);
