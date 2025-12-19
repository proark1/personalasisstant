import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFamilyBudget } from '@/hooks/useFamilyBudget';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { AddExpenseDialog } from './AddExpenseDialog';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react';
import { format } from 'date-fns';

export function BudgetTrackingPanel() {
  const { categories, expenses, isLoading, deleteExpense, updateCategoryLimit, getMonthlySpending, getSpendingByCategory, getTotalBudget } = useFamilyBudget();
  const { members: familyMembers } = useFamilyMembers();
  
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [limitValue, setLimitValue] = useState('');

  const monthlySpending = getMonthlySpending();
  const totalBudget = getTotalBudget();
  const spendingByCategory = getSpendingByCategory();
  const budgetProgress = totalBudget > 0 ? (monthlySpending / totalBudget) * 100 : 0;

  const handleSaveLimit = async (categoryId: string) => {
    const limit = parseFloat(limitValue);
    if (!isNaN(limit) && limit >= 0) {
      await updateCategoryLimit(categoryId, limit);
    }
    setEditingLimit(null);
    setLimitValue('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Spending</p>
                <p className="text-2xl font-bold">${monthlySpending.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-secondary/10">
                <PieChart className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">${totalBudget.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${budgetProgress > 100 ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
                {budgetProgress > 100 ? (
                  <TrendingUp className="h-6 w-6 text-destructive" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-green-500" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className={`text-2xl font-bold ${totalBudget - monthlySpending < 0 ? 'text-destructive' : ''}`}>
                  ${(totalBudget - monthlySpending).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress */}
      {totalBudget > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Monthly Budget Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  ${monthlySpending.toFixed(2)} of ${totalBudget.toFixed(2)}
                </span>
                <span className={budgetProgress > 100 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                  {budgetProgress.toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={Math.min(budgetProgress, 100)} 
                className={`h-3 ${budgetProgress > 100 ? '[&>div]:bg-destructive' : ''}`}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories with spending */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map(category => {
              const spent = spendingByCategory[category.id] || 0;
              const limit = Number(category.monthly_limit);
              const progress = limit > 0 ? (spent / limit) * 100 : 0;

              return (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{category.icon}</span>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        ${spent.toFixed(2)}
                      </span>
                      {editingLimit === category.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={limitValue}
                            onChange={(e) => setLimitValue(e.target.value)}
                            className="w-20 h-7 text-sm"
                            placeholder="0"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveLimit(category.id)}
                          />
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => handleSaveLimit(category.id)}>
                            Save
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => {
                            setEditingLimit(category.id);
                            setLimitValue(limit.toString());
                          }}
                        >
                          Limit: ${limit.toFixed(0)}
                        </Button>
                      )}
                    </div>
                  </div>
                  {limit > 0 && (
                    <Progress 
                      value={Math.min(progress, 100)} 
                      className={`h-2 ${progress > 100 ? '[&>div]:bg-destructive' : ''}`}
                      style={{ '--progress-color': category.color } as React.CSSProperties}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Expenses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Expenses</CardTitle>
          <Button onClick={() => setShowAddExpense(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Expense
          </Button>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No expenses this month. Start tracking your spending!
            </p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {expenses.map(expense => {
                  const member = familyMembers.find(m => m.id === expense.family_member_id);
                  return (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{expense.category?.icon || '📦'}</span>
                        <div>
                          <p className="font-medium">{expense.description || expense.category?.name || 'Expense'}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{format(new Date(expense.expense_date), 'MMM d')}</span>
                            {member && (
                              <>
                                <span>•</span>
                                <span>{member.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" style={{ backgroundColor: expense.category?.color + '20', color: expense.category?.color }}>
                          ${Number(expense.amount).toFixed(2)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteExpense(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AddExpenseDialog
        open={showAddExpense}
        onOpenChange={setShowAddExpense}
        categories={categories}
        familyMembers={familyMembers}
      />
    </div>
  );
}
