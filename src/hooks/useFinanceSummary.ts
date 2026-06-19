import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface FinanceAccount {
  id: string;
  name: string;
  account_type: string;
  institution: string | null;
  currency: string | null;
  current_balance: number | null;
  source: string | null;
  mask: string | null;
  subtype: string | null;
  bank_connection_id: string | null;
  is_active: boolean | null;
}

export interface FinanceTransaction {
  id: string;
  account_id: string | null;
  amount: number;
  direction: "expense" | "income" | string;
  category: string | null;
  description: string | null;
  merchant: string | null;
  occurred_on: string;
  pending: boolean;
  source: string | null;
}

export interface BudgetRow {
  category: string;
  spent_mtd: number;
  earned_mtd: number;
  monthly_limit: number | null;
  pct_of_budget: number | null;
}

export interface BankConnection {
  id: string;
  provider: string;
  institution_name: string | null;
  status: "good" | "reauth_required" | "error" | "disabled";
  last_synced_at: string | null;
  last_error: string | null;
}

export interface SubscriptionAuditRow {
  contract_id: string;
  contract_name: string;
  contract_provider: string | null;
  contract_category: string | null;
  expected_amount: number | null;
  expected_frequency: string | null;
  renewal_date: string | null;
  auto_renews: boolean | null;
  last_transaction_id: string | null;
  last_transaction_merchant: string | null;
  last_transaction_amount: number | null;
  last_transaction_date: string | null;
  days_since_last_charge: number | null;
  total_charged_90d: number | null;
  charge_count_90d: number | null;
}

export interface FinanceSummary {
  generated_at: string;
  balances: Record<string, number>;
  accounts: FinanceAccount[];
  summary: BudgetRow[];
  recent_transactions: FinanceTransaction[];
  subscription_audit: SubscriptionAuditRow[];
  connections: BankConnection[];
  totals: { spend_30d: number; income_30d: number; net_30d: number };
}

// Reads the finance dashboard rollup. Single edge function call →
// balances + budgets + recent txns + subscription audit + bank
// connection health, all in one round-trip.
export function useFinanceSummary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("finance-summary", { body: {} });
      if (error) throw error;
      setSummary(data as FinanceSummary);
    } catch (e) {
      console.warn("[useFinanceSummary] refresh failed", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to changes on the underlying tables so the dashboard
  // updates the moment a sync writes new rows.
  useEffect(() => {
    if (!user?.id) return;
    const tables = ["financial_transactions", "financial_accounts", "bank_connections"];
    type SupabaseUntyped = typeof supabase & {
      channel: (name: string) => { on: (...args: unknown[]) => { subscribe: () => unknown } };
      removeChannel: (c: unknown) => void;
    };
    const db = supabase as unknown as SupabaseUntyped;
    const channels = tables.map((table) =>
      db
        .channel(`fin-${table}-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            refresh();
          },
        )
        .subscribe(),
    );
    return () => {
      channels.forEach((c) => db.removeChannel(c));
    };
  }, [user?.id, refresh]);

  const syncAll = useCallback(async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("plaid-sync", { body: {} });
      if (error) throw error;
      const total = (Number(data?.added) || 0) + (Number(data?.modified) || 0);
      toast.success(`Synced ${total} transaction${total === 1 ? "" : "s"}`);
      await refresh();
      return data;
    } catch (e) {
      toast.error(await describeEdgeError(e, "Sync failed"));
      return null;
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const syncOne = useCallback(
    async (connectionId: string) => {
      setSyncing(true);
      try {
        const { data, error } = await supabase.functions.invoke("plaid-sync", {
          body: { connection_id: connectionId },
        });
        if (error) throw error;
        await refresh();
        return data;
      } catch (e) {
        toast.error(await describeEdgeError(e, "Sync failed"));
        return null;
      } finally {
        setSyncing(false);
      }
    },
    [refresh],
  );

  const disconnect = useCallback(
    async (connectionId: string) => {
      try {
        // Soft-delete is fine — RLS ensures only the owner can do it.
        // Plaid /item/remove can be wired in a follow-up; the upstream
        // token simply stops being usable when deleted here.
        const { error } = await (
          supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }
        )
          .from("bank_connections")
          .delete()
          .eq("id", connectionId);
        if (error) throw error;
        toast.info("Connection removed");
        await refresh();
      } catch (e) {
        toast.error(await describeEdgeError(e, "Failed"));
      }
    },
    [refresh],
  );

  return { summary, loading, syncing, refresh, syncAll, syncOne, disconnect };
}

// Bootstraps a Plaid Link flow. Returns a link_token that the
// caller can hand to Plaid Link.js (which the operator wires in
// once they have Plaid credentials). Also exposes exchange() so
// the caller can pass back the public_token after the user finishes.
export function usePlaidLink() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const createToken = useCallback(
    async (countryCodes: string[], language?: string) => {
      if (!user?.id) return null;
      setBusy(true);
      try {
        const { data, error } = await supabase.functions.invoke("plaid-link-token", {
          body: { country_codes: countryCodes, language },
        });
        if (error) throw error;
        const dataObj = data as Record<string, unknown> | null;
        if (dataObj?.error) throw new Error(String(dataObj.error));
        return data as { link_token: string; expiration: string; env: string };
      } catch (e) {
        toast.error(`Plaid link failed: ${(e as Error).message}`);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [user?.id],
  );

  const exchange = useCallback(
    async (
      publicToken: string,
      institution?: { id?: string; name?: string; country_codes?: string[] },
    ) => {
      if (!user?.id) return null;
      setBusy(true);
      try {
        const { data, error } = await supabase.functions.invoke("plaid-exchange", {
          body: { public_token: publicToken, institution },
        });
        if (error) throw error;
        toast.success(
          `Connected ${data?.institution_name || "bank"} (${data?.accounts_count} accounts)`,
        );
        return data;
      } catch (e) {
        toast.error(`Exchange failed: ${(e as Error).message}`);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [user?.id],
  );

  return { createToken, exchange, busy };
}
