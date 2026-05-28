// Sync transactions from Plaid for one connection (or all of a
// user's connections if no id is passed).
//
// Body: { connection_id?: uuid }   // omitted = sync all 'good' connections
//
// Behavior per connection:
//   1. Load access_token + sync_cursor.
//   2. Loop /transactions/sync until has_more=false (cap N pages so
//      a runaway never blows the 60s edge timeout).
//   3. Upsert added + modified transactions into financial_transactions
//      (UNIQUE on user_id, source, external_id makes this idempotent).
//   4. Mark removed transactions soft-deleted (we set amount=0 and
//      append a metadata flag rather than DELETE so audit views don't
//      shift under the user's feet).
//   5. Refresh account balances opportunistically.
//   6. Persist next_cursor + last_synced_at + status='good'.
//
// Errors that suggest reauth (ITEM_LOGIN_REQUIRED, etc.) flip the
// connection to status='reauth_required' so the UI prompts the user.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  loadConfig,
  normaliseTransaction,
  syncTransactions,
  getAccounts,
  type PlaidTransaction,
} from '../_shared/plaid.ts';
import { decryptToken } from '../_shared/encryption.ts';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cap on how many pages we drain per invocation. Each page is up to
// 200 transactions and Plaid responds in ~500ms-2s, so 5 pages /
// connection / call leaves headroom for 2-3 connections in one
// invocation. Anything more, the user just calls /plaid-sync again.
const MAX_PAGES_PER_CONNECTION = 5;
const PLAID_REAUTH_CODES = new Set([
  'ITEM_LOGIN_REQUIRED',
  'PENDING_EXPIRATION',
  'PENDING_DISCONNECT',
  'INVALID_CREDENTIALS',
  'INVALID_MFA',
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let cfg;
    try { cfg = loadConfig(); }
    catch (e) { return json({ error: 'Plaid not configured', details: (e as Error).message }, 503); }

    const body = await req.json().catch(() => ({}));
    const onlyConnectionId = typeof body.connection_id === 'string' ? body.connection_id : null;

    let q = admin
      .from('bank_connections')
      .select('id, access_token_ciphertext, sync_cursor, status, institution_name')
      .eq('user_id', user.id)
      .neq('status', 'disabled');
    if (onlyConnectionId) q = q.eq('id', onlyConnectionId);
    const { data: conns, error: cErr } = await q;
    if (cErr) return json({ error: cErr.message }, 500);
    if (!conns || conns.length === 0) {
      return json({ ok: true, synced_connections: 0, added: 0, modified: 0, removed: 0 });
    }

    const totals = { added: 0, modified: 0, removed: 0, accounts_refreshed: 0 };
    const perConnection: Record<string, unknown>[] = [];

    for (const conn of conns) {
      if (!conn.access_token_ciphertext) {
        perConnection.push({ id: conn.id, error: 'no access_token (re-link required)' });
        continue;
      }
      // Decrypt once per connection; the plaintext stays in this loop's
      // closure and is never written to logs or back to the DB.
      let accessToken: string;
      try {
        accessToken = await decryptToken(conn.access_token_ciphertext);
      } catch (e) {
        perConnection.push({ id: conn.id, error: `token decrypt failed: ${(e as Error).message}` });
        // Flip status so the UI shows a "re-link" prompt.
        await admin.from('bank_connections').update({
          status: 'error',
          last_error: 'Token decrypt failed — re-link the bank',
        }).eq('id', conn.id);
        continue;
      }

      let cursor = conn.sync_cursor || '';
      let pages = 0;
      const added: PlaidTransaction[] = [];
      const modified: PlaidTransaction[] = [];
      const removed: { transaction_id: string }[] = [];
      let lastErr: string | null = null;
      let reauth = false;

      while (pages < MAX_PAGES_PER_CONNECTION) {
        try {
          const resp = await syncTransactions(cfg, accessToken, cursor);
          added.push(...resp.added);
          modified.push(...resp.modified);
          removed.push(...resp.removed);
          cursor = resp.next_cursor;
          pages += 1;
          if (!resp.has_more) break;
        } catch (e) {
          lastErr = (e as Error).message;
          const code = (e as any)?.plaidError?.error_code;
          if (code && PLAID_REAUTH_CODES.has(code)) reauth = true;
          break;
        }
      }

      // Apply added + modified as upserts. Direction is derived from
      // amount sign (Plaid: +ve = outflow). external_id makes it
      // idempotent across re-runs.
      const upserts = [...added, ...modified].map((t) => {
        const { amount, direction } = normaliseTransaction(t);
        return {
          user_id: user.id,
          source: 'plaid',
          external_id: t.transaction_id,
          // Resolve account_id via the (user_id, source, external_id)
          // index on financial_accounts. We do the lookup as a
          // sub-select so a missing account row doesn't fail the
          // whole batch — the row just gets account_id=NULL and a
          // follow-up sync will fix it.
          amount,
          direction,
          category: t.personal_finance_category?.primary
            || (Array.isArray(t.category) ? t.category[0] : null),
          description: t.name,
          merchant: t.merchant_name || t.name,
          occurred_on: t.date,
          pending: !!t.pending,
          iso_currency_code: t.iso_currency_code || t.unofficial_currency_code || null,
          payment_channel: t.payment_channel || null,
          plaid_category_detailed: t.personal_finance_category || null,
          metadata: { plaid_account_id: t.account_id },
        };
      });

      if (upserts.length) {
        // Resolve plaid_account_id → financial_accounts.id in a single batch
        // pre-lookup; saves a round-trip per row.
        const plaidAccountIds = Array.from(new Set(upserts.map((u) => (u.metadata as any).plaid_account_id)));
        const { data: accRows } = await admin
          .from('financial_accounts')
          .select('id, external_id')
          .eq('user_id', user.id)
          .eq('source', 'plaid')
          .in('external_id', plaidAccountIds);
        const accMap = new Map<string, string>();
        for (const a of (accRows ?? []) as Array<{ id: string; external_id: string }>) {
          accMap.set(a.external_id, a.id);
        }
        const enriched = upserts.map((u) => ({
          ...u,
          account_id: accMap.get((u.metadata as any).plaid_account_id) ?? null,
        }));
        const { error: txErr } = await admin
          .from('financial_transactions')
          .upsert(enriched, { onConflict: 'user_id,source,external_id' });
        if (txErr) {
          lastErr = lastErr || txErr.message;
        } else {
          totals.added += added.length;
          totals.modified += modified.length;
        }
      }

      // Removed: zero them out + flag in metadata. We don't DELETE so
      // any subscription_audit calculations that already ran stay
      // consistent.
      for (const r of removed) {
        await admin.from('financial_transactions').update({
          amount: 0,
          metadata: { removed_at: new Date().toISOString() },
        }).eq('user_id', user.id).eq('source', 'plaid').eq('external_id', r.transaction_id);
      }
      totals.removed += removed.length;

      // Opportunistic balance refresh.
      try {
        const accs = await getAccounts(cfg, accessToken);
        for (const a of accs.accounts) {
          await admin.from('financial_accounts').update({
            current_balance: a.balances.current ?? a.balances.available ?? 0,
          }).eq('user_id', user.id).eq('source', 'plaid').eq('external_id', a.account_id);
          totals.accounts_refreshed += 1;
        }
      } catch (e) {
        console.warn('[plaid-sync] balance refresh failed', (e as Error).message);
      }

      // Persist cursor + status.
      await admin.from('bank_connections').update({
        sync_cursor: cursor,
        last_synced_at: new Date().toISOString(),
        status: reauth ? 'reauth_required' : (lastErr ? 'error' : 'good'),
        last_error: lastErr,
      }).eq('id', conn.id);

      perConnection.push({
        id: conn.id,
        institution: conn.institution_name,
        added: added.length,
        modified: modified.length,
        removed: removed.length,
        pages,
        status: reauth ? 'reauth_required' : (lastErr ? 'error' : 'good'),
        error: lastErr,
      });
    }

    return json({
      ok: true,
      synced_connections: conns.length,
      ...totals,
      connections: perConnection,
    });
  } catch (err) {
    console.error('[plaid-sync] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
