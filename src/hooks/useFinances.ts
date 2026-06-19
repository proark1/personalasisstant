import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface FinAccount {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
  institution: string | null;
  currency: string | null;
  current_balance: number | null;
  is_active: boolean | null;
  notes: string | null;
}
export interface FinTransaction {
  id: string;
  user_id: string;
  account_id: string | null;
  amount: number;
  direction: string;
  category: string | null;
  description: string | null;
  merchant: string | null;
  occurred_on: string;
  tags: string[] | null;
}
export interface FinBudget {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
  currency: string | null;
}
export interface FinGoal {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number | null;
  currency: string | null;
  target_date: string | null;
  category: string | null;
  notes: string | null;
  is_achieved: boolean | null;
}

export function useFinances() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [transactions, setTransactions] = useState<FinTransaction[]>([]);
  const [budgets, setBudgets] = useState<FinBudget[]>([]);
  const [goals, setGoals] = useState<FinGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [a, t, b, g] = await Promise.all([
        supabase.from("financial_accounts").select("*").eq("user_id", user.id).order("name"),
        supabase
          .from("financial_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("occurred_on", { ascending: false })
          .limit(200),
        supabase.from("financial_budgets").select("*").eq("user_id", user.id).order("category"),
        supabase
          .from("financial_goals")
          .select("*")
          .eq("user_id", user.id)
          .order("target_date", { nullsFirst: false }),
      ]);
      setAccounts((a.data as unknown as FinAccount[]) || []);
      setTransactions((t.data as unknown as FinTransaction[]) || []);
      setBudgets((b.data as unknown as FinBudget[]) || []);
      setGoals((g.data as unknown as FinGoal[]) || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) refresh();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const addAccount = async (p: Partial<FinAccount>) => {
    if (!user) return;
    const { error } = await supabase.from("financial_accounts").insert({
      ...p,
      user_id: user.id,
      name: p.name!,
      account_type: p.account_type || "checking",
    });
    if (error) return toast.error(error.message);
    toast.success("Account added");
    refresh();
  };
  const addTransaction = async (p: Partial<FinTransaction>) => {
    if (!user) return;
    const { error } = await supabase.from("financial_transactions").insert({
      ...p,
      user_id: user.id,
      amount: Number(p.amount),
      occurred_on: p.occurred_on || new Date().toISOString().slice(0, 10),
    });
    if (error) return toast.error(error.message);
    toast.success("Transaction added");
    refresh();
  };
  const addBudget = async (p: Partial<FinBudget>) => {
    if (!user) return;
    const { error } = await supabase
      .from("financial_budgets")
      .upsert(
        { ...p, user_id: user.id, category: p.category!, monthly_limit: Number(p.monthly_limit) },
        { onConflict: "user_id,category" },
      );
    if (error) return toast.error(error.message);
    toast.success("Budget saved");
    refresh();
  };
  const addGoal = async (p: Partial<FinGoal>) => {
    if (!user) return;
    const { error } = await supabase
      .from("financial_goals")
      .insert({ ...p, user_id: user.id, title: p.title!, target_amount: Number(p.target_amount) });
    if (error) return toast.error(error.message);
    toast.success("Goal added");
    refresh();
  };
  const remove = async (
    table:
      | "financial_accounts"
      | "financial_transactions"
      | "financial_budgets"
      | "financial_goals",
    id: string,
  ) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  };

  return {
    accounts,
    transactions,
    budgets,
    goals,
    isLoading,
    addAccount,
    addTransaction,
    addBudget,
    addGoal,
    remove,
    refresh,
  };
}
