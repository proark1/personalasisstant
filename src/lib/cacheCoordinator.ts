/**
 * CacheCoordinator — translates ModuleEvents into React-Query invalidations.
 *
 * Solves: only ~3 .invalidate() calls existed in the entire codebase versus
 * 200+ write paths. When module A writes, dependent modules B and C never
 * heard about it, so users saw stale data until manual refresh.
 *
 * This file is a single source of truth for "when X happens, refresh Y".
 * Adding a new dependency = one line in INVALIDATION_RULES.
 */

import type { QueryClient } from '@tanstack/react-query';
import { moduleBus, type ModuleEventName } from './moduleEventBus';

/**
 * Map of module event -> query keys to invalidate.
 * Query keys are matched by prefix (React Query default).
 *
 * Adding cross-module dependencies: just append the dependent query keys here.
 */
const INVALIDATION_RULES: Partial<Record<ModuleEventName, string[][]>> = {
  // Task changes ripple to weekly review, productivity stats, AI context.
  'task:created':   [['tasks'], ['weekly-review'], ['weekly-stats'], ['ai-context'], ['activity-feed'], ['life-score']],
  'task:updated':   [['tasks'], ['weekly-review'], ['weekly-stats'], ['ai-context'], ['activity-feed']],
  'task:completed': [['tasks'], ['weekly-review'], ['weekly-stats'], ['habits'], ['ai-context'], ['activity-feed'], ['life-score']],
  'task:deleted':   [['tasks'], ['weekly-review'], ['weekly-stats'], ['ai-context'], ['activity-feed']],
  'task:trashed':   [['tasks'], ['weekly-review'], ['ai-context'], ['activity-feed']],

  // Calendar/event changes affect day overview, AI context.
  'event:created':  [['events'], ['ai-context'], ['family-events'], ['activity-feed']],
  'event:updated':  [['events'], ['ai-context'], ['family-events']],
  'event:deleted':  [['events'], ['ai-context'], ['family-events']],
  'event:synced':   [['events'], ['calendar-connections']],

  // Contact updates affect AI context (smart payload uses contacts).
  'contact:created':   [['contacts'], ['ai-context'], ['contact-insights']],
  'contact:updated':   [['contacts'], ['ai-context'], ['contact-insights']],
  'contact:deleted':   [['contacts'], ['ai-context'], ['contact-insights']],
  'contact:contacted': [['contacts'], ['contact-reminders']],

  // Contracts feed AI context and finance widgets.
  'contract:created': [['contracts'], ['ai-context'], ['contract-reminders'], ['recurring-payments']],
  'contract:updated': [['contracts'], ['ai-context'], ['contract-reminders']],
  'contract:deleted': [['contracts'], ['ai-context'], ['contract-reminders']],
  'contract:renewed': [['contracts'], ['contract-reminders'], ['ai-context']],

  // Email feeds AI context, contact suggestions, contract detection.
  'email:synced':   [['emails'], ['ai-context'], ['contact-suggestions'], ['recurring-payments']],
  'email:read':     [['emails'], ['email-counts']],
  'email:replied':  [['emails'], ['activity-feed']],
  'email:archived': [['emails'], ['email-counts']],

  // Health metrics feed coach, life-correlator, weekly review.
  'health:metric-recorded': [['health-metrics'], ['health-insights'], ['life-score'], ['ai-context']],
  'health:checkin-logged':  [['health-checkins'], ['health-insights'], ['life-score'], ['weekly-review']],
  'health:synced':          [['apple-health'], ['health-metrics'], ['ai-context']],

  // Habits feed weekly review, gamification, life score.
  'habit:logged':         [['habits'], ['weekly-review'], ['gamification'], ['life-score'], ['ai-context']],
  'habit:created':        [['habits'], ['ai-context']],
  'habit:streak-broken':  [['habits'], ['gamification']],

  // Notes feed AI context.
  'note:created': [['notes'], ['ai-context'], ['global-search']],
  'note:updated': [['notes'], ['ai-context'], ['global-search']],
  'note:deleted': [['notes'], ['ai-context'], ['global-search']],

  // Family/shopping cross-link with AI context.
  'family:member-changed':  [['family-members'], ['ai-context']],
  'shopping:list-updated':  [['shopping-lists'], ['ai-context']],

  // Workspace switch invalidates everything user-scoped.
  'workspace:switched': [
    ['tasks'], ['events'], ['contacts'], ['contracts'], ['emails'],
    ['notes'], ['habits'], ['weekly-review'], ['ai-context'], ['activity-feed'],
  ],

  // Sharing affects shared-items views.
  'item:shared':   [['shared-items'], ['shared-tasks'], ['shared-events'], ['activity-feed']],
  'item:unshared': [['shared-items'], ['shared-tasks'], ['shared-events']],

  // AI memory changes affect smart context immediately.
  'ai:memory-updated': [['ai-context'], ['ai-memory']],
  'ai:context-stale':  [['ai-context']],
};

/**
 * Wires moduleBus events to QueryClient invalidations.
 * Call once at app startup; returns disposer.
 */
export function installCacheCoordinator(queryClient: QueryClient): () => void {
  const disposers: Array<() => void> = [];

  for (const [eventName, queryKeys] of Object.entries(INVALIDATION_RULES) as Array<
    [ModuleEventName, string[][]]
  >) {
    const off = moduleBus.on(eventName, () => {
      queryKeys.forEach((key) => {
        // Don't await — fire and let React Query schedule.
        void queryClient.invalidateQueries({ queryKey: key });
      });
    });
    disposers.push(off);
  }

  return () => disposers.forEach((d) => d());
}
