import { CheckSquare, Calendar, FileText, User, ShoppingCart, Briefcase, Target, Mail, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActionCardData {
  type: 'task' | 'event' | 'note' | 'contact' | 'contract' | 'project' | 'habit' | 'email' | 'reminder' | 'shopping';
  action: string;
  title: string;
  details?: string;
}

const ICONS: Record<string, React.ElementType> = {
  task: CheckSquare,
  event: Calendar,
  note: FileText,
  contact: User,
  contract: Briefcase,
  project: Target,
  habit: Target,
  email: Mail,
  reminder: Bell,
  shopping: ShoppingCart,
};

export function ActionCard({ data }: { data: ActionCardData }) {
  const Icon = ICONS[data.type] || CheckSquare;

  return (
    <div className={cn('rounded-lg border border-border/50 bg-muted/30 px-3 py-2 mt-2 flex items-center gap-3 animate-fade-in')}>
      <div className="w-8 h-8 rounded-md bg-background flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-medium text-muted-foreground">{data.action}</span>
        </div>
        <p className="text-sm font-medium truncate">{data.title}</p>
        {data.details && <p className="text-xs text-muted-foreground truncate">{data.details}</p>}
      </div>
      <div className="text-primary text-xs font-medium">✓</div>
    </div>
  );
}
