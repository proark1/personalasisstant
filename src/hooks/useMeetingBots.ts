import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { useAuth } from './useAuth';
import { useSharedRealtime } from './useSharedRealtime';
import { toast } from 'sonner';

export type MeetingBotStatus =
  | 'pending'
  | 'scheduled'
  | 'joining'
  | 'in_call'
  | 'call_ended'
  | 'transcript_ready'
  | 'analysis_ready'
  | 'done'
  | 'error'
  | 'cancelled';

export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: number;
  source?: 'voice' | 'chat';
}

export interface ActionItem {
  task: string;
  assignee?: string;
}

export interface MeetingBotRow {
  id: string;
  externalBotId: string | null;
  meetingUrl: string;
  title: string | null;
  botName: string;
  status: MeetingBotStatus;
  joinAt: string | null;
  joinedAt: string | null;
  endedAt: string | null;
  transcript: TranscriptEntry[];
  summary: string | null;
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
  nextSteps: string[];
  topics: string[];
  sentiment: string | null;
  errorMessage: string | null;
  tasksCreatedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleArgs {
  meetingUrl: string;
  title?: string;
  botName?: string;
  joinAt?: string | null;
  eventId?: string | null;
  workspaceId?: string | null;
  recordVideo?: boolean;
  vocabulary?: string[];
}

const ACTIVE: MeetingBotStatus[] = [
  'pending', 'scheduled', 'joining', 'in_call',
  'call_ended', 'transcript_ready', 'analysis_ready',
];

// Manages meeting copilots (rows in `meeting_bots`). Reads from the
// table directly (RLS scopes to user) and pushes mutations through
// the edge functions so the upstream MeetingBot service is kept in
// sync transactionally.
export function useMeetingBots() {
  const { user } = useAuth();
  const [bots, setBots] = useState<MeetingBotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from('meeting_bots')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setBots((data ?? []).map(rowFromDb));
    } catch (e) {
      console.warn('[useMeetingBots] refresh failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Routed through the shared coordinator so multiple useMeetingBots()
  // callers don't each spin up their own channel.
  useSharedRealtime('meeting_bots', user?.id, () => { refresh(); });

  const schedule = useCallback(async (args: ScheduleArgs) => {
    try {
      const { data, error } = await supabase.functions.invoke('meeting-bot-schedule', {
        body: {
          meeting_url: args.meetingUrl,
          title: args.title,
          bot_name: args.botName,
          join_at: args.joinAt ?? null,
          event_id: args.eventId ?? null,
          workspace_id: args.workspaceId ?? null,
          record_video: !!args.recordVideo,
          vocabulary: args.vocabulary ?? [],
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(`Schedule failed: ${data.error}`);
        return null;
      }
      toast.success('Bot scheduled');
      await refresh();
      return data;
    } catch (e) {
      toast.error(await describeEdgeError(e, 'Failed to schedule bot'));
      return null;
    }
  }, [refresh]);

  const cancel = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase.functions.invoke('meeting-bot-control', {
        body: { id, action: 'cancel' },
      });
      if (error) throw error;
      toast.info('Bot cancelled');
      await refresh();
    } catch (e) {
      toast.error(await describeEdgeError(e, 'Failed to cancel bot'));
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  const refreshOne = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase.functions.invoke('meeting-bot-control', {
        body: { id, action: 'refresh' },
      });
      if (error) throw error;
      await refresh();
    } catch (e) {
      toast.error(await describeEdgeError(e, 'Failed to refresh bot'));
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  const activeCount = bots.filter((b) => ACTIVE.includes(b.status)).length;

  return {
    bots,
    activeCount,
    loading,
    busyId,
    refresh,
    schedule,
    cancel,
    refreshOne,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowFromDb(r: any): MeetingBotRow {
  return {
    id: r.id,
    externalBotId: r.external_bot_id ?? null,
    meetingUrl: r.meeting_url,
    title: r.title ?? null,
    botName: r.bot_name,
    status: r.status as MeetingBotStatus,
    joinAt: r.join_at ?? null,
    joinedAt: r.joined_at ?? null,
    endedAt: r.ended_at ?? null,
    transcript: Array.isArray(r.transcript) ? r.transcript : [],
    summary: r.summary ?? null,
    keyPoints: Array.isArray(r.key_points) ? r.key_points : [],
    actionItems: Array.isArray(r.action_items) ? r.action_items : [],
    decisions: Array.isArray(r.decisions) ? r.decisions : [],
    nextSteps: Array.isArray(r.next_steps) ? r.next_steps : [],
    topics: Array.isArray(r.topics) ? r.topics : [],
    sentiment: r.sentiment ?? null,
    errorMessage: r.error_message ?? null,
    tasksCreatedCount: Number(r.tasks_created_count ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
