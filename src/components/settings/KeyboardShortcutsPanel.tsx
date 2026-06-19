import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Keyboard } from "lucide-react";
import { DEFAULT_SHORTCUTS } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
}

const ALL_SHORTCUTS: ShortcutItem[] = [
  DEFAULT_SHORTCUTS.newTask,
  DEFAULT_SHORTCUTS.search,
  DEFAULT_SHORTCUTS.focusMode,
  DEFAULT_SHORTCUTS.dashboard,
  DEFAULT_SHORTCUTS.voiceMode,
  { key: "?", description: "Show keyboard shortcuts" },
  { key: "Escape", description: "Close dialogs / Exit modes" },
];

function KeyCombo({ shortcut }: { shortcut: ShortcutItem }) {
  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");

  const parts: string[] = [];

  if (shortcut.ctrlKey) {
    parts.push(isMac ? "⌘" : "Ctrl");
  }
  if (shortcut.shiftKey) {
    parts.push(isMac ? "⇧" : "Shift");
  }
  if (shortcut.altKey) {
    parts.push(isMac ? "⌥" : "Alt");
  }

  // Format the key nicely
  let keyDisplay = shortcut.key;
  if (shortcut.key === "Escape") keyDisplay = "Esc";
  else if (shortcut.key.length === 1) keyDisplay = shortcut.key.toUpperCase();

  parts.push(keyDisplay);

  return (
    <div className="flex items-center gap-1">
      {parts.map((part, i) => (
        <Badge key={i} variant="outline" className="px-2 py-0.5 font-mono text-xs bg-muted">
          {part}
        </Badge>
      ))}
    </div>
  );
}

export function KeyboardShortcutsPanel({ open, onOpenChange }: KeyboardShortcutsPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {ALL_SHORTCUTS.map((shortcut, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm text-foreground">{shortcut.description}</span>
              <KeyCombo shortcut={shortcut} />
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Press{" "}
            <Badge variant="outline" className="px-1.5 py-0 font-mono text-xs mx-1">
              ?
            </Badge>{" "}
            anytime to show this panel
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to integrate keyboard shortcuts panel with ? key
// eslint-disable-next-line react-refresh/only-export-components
export function useKeyboardShortcutsPanel() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check if typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }

    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { open, setOpen };
}
