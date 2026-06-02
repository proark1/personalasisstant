// Shared undo plumbing.
//
// Every mutation Dori runs records an entry in `dori_undo_log` with either a
// reversible tool-XML (to reconstruct the inverse op) or a row snapshot (for
// restoring deletes). The Telegram bot attaches an "↩️ Undo" button that
// invokes this helper within the 5-minute TTL.

// Tables the undo pipeline is allowed to touch. The snapshot.table field is
// attacker-controlled in theory (it's stored in a DB row), so we always gate
// writes through this allow-list. Adding a new table to any mutator also
// requires adding it here — keep them in sync.
const ALLOWED_UNDO_TABLES = new Set<string>([
  'tasks',
  'events',
  'user_contacts',
  'contracts',
  'properties',
  'startup_ideas',
  'family_members',
  'notes',
  'shopping_lists',
  'shopping_list_items',
  // Recently added by feature PRs:
  'financial_transactions',  // vision capture (receipt) + Plaid sync
  'receipts',                // vision capture (receipt)
  'personal_medications',    // vision capture (medication)
  'meeting_bots',            // meeting copilot schedule
  'vision_captures',         // own table — undo a discard
  'dori_action_plans',       // plan create
  'dori_plan_steps',         // step execution
  'schedule_proposals',      // predictive scheduler
]);

export interface UndoEntry {
  id: string;
  user_id: string;
  op: 'create' | 'update' | 'delete' | 'complete' | string;
  entity_type: string;
  entity_id: string | null;
  label: string;
  inverse_tool_xml: string | null;
  snapshot: Record<string, unknown>;
  source: string;
  source_ref: string | null;
  expires_at: string;
  created_at: string;
  consumed_at: string | null;
}

// Minimal Supabase client surface needed by this module.
type UndoClient = { from(table: string): Record<string, (...args: unknown[]) => unknown> };

export async function recordUndo(
  supabase: UndoClient,
  row: Omit<UndoEntry, 'id' | 'created_at' | 'consumed_at' | 'expires_at'> & { expiresInSeconds?: number },
): Promise<string | null> {
  try {
    const expiresAt = new Date(Date.now() + (row.expiresInSeconds ?? 300) * 1000).toISOString();
    const { data, error } = await supabase.from('dori_undo_log').insert({
      user_id: row.user_id,
      op: row.op,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      label: row.label,
      inverse_tool_xml: row.inverse_tool_xml,
      snapshot: row.snapshot,
      source: row.source,
      source_ref: row.source_ref,
      expires_at: expiresAt,
    }).select('id').single();
    if (error) throw error;
    return data?.id || null;
  } catch (e) {
    console.error('recordUndo failed', e);
    return null;
  }
}

export async function fetchUndoable(supabase: UndoClient, undoId: string): Promise<UndoEntry | null> {
  const { data } = await supabase
    .from('dori_undo_log')
    .select('*')
    .eq('id', undoId)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return (data as UndoEntry | null) || null;
}

export async function fetchLatestUndoableForUser(
  supabase: UndoClient,
  userId: string,
): Promise<UndoEntry | null> {
  const { data } = await supabase
    .from('dori_undo_log')
    .select('*')
    .eq('user_id', userId)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as UndoEntry | null) || null;
}

// Execute the undo: run the inverse tool-XML through chat (with
// skipApprovalGate so it runs immediately) OR restore a snapshot row.
// Marks the row consumed so it can't be used twice.
export async function runUndo(
  supabase: UndoClient,
  entry: UndoEntry,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ ok: boolean; message: string }> {
  // Best-effort single-consumer: stamp consumed_at first; if another request
  // beat us to it, bail out.
  const { data: claim, error: claimErr } = await supabase
    .from('dori_undo_log')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', entry.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();
  if (claimErr || !claim) {
    return { ok: false, message: '⏰ This undo has already been used or expired.' };
  }

  try {
    if (entry.inverse_tool_xml) {
      const resp = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'x-telegram-user-id': entry.user_id,
        },
        body: JSON.stringify({
          messages: [],
          executeServerSide: true,
          skipApprovalGate: true,
          preformedToolText: entry.inverse_tool_xml,
        }),
      });
      const data = await resp.json();
      const results = (data?.toolResults || []) as { ok: boolean; message: string }[];
      const ok = results.every((r) => r.ok !== false);
      const detail = results.map((r) => r.message).join('\n');
      return {
        ok,
        message: ok
          ? `↩️ Reverted — ${entry.label}.${detail ? `\n${detail}` : ''}`
          : `⚠️ Undo had issues: ${detail || 'unknown'}`,
      };
    }

    // Snapshot-based undo. Three kinds are supported:
    //   { kind: 'delete_by_id', table, id }     undo a create
    //   { kind: 'reinsert',     table, row }    undo a delete
    //   { kind: 'patch',        table, id, patch } undo an update / complete
    //
    // The table name is never interpolated into SQL, but we still gate it
    // through an allow-list for defense-in-depth — a misconfigured RLS policy
    // or anyone who finds a way to write into `dori_undo_log` shouldn't be
    // able to pick an arbitrary table to mutate.
    const snap = entry.snapshot;
    if (snap?.table && !ALLOWED_UNDO_TABLES.has(String(snap.table))) {
      console.warn('runUndo: refusing disallowed table', snap.table);
      return { ok: false, message: `⚠️ Undo refused for safety.` };
    }
    if (snap?.kind === 'delete_by_id' && snap.table && snap.id) {
      const { error } = await supabase.from(snap.table)
        .delete().eq('id', snap.id).eq('user_id', entry.user_id);
      if (error) throw error;
      return { ok: true, message: `↩️ Reverted — ${entry.label}.` };
    }
    if (snap?.kind === 'reinsert' && snap.table && snap.row) {
      const { error } = await supabase.from(snap.table).insert(snap.row);
      if (error) throw error;
      return { ok: true, message: `↩️ Restored — ${entry.label}.` };
    }
    if (snap?.kind === 'patch' && snap.table && snap.id && snap.patch) {
      const { error } = await supabase.from(snap.table)
        .update(snap.patch).eq('id', snap.id).eq('user_id', entry.user_id);
      if (error) throw error;
      return { ok: true, message: `↩️ Reverted — ${entry.label}.` };
    }

    return { ok: false, message: `⚠️ Nothing to undo for ${entry.label}.` };
  } catch (e) {
    console.error('runUndo failed', e);
    // Release the claim so a human can retry manually if desired.
    await supabase.from('dori_undo_log').update({ consumed_at: null }).eq('id', entry.id);
    return { ok: false, message: `⚠️ Undo failed: ${(e as Error).message}` };
  }
}
