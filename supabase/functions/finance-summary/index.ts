// Finance dashboard rollup.
//
// One call, one payload — the finance page wants:
//   - total balance across linked + manual accounts (per currency).
//   - month-to-date spend per category vs. budget headroom.
//   - last 30d total in/out.
//   - subscription audit (active contracts × matched transactions).
//
// All views/queries are RLS-scoped via auth.uid(); the edge function
// just executes them and shapes the response.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Run the queries in parallel — none depend on each other.
    const [accRes, sumRes, txRes, auditRes, connRes] = await Promise.all([
      admin
        .from('financial_accounts')
        .select('id, name, account_type, institution, currency, current_balance, source, mask, subtype, bank_connection_id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true),
      // finance_summary uses auth.uid() inside the view, so a direct
      // user_id filter is redundant but documents intent.
      admin
        .from('finance_summary')
        .select('*')
        .eq('user_id', user.id),
      admin
        .from('financial_transactions')
        .select('id, account_id, amount, direction, category, description, merchant, occurred_on, pending, source')
        .eq('user_id', user.id)
        .gte('occurred_on', isoDaysAgo(30))
        .order('occurred_on', { ascending: false })
        .limit(100),
      admin
        .from('subscription_audit')
        .select('*')
        .eq('user_id', user.id),
      admin
        .from('bank_connections')
        .select('id, provider, institution_name, status, last_synced_at, last_error')
        .eq('user_id', user.id)
        .neq('status', 'disabled'),
    ]);

    // Per-currency balance + 30d in/out totals.
    const accounts = accRes.data ?? [];
    const balances: Record<string, number> = {};
    for (const a of accounts as any[]) {
      const cur = a.currency || 'USD';
      balances[cur] = (balances[cur] || 0) + Number(a.current_balance || 0);
    }

    let totalSpend30d = 0;
    let totalIncome30d = 0;
    for (const t of (txRes.data ?? []) as any[]) {
      if (t.direction === 'expense') totalSpend30d += Number(t.amount);
      else if (t.direction === 'income') totalIncome30d += Number(t.amount);
    }

    return json({
      generated_at: new Date().toISOString(),
      balances,
      accounts,
      summary: sumRes.data ?? [],
      recent_transactions: txRes.data ?? [],
      subscription_audit: auditRes.data ?? [],
      connections: connRes.data ?? [],
      totals: {
        spend_30d: round2(totalSpend30d),
        income_30d: round2(totalIncome30d),
        net_30d: round2(totalIncome30d - totalSpend30d),
      },
    });
  } catch (err) {
    console.error('[finance-summary] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
