import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Users } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface ContactReminder {
  id: string;
  name: string;
  last_contacted_at: string | null;
}

interface ContactRemindersCardProps {
  contacts: ContactReminder[];
  onNavigate?: (panel: string) => void;
}

export function ContactRemindersCard({ contacts, onNavigate }: ContactRemindersCardProps) {
  if (contacts.length === 0) return null;

  return (
    <GlassCard pressable haptic="light" className="border-l-4 border-l-primary">
      <GlassCardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <GlassCardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Follow Up
          </GlassCardTitle>
          <button
            onClick={() => onNavigate?.('contacts')}
            className="text-xs text-primary hover:underline"
          >
            Reach out
          </button>
        </div>
      </GlassCardHeader>
      <GlassCardContent className="space-y-1.5">
        {contacts.map(contact => {
          const daysSince = contact.last_contacted_at
            ? differenceInDays(new Date(), new Date(contact.last_contacted_at))
            : null;

          return (
            <div
              key={contact.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50"
            >
              <p className="text-sm font-medium truncate">{contact.name}</p>
              {daysSince !== null && (
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {daysSince}d ago
                </span>
              )}
            </div>
          );
        })}
      </GlassCardContent>
    </GlassCard>
  );
}
