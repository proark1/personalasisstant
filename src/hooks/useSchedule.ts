import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { useAuth } from './useAuth';
import { useSharedRealtime } from './useSharedRealtime';
import { toast } from 'sonner';

export type ProposalStatus = 'draft' | 'reviewed' | 'accepted' | 'rejected' | 'superseded';
export type BlockKind = 'deep' | 'shallow' | 'meeting' | 'admin' | 'break' | 'errand';

export interface ScheduleBlock {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  kind: BlockKind;
  title: string;
  rationale: string;
  task_id?: string | null;
  priority?: 'high' | 'medium' | 'low' | null;
  accepted: boolean | null;
  applied_event_id: string | null;
}

export interface ScheduleProposal {
  id: string;
  range_start: string;
  range_end: string;
  status: ProposalStatus;
  blocks: ScheduleBlock[];
  rationale: string | null;
  model: string | null;
  generation_ms: number | null;
  input_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface GenerateOpts {
  rangeStart?: string;
  days?: number;
  timezone?: string;
  deepWorkHours?: [number, number];
  constraints?: string[];
}

// Hook for the predictive scheduler. Loads the latest active
// proposal, lets the user generate a new one, and applies block
// accept/reject decisions through the apply-schedule edge fn.
export function useSchedule() {
  const { user } = useAuth();
  const [latest, setLatest] = useState<ScheduleProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('schedule_proposals')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['draft', 'reviewed', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setLatest(data ? normalise(data) : null);
    } catch (e) {
      console.warn('[useSchedule] refresh failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: any proposal change repaints. Goes through the shared
  // coordinator so multiple useSchedule() callers don't each spin up
  // their own channel and trip supabase-js's "can't add callbacks
  // after subscribe()" guard.
  useSharedRealtime('schedule_proposals', user?.id, () => { refresh(); });

  const generate = useCallback(async (opts: GenerateOpts = {}) => {
    if (!user?.id) return null;
    setBusy(true);
    try {
      const tz = opts.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { data, error } = await supabase.functions.invoke('propose-schedule', {
        body: {
          range_start: opts.rangeStart,
          days: opts.days ?? 7,
          timezone: tz,
          deep_work_hours: opts.deepWorkHours,
          constraints: opts.constraints ?? [],
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const count = (data as any)?.block_count ?? 0;
      toast.success(`Drafted ${count} block${count === 1 ? '' : 's'}`);
      await refresh();
      return data;
    } catch (e) {
      toast.error(await describeEdgeError(e, 'Schedule failed'));
      return null;
    } finally {
      setBusy(false);
    }
  }, [user?.id, refresh]);

  const acceptBlocks = useCallback(async (proposalId: string, blockIds: string[]) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('apply-schedule', {
        body: { proposal_id: proposalId, action: 'accept_blocks', block_ids: blockIds },
      });
      if (error) throw error;
      const applied = (data as any)?.applied ?? 0;
      toast.success(`${applied} block${applied === 1 ? '' : 's'} added to calendar`);
      await refresh();
      return data;
    } catch (e) {
      toast.error(await describeEdgeError(e, 'Apply failed'));
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const acceptAll = useCallback(async (proposalId: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('apply-schedule', {
        body: { proposal_id: proposalId, action: 'accept_all' },
      });
      if (error) throw error;
      const applied = (data as any)?.applied ?? 0;
      toast.success(`Accepted all (${applied} blocks)`);
      await refresh();
      return data;
    } catch (e) {
      toast.error(await describeEdgeError(e, 'Apply failed'));
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const rejectAll = useCallback(async (proposalId: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('apply-schedule', {
        body: { proposal_id: proposalId, action: 'reject_all' },
      });
      if (error) throw error;
      toast.info('Schedule rejected');
      await refresh();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const markReviewed = useCallback(async (proposalId: string) => {
    try {
      await supabase.functions.invoke('apply-schedule', {
        body: { proposal_id: proposalId, action: 'mark_reviewed' },
      });
      await refresh();
    } catch (e) { /* non-blocking */ console.warn((e as Error).message); }
  }, [refresh]);

  return {
    latest,
    busy,
    loading,
    refresh,
    generate,
    acceptBlocks,
    acceptAll,
    rejectAll,
    markReviewed,
  };
}

function normalise(r: any): ScheduleProposal {
  return {
    id: r.id,
    range_start: r.range_start,
    range_end: r.range_end,
    status: r.status,
    blocks: Array.isArray(r.blocks) ? r.blocks : [],
    rationale: r.rationale ?? null,
    model: r.model ?? null,
    generation_ms: r.generation_ms ?? null,
    input_snapshot: r.input_snapshot ?? {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
