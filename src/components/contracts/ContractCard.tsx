import { Contract, CONTRACT_CATEGORIES } from '@/hooks/useContracts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Pencil, 
  Trash2, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  FileText,
  Mail,
  Eye,
  MoreVertical,
  CalendarPlus,
  Sparkles,
  BellOff,
  Share2
} from 'lucide-react';
import { format, differenceInDays, isFuture } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { ContractHealthBadge } from './ContractHealthScore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ContractCardProps {
  contract: Contract;
  onEdit: (contract: Contract) => void;
  onDelete: (contract: Contract) => void;
  onShare?: (contract: Contract) => void;
  onGenerateEmail?: (contract: Contract) => void;
  onPreviewDocument?: (contract: Contract) => void;
  onSyncToCalendar?: (contract: Contract) => void;
  onScanDocument?: (contract: Contract) => void;
  onSnoozeReminder?: (contract: Contract) => void;
  isSelected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  showBulkSelect?: boolean;
}

export function ContractCard({ 
  contract, 
  onEdit, 
  onDelete,
  onShare,
  onGenerateEmail,
  onPreviewDocument,
  onSyncToCalendar,
  onScanDocument,
  onSnoozeReminder,
  isSelected,
  onSelectChange,
  showBulkSelect
}: ContractCardProps) {
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
  
  // Check if reminder is snoozed
  const isReminderSnoozed = contract.reminderSnoozedUntil && isFuture(contract.reminderSnoozedUntil);
  const isCancellationSoon = !isReminderSnoozed && daysUntilCancellation !== null && daysUntilCancellation >= 0 && daysUntilCancellation <= 14;

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

  const handleViewDocument = async () => {
    if (!contract.documentUrl) return;

    // Use preview dialog if available
    if (onPreviewDocument) {
      onPreviewDocument(contract);
      return;
    }

    // Fallback to opening in new tab
    if (contract.documentUrl.startsWith('http')) {
      window.open(contract.documentUrl, '_blank');
    } else {
      const { data } = await supabase.storage
        .from('contract-documents')
        .createSignedUrl(contract.documentUrl, 60 * 60);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    }
  };

  return (
    <Card className={cn(
      "group relative transition-all hover:shadow-md",
      !contract.isActive && "opacity-60",
      isCancellationSoon && "border-destructive/50 bg-destructive/5",
      isSelected && "ring-2 ring-primary"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Bulk select checkbox */}
          {showBulkSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelectChange}
              className="mt-1"
            />
          )}

          {/* Left: Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{categoryInfo?.icon || '📄'}</span>
              <h3 className="font-medium truncate">{contract.name}</h3>
              {!contract.isActive && (
                <Badge variant="secondary" className="text-xs">Inactive</Badge>
              )}
              <ContractHealthBadge contract={contract} />
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

            {/* Snoozed indicator */}
            {isReminderSnoozed && contract.reminderSnoozedUntil && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <BellOff className="h-3 w-3" />
                <span>
                  Reminders snoozed until {format(contract.reminderSnoozedUntil, 'MMM d, yyyy')}
                </span>
              </div>
            )}

            {contract.notes && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{contract.notes}</p>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            {/* Quick actions visible on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {contract.documentUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleViewDocument}
                  title="View document"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(contract)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            
            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(contract)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {contract.documentUrl && (
                  <DropdownMenuItem onClick={handleViewDocument}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Document
                  </DropdownMenuItem>
                )}
                {contract.documentUrl && onScanDocument && (
                  <DropdownMenuItem onClick={() => onScanDocument(contract)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Scan Document
                  </DropdownMenuItem>
                )}
                {onGenerateEmail && (
                  <DropdownMenuItem onClick={() => onGenerateEmail(contract)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Generate Cancellation Email
                  </DropdownMenuItem>
                )}
                {onSyncToCalendar && contract.renewalDate && (
                  <DropdownMenuItem onClick={() => onSyncToCalendar(contract)}>
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Add to Calendar
                  </DropdownMenuItem>
                )}
                {onSnoozeReminder && contract.autoRenews && contract.renewalDate && (
                  <DropdownMenuItem onClick={() => onSnoozeReminder(contract)}>
                    <BellOff className="h-4 w-4 mr-2" />
                    {isReminderSnoozed ? 'Update Snooze' : 'Snooze Reminders'}
                  </DropdownMenuItem>
                )}
                {onShare && (
                  <DropdownMenuItem onClick={() => onShare(contract)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete(contract)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
