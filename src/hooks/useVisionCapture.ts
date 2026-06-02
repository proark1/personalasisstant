import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type VisionKind =
  | 'receipt' | 'business_card' | 'medication' | 'whiteboard'
  | 'label' | 'document' | 'contract' | 'inventory' | 'unknown';

export interface VisionExtractResult {
  capture_id: string;
  detected_kind: VisionKind;
  classification_confidence: number | null;
  extracted: Record<string, unknown>;
  ocr_text: string;
  source_language: string | null;
}

const MAX_BYTES = 10 * 1024 * 1024;

// One hook for the whole vision flow:
//   captureFromFile() — uploads to chat-attachments, calls vision-capture,
//                       returns extracted result for the UI to render.
//   commit()          — confirms (with optional edits) and creates the
//                       downstream entity.
//   discard()         — drops the row; image stays in storage for now.
//
// Phase progress: the backend's vision-capture is a single round-trip
// today (no SSE/NDJSON). We surface elapsed-time-derived phase labels
// so the UI shows the user where in the pipeline we likely are. Real
// backend streaming is a follow-up; the pattern below is forward-
// compatible — when the backend emits phases we'll just replace the
// timer ticks with stream events.
const PHASE_TICKS: Array<{ atMs: number; phase: string; description: string }> = [
  { atMs: 0,     phase: 'uploading',  description: 'Uploading image…' },
  { atMs: 1500,  phase: 'analysing',  description: 'Analysing with AI…' },
  { atMs: 8000,  phase: 'extracting', description: 'Extracting fields…' },
  { atMs: 18000, phase: 'finishing',  description: 'Almost done…' },
];

export function useVisionCapture() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VisionExtractResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<{ key: string; label: string; elapsed_ms: number } | null>(null);
  const phaseTickerRef = useRef<number | null>(null);
  const phaseStartRef = useRef<number>(0);

  const reset = useCallback(() => {
    setResult(null);
    setPhase(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }, [previewUrl]);

  // Walk PHASE_TICKS in lockstep with elapsed time. Stop when busy=false.
  const startPhaseTicker = useCallback(() => {
    phaseStartRef.current = Date.now();
    setPhase({ key: PHASE_TICKS[0].phase, label: PHASE_TICKS[0].description, elapsed_ms: 0 });
    if (phaseTickerRef.current) window.clearInterval(phaseTickerRef.current);
    phaseTickerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - phaseStartRef.current;
      let next = PHASE_TICKS[0];
      for (const t of PHASE_TICKS) {
        if (elapsed >= t.atMs) next = t;
      }
      setPhase({ key: next.phase, label: next.description, elapsed_ms: elapsed });
    }, 500);
  }, []);

  const stopPhaseTicker = useCallback(() => {
    if (phaseTickerRef.current) {
      window.clearInterval(phaseTickerRef.current);
      phaseTickerRef.current = null;
    }
    setPhase(null);
  }, []);

  // Cleanup on unmount.
  useEffect(() => () => {
    if (phaseTickerRef.current) window.clearInterval(phaseTickerRef.current);
  }, []);

  const captureFromFile = useCallback(async (
    file: File,
    opts?: { hintKind?: VisionKind },
  ): Promise<VisionExtractResult | null> => {
    if (!user?.id) return null;
    if (file.size > MAX_BYTES) {
      toast.error('Image larger than 10 MB');
      return null;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are supported');
      return null;
    }
    setBusy(true);
    setResult(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    startPhaseTicker();
    try {
      // 1. Upload to chat-attachments under <user>/vision/
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      // crypto.randomUUID is collision-resistant by spec; safer than
      // Date.now() + Math.random() under rapid successive uploads.
      const fileName = `vision/${crypto.randomUUID()}.${ext}`;
      const filePath = `${user.id}/${fileName}`;
      const { error: upErr } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`);
        return null;
      }

      // 2. Trigger classification + extraction.
      const { data, error } = await supabase.functions.invoke('vision-capture', {
        body: {
          storage_path: filePath,
          mime_type: file.type,
          size_bytes: file.size,
          hint_kind: opts?.hintKind,
        },
      });
      if (error) throw error;
      if ((data as Record<string, unknown>)?.error) throw new Error((data as Record<string, unknown>).error as string);
      const r = data as VisionExtractResult;
      setResult(r);
      return r;
    } catch (e) {
      toast.error(await describeEdgeError(e, 'Vision failed'));
      return null;
    } finally {
      setBusy(false);
      stopPhaseTicker();
    }
  }, [user?.id, previewUrl, startPhaseTicker, stopPhaseTicker]);

  const commit = useCallback(async (
    opts?: { kind?: VisionKind; payload?: Record<string, unknown> },
  ): Promise<{ created_entity_kind: string | null; created_entity_id: string | null } | null> => {
    if (!result) return null;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('vision-commit', {
        body: {
          capture_id: result.capture_id,
          kind: opts?.kind,
          payload: opts?.payload ?? result.extracted,
        },
      });
      if (error) throw error;
      const dataRecord = data as Record<string, unknown>;
      if (dataRecord?.error) throw new Error(dataRecord.error as string);
      const created = dataRecord?.created_entity_kind as string | null;
      toast.success(created ? `Saved as ${humanLabel(created)}` : ((dataRecord?.warning as string | undefined) ?? 'Saved'));
      reset();
      return data as { created_entity_kind: string | null; created_entity_id: string | null };
    } catch (e) {
      toast.error(await describeEdgeError(e, 'Commit failed'));
      return null;
    } finally {
      setBusy(false);
    }
  }, [result, reset]);

  const discard = useCallback(async () => {
    if (!result) { reset(); return; }
    try {
      // vision_captures is not in the generated Supabase types; use any to bypass type constraint
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('vision_captures')
        .update({ status: 'discarded' })
        .eq('id', result.capture_id);
    } catch (e) {
      console.warn('[useVisionCapture] discard failed', (e as Error).message);
    }
    reset();
  }, [result, reset]);

  return {
    busy,
    result,
    previewUrl,
    phase,
    captureFromFile,
    commit,
    discard,
  };
}

function humanLabel(kind: string): string {
  const map: Record<string, string> = {
    transaction: 'transaction',
    contact: 'contact',
    medication: 'medication',
    note: 'note',
    contract: 'contract',
  };
  return map[kind] ?? kind;
}
