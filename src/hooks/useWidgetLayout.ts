import { useState, useEffect, useCallback } from "react";

export interface Widget {
  id: string;
  type:
    | "weather"
    | "prayer_times"
    | "tasks_today"
    | "streak"
    | "quick_add"
    | "upcoming_events"
    | "focus_stats"
    | "ai_suggestion"
    | "week_glance";
  title: string;
  enabled: boolean;
  size: "small" | "medium" | "large";
  order: number;
}

const DEFAULT_WIDGETS: Widget[] = [
  { id: "streak", type: "streak", title: "Streak", enabled: true, size: "small", order: 0 },
  {
    id: "tasks_today",
    type: "tasks_today",
    title: "Today's Tasks",
    enabled: true,
    size: "medium",
    order: 1,
  },
  {
    id: "ai_suggestion",
    type: "ai_suggestion",
    title: "AI Suggestion",
    enabled: true,
    size: "medium",
    order: 2,
  },
  { id: "weather", type: "weather", title: "Weather", enabled: true, size: "small", order: 3 },
  {
    id: "prayer_times",
    type: "prayer_times",
    title: "Prayer Times",
    enabled: false,
    size: "small",
    order: 4,
  },
  {
    id: "upcoming_events",
    type: "upcoming_events",
    title: "Upcoming Events",
    enabled: true,
    size: "medium",
    order: 5,
  },
  {
    id: "focus_stats",
    type: "focus_stats",
    title: "Focus Stats",
    enabled: true,
    size: "small",
    order: 6,
  },
  {
    id: "week_glance",
    type: "week_glance",
    title: "Week at a Glance",
    enabled: false,
    size: "large",
    order: 7,
  },
  {
    id: "quick_add",
    type: "quick_add",
    title: "Quick Add",
    enabled: true,
    size: "small",
    order: 8,
  },
];

const STORAGE_KEY = "darai-widget-layout";

export function useWidgetLayout() {
  const [widgets, setWidgets] = useState<Widget[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new widgets
        const storedIds = new Set(parsed.map((w: Widget) => w.id));
        const merged = [...parsed];
        DEFAULT_WIDGETS.forEach((w) => {
          if (!storedIds.has(w.id)) {
            merged.push(w);
          }
        });
        return merged.sort((a: Widget, b: Widget) => a.order - b.order);
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_WIDGETS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }, [widgets]);

  const toggleWidget = useCallback((widgetId: string) => {
    setWidgets((prev) => prev.map((w) => (w.id === widgetId ? { ...w, enabled: !w.enabled } : w)));
  }, []);

  const reorderWidgets = useCallback((fromIndex: number, toIndex: number) => {
    setWidgets((prev) => {
      const enabledWidgets = prev.filter((w) => w.enabled);
      const disabledWidgets = prev.filter((w) => !w.enabled);

      const [removed] = enabledWidgets.splice(fromIndex, 1);
      enabledWidgets.splice(toIndex, 0, removed);

      const reordered = enabledWidgets.map((w, i) => ({ ...w, order: i }));
      const allWidgets = [
        ...reordered,
        ...disabledWidgets.map((w, i) => ({ ...w, order: reordered.length + i })),
      ];

      return allWidgets;
    });
  }, []);

  const updateWidgetSize = useCallback((widgetId: string, size: Widget["size"]) => {
    setWidgets((prev) => prev.map((w) => (w.id === widgetId ? { ...w, size } : w)));
  }, []);

  const resetToDefaults = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const enabledWidgets = widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order);
  const disabledWidgets = widgets.filter((w) => !w.enabled);

  return {
    widgets,
    enabledWidgets,
    disabledWidgets,
    toggleWidget,
    reorderWidgets,
    updateWidgetSize,
    resetToDefaults,
  };
}
