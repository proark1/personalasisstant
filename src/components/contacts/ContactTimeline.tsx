import { useMemo } from 'react';
import { Contact } from '@/hooks/useContacts';
import { ContactInteraction } from '@/hooks/useContactInteractions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, Mail, Video, MessageSquare, CheckCircle, 
  UserPlus, Calendar, Bell
} from 'lucide-react';
import { format, isToday, isYesterday, isSameWeek, differenceInDays } from 'date-fns';

interface TimelineEvent {
  id: string;
  type: 'interaction' | 'contact_due' | 'birthday' | 'added';
  date: Date;
  contact: Contact;
  interactionType?: string;
  notes?: string;
}

interface ContactTimelineProps {
  contacts: Contact[];
  interactions?: ContactInteraction[];
  showUpcoming?: boolean;
}

const EVENT_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  meeting: Video,
  message: MessageSquare,
  contact: CheckCircle,
  contact_due: Bell,
  birthday: Calendar,
  added: UserPlus,
};

export function ContactTimeline({ contacts, interactions = [], showUpcoming = true }: ContactTimelineProps) {
  const events = useMemo(() => {
    const allEvents: TimelineEvent[] = [];
    const now = new Date();

    // Add upcoming due dates
    if (showUpcoming) {
      contacts.forEach(contact => {
        if (contact.nextContactDue) {
          const daysUntil = differenceInDays(contact.nextContactDue, now);
          if (daysUntil >= -7 && daysUntil <= 30) {
            allEvents.push({
              id: `due-${contact.id}`,
              type: 'contact_due',
              date: contact.nextContactDue,
              contact,
            });
          }
        }

        // Add upcoming birthdays
        if (contact.birthDate && contact.birthdayReminder) {
          const birthday = new Date(contact.birthDate);
          birthday.setFullYear(now.getFullYear());
          if (birthday < now) {
            birthday.setFullYear(now.getFullYear() + 1);
          }
          const daysUntil = differenceInDays(birthday, now);
          if (daysUntil >= 0 && daysUntil <= 30) {
            allEvents.push({
              id: `birthday-${contact.id}`,
              type: 'birthday',
              date: birthday,
              contact,
            });
          }
        }
      });
    }

    // Add interaction history
    interactions.forEach(interaction => {
      const contact = contacts.find(c => c.id === interaction.contactId);
      if (contact) {
        allEvents.push({
          id: interaction.id,
          type: 'interaction',
          date: interaction.interactionDate,
          contact,
          interactionType: interaction.interactionType,
          notes: interaction.notes,
        });
      }
    });

    // Sort by date (newest/upcoming first for past, soonest first for future)
    allEvents.sort((a, b) => {
      const aIsPast = a.date < now;
      const bIsPast = b.date < now;
      
      if (aIsPast && bIsPast) {
        return b.date.getTime() - a.date.getTime(); // Newest first for past
      } else if (!aIsPast && !bIsPast) {
        return a.date.getTime() - b.date.getTime(); // Soonest first for future
      } else {
        return aIsPast ? 1 : -1; // Future before past
      }
    });

    return allEvents;
  }, [contacts, interactions, showUpcoming]);

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    if (isSameWeek(date, new Date())) return format(date, 'EEEE');
    return format(date, 'MMM d, yyyy');
  };

  const getEventColor = (event: TimelineEvent) => {
    const now = new Date();
    if (event.type === 'contact_due') {
      const daysUntil = differenceInDays(event.date, now);
      if (daysUntil < 0) return 'bg-red-500';
      if (daysUntil <= 3) return 'bg-orange-500';
      return 'bg-blue-500';
    }
    if (event.type === 'birthday') return 'bg-pink-500';
    if (event.type === 'interaction') return 'bg-green-500';
    return 'bg-gray-500';
  };

  const getEventDescription = (event: TimelineEvent) => {
    const now = new Date();
    switch (event.type) {
      case 'contact_due': {
        const daysUntil = differenceInDays(event.date, now);
        if (daysUntil < 0) return `Contact ${-daysUntil} days overdue`;
        if (daysUntil === 0) return 'Contact due today';
        return `Contact due in ${daysUntil} days`;
      }
      case 'birthday': {
        const daysUntil = differenceInDays(event.date, now);
        if (daysUntil === 0) return "Today is their birthday!";
        return `Birthday in ${daysUntil} days`;
      }
      case 'interaction':
        return event.notes || `${event.interactionType} interaction`;
      default:
        return '';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: TimelineEvent[] }[] = [];
    let currentLabel = '';

    events.forEach(event => {
      const label = getDateLabel(event.date);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, events: [] });
      }
      groups[groups.length - 1].events.push(event);
    });

    return groups;
  }, [events]);

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No timeline events to display.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {groupedEvents.map((group, groupIndex) => (
            <div key={groupIndex}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground px-2">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-3">
                {group.events.map(event => {
                  const IconComponent = EVENT_ICONS[event.interactionType || event.type] || CheckCircle;
                  
                  return (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-full ${getEventColor(event)}`}>
                        <IconComponent className="w-3 h-3 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(event.contact.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm truncate">
                            {event.contact.name}
                          </span>
                          {event.type === 'birthday' && (
                            <Badge variant="secondary" className="text-xs">🎂</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {getEventDescription(event)}
                        </p>
                      </div>

                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(event.date, 'h:mm a')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
