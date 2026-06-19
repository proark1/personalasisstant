import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";

/**
 * Per-user dashboard customization: which Insights cards the user has hidden.
 *
 * Persisted to localStorage (keyed by user id) so it's instant and works
 * offline. Hiding is opt-in — every card is visible by default, so existing
 * users see no change until they actively declutter.
 */
const keyFor = (userId: string | undefined) => `darai-dashboard-hidden-${userId ?? "anon"}`;

export function useDashboardLayout() {
  const { user } = useAuth();
  const storageKey = keyFor(user?.id);

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [customizing, setCustomizing] = useState(false);

  // Load whenever the user (and therefore the storage key) changes.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setHidden(raw ? new Set<string>(JSON.parse(raw)) : new Set());
    } catch {
      setHidden(new Set());
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: Set<string>) => {
      setHidden(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        /* storage full / unavailable — keep in-memory state */
      }
    },
    [storageKey],
  );

  const toggleCard = useCallback(
    (id: string) => {
      const next = new Set(hidden);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
    },
    [hidden, persist],
  );

  const resetCards = useCallback(() => persist(new Set()), [persist]);

  const isHidden = useCallback((id: string) => hidden.has(id), [hidden]);

  return {
    isHidden,
    toggleCard,
    resetCards,
    hiddenCount: hidden.size,
    customizing,
    setCustomizing,
  };
}
