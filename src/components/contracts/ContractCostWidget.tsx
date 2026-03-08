import { useMemo } from 'react';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Contract, CONTRACT_CATEGORIES } from '@/hooks/useContracts';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Receipt, TrendingUp, TrendingDown } from 'lucide-react';

interface ContractCostWidgetProps {
  contracts: Contract[];
}

export function ContractCostWidget({ contracts }: ContractCostWidgetProps) {
  const costAnalysis = useMemo(() => {
    const activeContracts = contracts.filter(c => c.isActive && c.costAmount);
    
    let monthlyTotal = 0;
    const categoryTotals: Record<string, number> = {};
    
    activeContracts.forEach(contract => {
      if (!contract.costAmount) return;
      
      let monthlyCost = 0;
      switch (contract.costFrequency) {
        case 'monthly':
          monthlyCost = contract.costAmount;
          break;
        case 'quarterly':
          monthlyCost = contract.costAmount / 3;
          break;
        case 'yearly':
          monthlyCost = contract.costAmount / 12;
          break;
        case 'one_time':
          return;
      }
      
      monthlyTotal += monthlyCost;
      const categoryYearly = monthlyCost * 12;
      categoryTotals[contract.category] = (categoryTotals[contract.category] || 0) + categoryYearly;
    });
    
    const yearlyTotal = monthlyTotal * 12;
    
    const categoryData = Object.entries(categoryTotals)
      .map(([category, total]) => {
        const categoryInfo = CONTRACT_CATEGORIES.find(c => c.value === category);
        return {
          name: categoryInfo?.label || category,
          value: Math.round(total),
          color: getCategoryColor(category),
          icon: categoryInfo?.icon || '📋',
        };
      })
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
    
    return {
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      yearlyTotal: Math.round(yearlyTotal * 100) / 100,
      categoryData,
      contractCount: activeContracts.length,
    };
  }, [contracts]);

  if (contracts.length === 0) {
    return null;
  }

  return (
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          Contract Costs
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
          {/* Pie Chart */}
          <div className="w-28 h-28 sm:w-36 sm:h-36 shrink-0">
            {costAnalysis.categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costAnalysis.categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={50}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {costAnalysis.categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`€${value.toLocaleString()}`, 'Yearly']}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                No costs
              </div>
            )}
          </div>
          
          {/* Stats */}
          <div className="flex-1 w-full space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 rounded-lg bg-muted/50 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Monthly
                </div>
                <div className="text-base sm:text-xl font-bold">
                  €{costAnalysis.monthlyTotal.toLocaleString()}
                </div>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-muted/50 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-muted-foreground mb-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Yearly
                </div>
                <div className="text-base sm:text-xl font-bold">
                  €{costAnalysis.yearlyTotal.toLocaleString()}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">By Category (Yearly)</p>
              <div className="space-y-1.5">
                {costAnalysis.categoryData.slice(0, 4).map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-muted-foreground">
                        {cat.icon} {cat.name}
                      </span>
                    </div>
                    <span className="font-medium">€{cat.value.toLocaleString()}</span>
                  </div>
                ))}
                {costAnalysis.categoryData.length > 4 && (
                  <p className="text-xs text-muted-foreground">
                    +{costAnalysis.categoryData.length - 4} more categories
                  </p>
                )}
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {costAnalysis.contractCount} active contract{costAnalysis.contractCount !== 1 ? 's' : ''} with costs
            </p>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    insurance: 'hsl(var(--chart-1))',
    utilities: 'hsl(var(--chart-2))',
    subscription: 'hsl(var(--chart-3))',
    phone: 'hsl(var(--chart-4))',
    internet: 'hsl(var(--chart-5))',
    streaming: 'hsl(210, 100%, 60%)',
    other: 'hsl(var(--muted-foreground))',
  };
  return colors[category] || colors.other;
}
