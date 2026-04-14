import { CheckSquare, Calendar, FileText, User, ShoppingCart, Briefcase, Target, Mail, Bell, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const COLORS: Record<string, string> = {
  task: 'border-blue-500/30 bg-blue-500/5',
  event: 'border-purple-500/30 bg-purple-500/5',
  note: 'border-yellow-500/30 bg-yellow-500/5',
  contact: 'border-green-500/30 bg-green-500/5',
  contract: 'border-orange-500/30 bg-orange-500/5',
  project: 'border-indigo-500/30 bg-indigo-500/5',
  habit: 'border-pink-500/30 bg-pink-500/5',
  email: 'border-cyan-500/30 bg-cyan-500/5',
  reminder: 'border-amber-500/30 bg-amber-500/5',
  shopping: 'border-emerald-500/30 bg-emerald-500/5',
};

export function ActionCard({ data }: { data: ActionCardData }) {
  const Icon = ICONS[data.type] || CheckSquare;
  const colorClass = COLORS[data.type] || 'border-border bg-muted/5';

  return (
    <div className={cn('rounded-lg border px-3 py-2 mt-2 flex items-center gap-3 animate-fade-in', colorClass)}>
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
      <div className="text-green-500 text-xs font-medium">✓</div>
    </div>
  );
}
