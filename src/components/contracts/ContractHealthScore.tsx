import { Contract } from '@/hooks/useContracts';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { differenceInDays, differenceInMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ContractHealthScoreProps {
  contract: Contract;
  className?: string;
}

interface ScoreFactors {
  hasRenewalDate: boolean;
  hasCost: boolean;
  hasProvider: boolean;
  contractDuration: number; // months
  daysUntilRenewal: number | null;
  autoRenews: boolean;
  isActive: boolean;
  hasDocument: boolean;
}

function calculateHealthScore(contract: Contract): { score: number; factors: ScoreFactors; issues: string[] } {
  const issues: string[] = [];
  let score = 50; // Base score

  const factors: ScoreFactors = {
    hasRenewalDate: !!contract.renewalDate,
    hasCost: !!contract.costAmount,
    hasProvider: !!contract.provider,
    contractDuration: contract.startDate && contract.renewalDate 
      ? differenceInMonths(contract.renewalDate, contract.startDate) 
      : 0,
    daysUntilRenewal: contract.renewalDate 
      ? differenceInDays(contract.renewalDate, new Date()) 
      : null,
    autoRenews: contract.autoRenews,
    isActive: contract.isActive,
    hasDocument: !!contract.documentUrl
  };

  // Completeness bonuses
  if (factors.hasRenewalDate) score += 10;
  else issues.push('No renewal date set');
  
  if (factors.hasCost) score += 10;
  else issues.push('No cost information');
  
  if (factors.hasProvider) score += 5;
  if (factors.hasDocument) score += 10;
  else issues.push('No contract document attached');

  // Urgency adjustments
  if (factors.daysUntilRenewal !== null) {
    if (factors.daysUntilRenewal < 0) {
      score -= 20;
      issues.push('Contract has expired');
    } else if (factors.daysUntilRenewal <= 7) {
      score -= 15;
      issues.push('Renewal very soon');
    } else if (factors.daysUntilRenewal <= 14) {
      score -= 10;
      issues.push('Renewal approaching');
    } else if (factors.daysUntilRenewal <= 30) {
      score -= 5;
    }

    // Check if cancellation deadline is soon
    if (factors.autoRenews) {
      const daysUntilCancellation = factors.daysUntilRenewal - contract.cancellationNoticeDays;
      if (daysUntilCancellation < 0) {
        score -= 15;
        issues.push('Cancellation deadline passed');
      } else if (daysUntilCancellation <= 7) {
        score -= 10;
        issues.push('Cancellation deadline very soon');
      }
    }
  }

  // Auto-renew consideration
  if (factors.autoRenews && factors.daysUntilRenewal !== null && factors.daysUntilRenewal > 0) {
    score += 5; // Slightly better as it won't lapse
  }

  // Inactive penalty
  if (!factors.isActive) {
    score -= 10;
  }

  return { 
    score: Math.max(0, Math.min(100, score)), 
    factors, 
    issues 
  };
}

export function ContractHealthScore({ contract, className }: ContractHealthScoreProps) {
  const { score, issues } = calculateHealthScore(contract);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 60) return <TrendingUp className="w-4 h-4" />;
    if (score >= 40) return <Minus className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            <div className={cn("flex items-center gap-1 font-medium", getScoreColor(score))}>
              {getScoreIcon(score)}
              <span className="text-sm">{score}</span>
            </div>
            {issues.length > 0 && (
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[250px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Health Score</span>
              <Badge variant={score >= 60 ? "default" : "destructive"} className="text-xs">
                {getScoreLabel(score)}
              </Badge>
            </div>
            {issues.length > 0 && (
              <div className="space-y-1">
                {issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact badge version for card view
export function ContractHealthBadge({ contract }: { contract: Contract }) {
  const { score } = calculateHealthScore(contract);

  const variant = score >= 60 ? 'default' : score >= 40 ? 'secondary' : 'destructive';
  
  return (
    <Badge variant={variant} className="text-xs gap-1">
      {score >= 60 ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <AlertTriangle className="w-3 h-3" />
      )}
      {score}
    </Badge>
  );
}
