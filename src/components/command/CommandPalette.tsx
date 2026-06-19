import { useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NAV_AREAS, SETTINGS_ITEM, type NavItem } from "@/config/navigation";
import { prefetchPanel } from "@/lib/panelPrefetch";
import { useLanguage } from "@/contexts/LanguageContext";
import { Sparkles, Search, ArrowRight } from "lucide-react";

export interface CommandPaletteAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  /** Optional keyword string to widen fuzzy matching. */
  keywords?: string;
  shortcut?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Switch the active in-shell panel. */
  onNavigate: (panelId: string) => void;
  /** Send free-text to Dori (opens the assistant). */
  onAskDori: (text: string) => void;
  /** Open the full global search surface. */
  onOpenSearch?: () => void;
  /** Quick actions surfaced at the top of the palette. */
  actions?: CommandPaletteAction[];
}

/**
 * ⌘K command palette — the fast path across the whole app. Mixes:
 *  1. Ask Dori (free-text → assistant)
 *  2. Quick actions (new task, focus timer, voice, weekly review…)
 *  3. Navigation to every panel (sourced from the single nav config)
 *  4. Escape hatch to full global search
 */
export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onAskDori,
  onOpenSearch,
  actions = [],
}: CommandPaletteProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");

  // Reset the query whenever the palette is dismissed so it always opens fresh.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const navItems = useMemo<{ area: string; items: NavItem[] }[]>(
    () => [
      ...NAV_AREAS.map((a) => ({ area: a.label, items: a.items })),
      { area: "System", items: [SETTINGS_ITEM] },
    ],
    [],
  );

  const trimmed = query.trim();

  const dismiss = (fn: () => void) => {
    onOpenChange(false);
    // Defer so the dialog close animation doesn't race the navigation.
    requestAnimationFrame(fn);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} label="Command palette">
      <CommandInput
        placeholder="Ask Dori or jump to anything…"
        value={query}
        onValueChange={setQuery}
        aria-label="Search commands, or type a question for Dori"
      />
      <CommandList>
        <CommandEmpty>No matches. Press Enter to ask Dori.</CommandEmpty>

        {trimmed.length > 0 && (
          <>
            <CommandGroup heading="Dori">
              {/* value === query keeps this item visible regardless of fuzzy filtering */}
              <CommandItem value={trimmed} onSelect={() => dismiss(() => onAskDori(trimmed))}>
                <Sparkles className="text-primary" />
                <span className="truncate">
                  Ask Dori: <span className="text-muted-foreground">“{trimmed}”</span>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {actions.length > 0 && (
          <>
            <CommandGroup heading="Actions">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.id}
                    value={`${action.label} ${action.keywords ?? ""}`}
                    onSelect={() => dismiss(action.run)}
                  >
                    <Icon className="text-muted-foreground" />
                    <span>{action.label}</span>
                    {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
                  </CommandItem>
                );
              })}
              {onOpenSearch && (
                <CommandItem value="search everything find" onSelect={() => dismiss(onOpenSearch)}>
                  <Search className="text-muted-foreground" />
                  <span>Search everything…</span>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {navItems.map(({ area, items }) => (
          <CommandGroup key={area} heading={area}>
            {items.map((item) => {
              const Icon = item.icon;
              const label = (item.labelKey && t(item.labelKey)) || item.label;
              return (
                <CommandItem
                  key={item.id}
                  value={`${label} ${item.id}`}
                  onSelect={() => dismiss(() => onNavigate(item.id))}
                  onMouseEnter={() => prefetchPanel(item.id)}
                >
                  <Icon className="text-muted-foreground" />
                  <span>{label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
