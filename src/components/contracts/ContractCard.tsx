import { Contract, CONTRACT_CATEGORIES } from '@/hooks/useContracts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Calendar, DollarSign, AlertTriangle, ExternalLink } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

interface ContractCardProps {
  contract: Contract;
  onEdit: (contract: Contract) => void;
  onDelete: (contract: Contract) => void;
}

export function ContractCard({ contract, onEdit, onDelete }: ContractCardProps) {
  const categoryInfo = CONTRACT_CATEGORIES.find(c => c.value === contract.category);
  
  const daysUntilRenewal = contract.renewalDate 
    ? differenceInDays(contract.renewalDate, new Date()) 
    : null;
  
  const cancellationDate = contract.renewalDate && contract.autoRenews
    ? new Date(contract.renewalDate.getTime() - contract.cancellationNoticeDays * 24 * 60 * 60 * 1000)
    : null;
  
  const daysUntilCancellation = cancellationDate
    ? differenceInDays(cancellationDate, new Date())
    : null;

  const isRenewalSoon = daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30;
  const isCancellationSoon = daysUntilCancellation !== null && daysUntilCancellation >= 0 && daysUntilCancellation <= 14;

  const formatCost = () => {
    if (!contract.costAmount) return null;
    const amount = contract.costAmount.toFixed(2);
    const freq = {
      monthly: '/mo',
      quarterly: '/qtr',
      yearly: '/yr',
      one_time: ' one-time',
    }[contract.costFrequency];
    return `€${amount}${freq}`;
  };

  return (
    <Card className={cn(
      "group relative transition-all hover:shadow-md",
      !contract.isActive && "opacity-60",
      isCancellationSoon && "border-destructive/50 bg-destructive/5"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{categoryInfo?.icon || '📄'}</span>
              <h3 className="font-medium truncate">{contract.name}</h3>
              {!contract.isActive && (
                <Badge variant="secondary" className="text-xs">Inactive</Badge>
              )}
            </div>
            
            {contract.provider && (
              <p className="text-sm text-muted-foreground mb-2">{contract.provider}</p>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              {formatCost() && (
                <Badge variant="outline" className="gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatCost()}
                </Badge>
              )}
              
              {contract.renewalDate && (
                <Badge 
                  variant={isRenewalSoon ? "default" : "outline"} 
                  className={cn("gap-1", isRenewalSoon && "bg-primary/80")}
                >
                  <Calendar className="h-3 w-3" />
                  {format(contract.renewalDate, 'MMM d, yyyy')}
                </Badge>
              )}

              {contract.autoRenews && (
                <Badge variant="secondary" className="text-xs">Auto-renews</Badge>
              )}
            </div>

            {/* Warnings */}
            {isCancellationSoon && cancellationDate && (
              <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" />
                <span>
                  Cancel by {format(cancellationDate, 'MMM d')} ({daysUntilCancellation} days)
                </span>
              </div>
            )}

            {contract.notes && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{contract.notes}</p>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {contract.documentUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => window.open(contract.documentUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(contract)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(contract)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
