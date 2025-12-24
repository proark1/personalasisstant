import { useSmartNudges } from '@/hooks/useSmartNudges';
import { NudgeOverlay } from './NudgeOverlay';
import { Task, CalendarEvent } from '@/types/flux';

interface SmartNudgeProviderProps {
  tasks: Task[];
  events: CalendarEvent[];
}

export function SmartNudgeProvider({ tasks, events }: SmartNudgeProviderProps) {
  const { activeNudge, dismissNudge } = useSmartNudges(tasks, events);

  return <NudgeOverlay nudge={activeNudge} onDismiss={dismissNudge} />;
}
