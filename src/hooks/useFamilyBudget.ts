import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface BudgetCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  monthly_limit: number;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  category_id: string | null;
  family_member_id: string | null;
  amount: number;
  description: string | null;
  expense_date: string;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseWithCategory extends Expense {
  category?: BudgetCategory;
}

const DEFAULT_CATEGORIES = [
  { name: "Groceries", icon: "🛒", color: "#22c55e" },
  { name: "Utilities", icon: "💡", color: "#eab308" },
  { name: "Entertainment", icon: "🎬", color: "#a855f7" },
  { name: "Transportation", icon: "🚗", color: "#3b82f6" },
  { name: "Healthcare", icon: "🏥", color: "#ef4444" },
  { name: "Education", icon: "📚", color: "#06b6d4" },
  { name: "Clothing", icon: "👕", color: "#f97316" },
  { name: "Other", icon: "📦", color: "#6b7280" },
];

export function useFamilyBudget() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // intentionally excludes loadData — plain async function, listing it would loop

  const loadData = async (retryCount = 0) => {
    if (!user) return;
    // Only show loading on initial load, not retries
    if (retryCount === 0) {
      setIsLoading(true);
    }
    try {
      // Load categories
      const { data: cats, error: catError } = await supabase
        .from("family_budget_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (catError) throw catError;

      // If no categories, create defaults
      if (!cats || cats.length === 0) {
        await createDefaultCategories();
        return;
      }

      setCategories(cats);

      // Load expenses for current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: exps, error: expError } = await supabase
        .from("family_expenses")
        .select("*")
        .eq("user_id", user.id)
        .gte("expense_date", startOfMonth.toISOString().split("T")[0])
        .order("expense_date", { ascending: false });

      if (expError) throw expError;

      // Map expenses with categories
      const expensesWithCats = (exps || []).map((exp) => ({
        ...exp,
        category: cats?.find((c) => c.id === exp.category_id),
      }));

      setExpenses(expensesWithCats);
    } catch (error) {
      // Silent retry for transient network errors
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isNetworkError =
        errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError");
      if (isNetworkError && retryCount < 2) {
        await new Promise((r) => setTimeout(r, 500 * (retryCount + 1)));
        return loadData(retryCount + 1);
      }
      console.error("Error loading budget data:", error);
      // Don't show toast for network errors - just keep existing data
    } finally {
      if (retryCount === 0) {
        setIsLoading(false);
      }
    }
  };

  const createDefaultCategories = async () => {
    if (!user) return;
    try {
      const categoriesToInsert = DEFAULT_CATEGORIES.map((cat) => ({
        user_id: user.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        monthly_limit: 0,
      }));

      const { error } = await supabase.from("family_budget_categories").insert(categoriesToInsert);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error("Error creating default categories:", error);
    }
  };

  const addExpense = async (expense: {
    category_id: string | null;
    family_member_id?: string | null;
    amount: number;
    description?: string;
    expense_date: string;
  }) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("family_expenses").insert({
        user_id: user.id,
        category_id: expense.category_id,
        family_member_id: expense.family_member_id || null,
        amount: expense.amount,
        description: expense.description || null,
        expense_date: expense.expense_date,
      });

      if (error) throw error;
      toast.success("Expense added");
      await loadData();
    } catch (error) {
      console.error("Error adding expense:", error);
      toast.error("Failed to add expense");
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase.from("family_expenses").delete().eq("id", id);

      if (error) throw error;
      toast.success("Expense deleted");
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Failed to delete expense");
    }
  };

  const updateCategoryLimit = async (categoryId: string, limit: number) => {
    try {
      const { error } = await supabase
        .from("family_budget_categories")
        .update({ monthly_limit: limit })
        .eq("id", categoryId);

      if (error) throw error;
      toast.success("Budget limit updated");
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, monthly_limit: limit } : c)),
      );
    } catch (error) {
      console.error("Error updating limit:", error);
      toast.error("Failed to update limit");
    }
  };

  const getMonthlySpending = () => {
    return expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  };

  const getSpendingByCategory = () => {
    const spending: Record<string, number> = {};
    expenses.forEach((exp) => {
      const catId = exp.category_id || "uncategorized";
      spending[catId] = (spending[catId] || 0) + Number(exp.amount);
    });
    return spending;
  };

  const getTotalBudget = () => {
    return categories.reduce((sum, cat) => sum + Number(cat.monthly_limit), 0);
  };

  return {
    categories,
    expenses,
    isLoading,
    addExpense,
    deleteExpense,
    updateCategoryLimit,
    getMonthlySpending,
    getSpendingByCategory,
    getTotalBudget,
    refresh: loadData,
  };
}
