import { useEffect, useCallback } from "react";

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsProps {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrlKey ? e.ctrlKey || e.metaKey : !(e.ctrlKey || e.metaKey);
        const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.altKey ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export function getShortcutLabel(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) {
    parts.push(navigator.platform.includes("Mac") ? "⌘" : "Ctrl");
  }
  if (shortcut.shiftKey) {
    parts.push("Shift");
  }
  if (shortcut.altKey) {
    parts.push(navigator.platform.includes("Mac") ? "⌥" : "Alt");
  }
  parts.push(shortcut.key.toUpperCase());

  return parts.join("+");
}

export const DEFAULT_SHORTCUTS = {
  newTask: { key: "n", ctrlKey: true, description: "Create new task" },
  search: { key: "k", ctrlKey: true, description: "Search" },
  focusMode: { key: "f", ctrlKey: true, shiftKey: true, description: "Focus mode" },
  dashboard: { key: "d", ctrlKey: true, shiftKey: true, description: "Dashboard" },
  voiceMode: { key: "v", ctrlKey: true, shiftKey: true, description: "Voice mode" },
};
