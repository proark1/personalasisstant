// Confirmation tiers for Dori actions.
//
// A world-class assistant earns the right to act autonomously by being safe
// about it: reversible, low-stakes actions can run silently, but outward-facing
// or destructive ones (sending an email, cancelling a contract, bulk-deleting
// events) should be confirmed first. This module is the single source of truth
// for that classification.
//
// It is intentionally pure + dependency-free so it can run on the client (to
// drive a confirm dialog before asking the server to execute) and be mirrored
// server-side later to enforce the gate before a tool actually runs. The tool
// names match supabase/functions/_shared/dori-tools.ts.

export type ActionTier = 'auto' | 'confirm';

/** Tools that are outward-facing or otherwise high-stakes regardless of operation. */
const ALWAYS_CONFIRM = new Set<string>([
  'send_email', // sends mail to a third party — irreversible, outward-facing
  'bulk_delete_events', // destructive, many rows
  'bulk_reschedule', // moves many real calendar entries at once
  'zakat', // financial calculation/commitment — sensitive
  'budget', // financial — sensitive
  'meds', // medical — sensitive
]);

/** Tools that only execute against the user's own data and are easily undone. */
const ALWAYS_AUTO = new Set<string>([
  'find_time',
  'web_search',
  'save_memory',
  'learn_preference',
  'log_wellbeing',
  'summarize_emails',
  'compose_email', // drafts only — does NOT send (send_email does)
  'task_filter',
  'task_estimate',
  'timezone',
  'currency',
  'presence',
]);

/**
 * Operations that flip an otherwise-auto CRUD tool (manage_task, manage_event,
 * manage_note, manage_contact, manage_contract, manage_habit, manage_goal,
 * email_action, …) into the confirm tier. Destructive or outward-facing verbs.
 */
const DESTRUCTIVE_OPS = new Set<string>([
  'delete',
  'remove',
  'cancel',
  'archive',
  'send',
  'reply',
  'forward',
  'unsubscribe',
]);

/** Normalize a tool/operation token: lowercase, trim, undefined-safe. */
function norm(v?: string | null): string {
  return (v ?? '').trim().toLowerCase();
}

/**
 * Classify a Dori tool call into a confirmation tier.
 *
 * @param tool   The tool name (e.g. "manage_contract", "send_email").
 * @param operation Optional operation/verb from the tool's arguments
 *   (e.g. "delete", "cancel", "create"). Many CRUD tools are only high-stakes
 *   for destructive operations.
 */
export function classifyActionRisk(tool: string, operation?: string | null): ActionTier {
  const t = norm(tool);
  const op = norm(operation);

  if (ALWAYS_CONFIRM.has(t)) return 'confirm';
  if (DESTRUCTIVE_OPS.has(op)) return 'confirm';
  if (ALWAYS_AUTO.has(t)) return 'auto';

  // Unknown tools default to auto only when there's no destructive operation —
  // already handled above. A genuinely unknown tool with no operation is
  // treated as auto (it acts on the user's own data); revisit if new
  // outward-facing tools are added without updating ALWAYS_CONFIRM.
  return 'auto';
}

/** Convenience: does this action need an explicit user confirmation first? */
export function requiresConfirmation(tool: string, operation?: string | null): boolean {
  return classifyActionRisk(tool, operation) === 'confirm';
}
