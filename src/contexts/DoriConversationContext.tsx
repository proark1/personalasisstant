import { createContext, useContext, useState, useRef, useCallback, useMemo, ReactNode } from 'react';
import type { ChatMessage } from '@/types/flux';
import type { ActionCardData } from '@/components/assistant/ActionCard';

/** The slice of Dori's conversation that surfaces (e.g. the Dori bar) render. */
export interface DoriSnapshot {
  messages: ChatMessage[];
  isProcessing: boolean;
  thinkingStatus?: string;
  actionCards: ActionCardData[];
}

interface DoriConversationValue extends DoriSnapshot {
  /** Whether the inline conversation popover is open. */
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Send a prompt to Dori and open the inline conversation. */
  send: (text: string) => void;
  /** Index publishes its live conversation state here (single source of truth stays in Index). */
  publish: (snapshot: DoriSnapshot) => void;
  /** Index registers its send handler so any surface can drive the brain. */
  registerSend: (fn: (text: string) => void) => void;
}

const EMPTY: DoriSnapshot = { messages: [], isProcessing: false, thinkingStatus: undefined, actionCards: [] };

const DoriConversationContext = createContext<DoriConversationValue | null>(null);

/**
 * Lets any surface read Dori's live conversation and send to the brain without
 * being a child of Index. Index remains the single owner of the conversation
 * state and the 71-tool send handler; it *publishes* a snapshot and *registers*
 * its handler here (publish/mirror), so this provider stays a thin, low-risk
 * bridge rather than relocating ~600 lines of tool-execution logic.
 */
export function DoriConversationProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<DoriSnapshot>(EMPTY);
  const [isOpen, setIsOpen] = useState(false);
  const sendRef = useRef<((text: string) => void) | null>(null);

  // Index re-publishes a fresh snapshot object on every streaming token/commit.
  // Bail out when nothing the surfaces render actually changed, so the context
  // value keeps a stable reference and consumers (the Dori bar) don't re-render
  // on no-op publishes. messages/actionCards are compared by reference because
  // Index produces new arrays only when their contents change.
  const publish = useCallback((s: DoriSnapshot) => {
    setSnapshot(prev =>
      prev.messages === s.messages &&
      prev.actionCards === s.actionCards &&
      prev.isProcessing === s.isProcessing &&
      prev.thinkingStatus === s.thinkingStatus
        ? prev
        : s,
    );
  }, []);
  const registerSend = useCallback((fn: (text: string) => void) => { sendRef.current = fn; }, []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setIsOpen(true);
    sendRef.current?.(trimmed);
  }, []);

  const value = useMemo<DoriConversationValue>(
    () => ({ ...snapshot, isOpen, open, close, send, publish, registerSend }),
    [snapshot, isOpen, open, close, send, publish, registerSend],
  );

  return <DoriConversationContext.Provider value={value}>{children}</DoriConversationContext.Provider>;
}

export function useDoriConversation(): DoriConversationValue {
  const ctx = useContext(DoriConversationContext);
  if (!ctx) throw new Error('useDoriConversation must be used within DoriConversationProvider');
  return ctx;
}
