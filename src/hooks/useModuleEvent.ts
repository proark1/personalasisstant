/**
 * useModuleEvent — React-friendly subscription to ModuleEventBus.
 *
 * Lets any hook or component listen for cross-module events and refresh
 * accordingly. Auto-cleanup on unmount.
 */
import { useEffect, useRef } from "react";
import { moduleBus, type ModuleEvent, type ModuleEventName } from "@/lib/moduleEventBus";

export function useModuleEvent<T = unknown>(
  eventName: ModuleEventName | ModuleEventName[],
  handler: (event: ModuleEvent<T>) => void,
): void {
  // Keep handler ref stable so subscription doesn't churn each render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const names = Array.isArray(eventName) ? eventName : [eventName];
    const disposers = names.map((name) => moduleBus.on<T>(name, (e) => handlerRef.current(e)));
    return () => disposers.forEach((d) => d());
    // eventName arrays are recreated every render; serialize for stable dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(eventName) ? eventName.join(",") : eventName]);
}
