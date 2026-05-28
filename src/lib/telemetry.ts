import { supabase } from '@/integrations/supabase/client';

/**
 * Lightweight client-error telemetry.
 *
 * The app had no bridge between runtime failures and anything queryable —
 * errors only hit the console. This records them into the existing
 * `analytics_events` table (already surfaced in the admin analytics panel),
 * so crashes, unhandled rejections, and ErrorBoundary catches become visible
 * without adding a third-party dependency.
 *
 * Best-effort and self-throttled: it never throws, and it de-dupes identical
 * messages within a short window so an error loop can't spam the table.
 */

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

const recent = new Map<string, number>();
const DEDUPE_MS = 10_000;

function sessionId(): string {
  try {
    let id = sessionStorage.getItem('analytics_session_id');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('analytics_session_id', id);
    }
    return id;
  } catch {
    return 'no-session';
  }
}

export async function reportClientError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  try {
    const { message, stack } = describe(error);

    // De-dupe identical messages within the window.
    const now = Date.now();
    const last = recent.get(message);
    if (last && now - last < DEDUPE_MS) return;
    recent.set(message, now);
    if (recent.size > 50) recent.clear();

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return; // RLS-scoped table; skip anonymous noise.

    await supabase.from('analytics_events').insert({
      user_id: userId,
      event_type: 'error',
      event_category: 'error',
      page_path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      session_id: sessionId(),
      event_data: {
        message,
        stack: stack?.slice(0, 2000),
        ...context,
      },
    });
  } catch {
    /* telemetry must never break the app */
  }
}

let installed = false;

/** Install global handlers for uncaught errors and unhandled promise rejections. */
export function installGlobalErrorTelemetry(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e) => {
    void reportClientError(e.error ?? e.message, { kind: 'window.error' });
  });
  window.addEventListener('unhandledrejection', (e) => {
    void reportClientError(e.reason, { kind: 'unhandledrejection' });
  });
}
