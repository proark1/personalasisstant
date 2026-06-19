import { useState, useCallback, useRef } from "react";
import { toast } from "@/hooks/use-toast";

const UNDO_TIMEOUT = 5000;

export function useUndoDelete<T extends { id: string; title: string }>() {
  const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pendingDeletesRef = useRef<Map<string, { deleteCallback: () => Promise<void> }>>(new Map());

  const softDelete = useCallback(
    async (item: T, type: "task" | "event", deleteCallback: () => Promise<void>) => {
      const id = item.id;

      const existingTimeout = timeoutsRef.current.get(id);
      if (existingTimeout) clearTimeout(existingTimeout);

      setTrashedIds((prev) => new Set(prev).add(id));
      pendingDeletesRef.current.set(id, { deleteCallback });

      const toastResult = toast({
        title: `${type === "task" ? "Task" : "Event"} deleted`,
        description: `"${item.title}" — Tap Undo to restore`,
        duration: UNDO_TIMEOUT,
      });

      // Store undo handler so TaskList can call it
      const undoHandler = () => {
        const timeout = timeoutsRef.current.get(id);
        if (timeout) clearTimeout(timeout);
        timeoutsRef.current.delete(id);
        pendingDeletesRef.current.delete(id);
        setTrashedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toastResult.dismiss();
        toast({
          title: "Restored",
          description: `"${item.title}" has been restored`,
          duration: 2000,
        });
      };

      const timeout = setTimeout(async () => {
        const pending = pendingDeletesRef.current.get(id);
        if (pending) {
          await pending.deleteCallback();
          pendingDeletesRef.current.delete(id);
        }
        timeoutsRef.current.delete(id);
        setTrashedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, UNDO_TIMEOUT);

      timeoutsRef.current.set(id, timeout);

      return { undo: undoHandler, dismiss: toastResult.dismiss };
    },
    [],
  );

  const softDeleteBulk = useCallback(
    async (items: T[], type: "task" | "event", deleteCallback: () => Promise<void>) => {
      const ids = items.map((i) => i.id);

      setTrashedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });

      const bulkKey = ids.join(",");
      pendingDeletesRef.current.set(bulkKey, { deleteCallback });

      const toastResult = toast({
        title: `${items.length} ${type}s deleted`,
        description: `Tap Undo to restore`,
        duration: UNDO_TIMEOUT,
      });

      const undoHandler = () => {
        const timeout = timeoutsRef.current.get(bulkKey);
        if (timeout) clearTimeout(timeout);
        timeoutsRef.current.delete(bulkKey);
        pendingDeletesRef.current.delete(bulkKey);
        setTrashedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        toastResult.dismiss();
        toast({
          title: "Restored",
          description: `${items.length} ${type}s have been restored`,
          duration: 2000,
        });
      };

      const timeout = setTimeout(async () => {
        const pending = pendingDeletesRef.current.get(bulkKey);
        if (pending) {
          await pending.deleteCallback();
          pendingDeletesRef.current.delete(bulkKey);
        }
        timeoutsRef.current.delete(bulkKey);
        setTrashedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }, UNDO_TIMEOUT);

      timeoutsRef.current.set(bulkKey, timeout);

      return { undo: undoHandler, dismiss: toastResult.dismiss };
    },
    [],
  );

  const isItemTrashed = useCallback(
    (id: string) => {
      return trashedIds.has(id);
    },
    [trashedIds],
  );

  return {
    trashedIds,
    softDelete,
    softDeleteBulk,
    isItemTrashed,
  };
}
