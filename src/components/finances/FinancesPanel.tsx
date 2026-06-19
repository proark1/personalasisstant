import { useState } from "react";
import { Wallet, Plus, Trash2 } from "lucide-react";
import { PanelShell } from "@/components/ui/panel-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useFinances } from "@/hooks/useFinances";

export function FinancesPanel() {
  const {
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
  } = useFinances();
  const [name, setName] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [budgetCat, setBudgetCat] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");

  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);

  return (
    <PanelShell
      icon={Wallet}
      title="Finances"
      subtitle={`Net balance: ${totalBalance.toFixed(2)}`}
      loading={isLoading}
    >
      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Account name (e.g. Sparkasse)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              onClick={() => {
                if (name) {
                  addAccount({ name });
                  setName("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {accounts.map((a) => (
            <Card key={a.id} className="p-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.account_type} · {a.institution || "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">
                  {Number(a.current_balance || 0).toFixed(2)} {a.currency || ""}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove("financial_accounts", a.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Description"
              value={txDesc}
              onChange={(e) => setTxDesc(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Amount"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              className="w-32"
            />
            <Button
              onClick={() => {
                if (txAmount) {
                  addTransaction({
                    description: txDesc,
                    amount: Number(txAmount),
                    direction: Number(txAmount) >= 0 ? "in" : "out",
                  });
                  setTxAmount("");
                  setTxDesc("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {transactions.map((t) => (
            <Card key={t.id} className="p-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{t.description || t.merchant || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {t.occurred_on} · {t.category || "uncategorized"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`font-semibold ${t.direction === "in" ? "text-green-600" : "text-foreground"}`}
                >
                  {Number(t.amount).toFixed(2)}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove("financial_transactions", t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="budgets" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Category"
              value={budgetCat}
              onChange={(e) => setBudgetCat(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Monthly limit"
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
              className="w-40"
            />
            <Button
              onClick={() => {
                if (budgetCat && budgetLimit) {
                  addBudget({ category: budgetCat, monthly_limit: Number(budgetLimit) });
                  setBudgetCat("");
                  setBudgetLimit("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {budgets.map((b) => (
            <Card key={b.id} className="p-3 flex justify-between">
              <span className="font-medium">{b.category}</span>
              <div className="flex items-center gap-3">
                <span>
                  {Number(b.monthly_limit).toFixed(2)} {b.currency || ""}/mo
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => remove("financial_budgets", b.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="goals" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Goal title"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Target"
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              className="w-32"
            />
            <Button
              onClick={() => {
                if (goalTitle && goalAmount) {
                  addGoal({ title: goalTitle, target_amount: Number(goalAmount) });
                  setGoalTitle("");
                  setGoalAmount("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {goals.map((g) => (
            <Card key={g.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{g.title}</p>
                <p className="text-xs text-muted-foreground">
                  {Number(g.current_amount || 0).toFixed(2)} / {Number(g.target_amount).toFixed(2)}{" "}
                  {g.currency || ""}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove("financial_goals", g.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}
