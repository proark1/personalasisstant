import { useState, useMemo, useEffect } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHaptics } from "@/hooks/useHaptics";
import { MoreHorizontal, Search, Clock } from "lucide-react";
import { NAV_AREAS, SETTINGS_ITEM, resolveNavLabel, type NavItem } from "@/config/navigation";

export type MoreSheetPanel = string;

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (panel: MoreSheetPanel) => void;
  activePanel?: string;
}

interface SheetItem extends NavItem {
  section: string;
}

// Flatten the shared nav config into the flat, sectioned list the sheet wants.
const allItems: SheetItem[] = [
  ...NAV_AREAS.flatMap((area) => area.items.map((item) => ({ ...item, section: area.label }))),
  { ...SETTINGS_ITEM, section: "Settings" },
];

const RECENTS_KEY = "moresheet-recents";

function getRecents(): MoreSheetPanel[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecent(panel: MoreSheetPanel) {
  const recents = getRecents().filter((p) => p !== panel);
  recents.unshift(panel);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 3)));
}

const staggerContainer = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};
const staggerItem = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
};

export function MoreSheet({ open, onOpenChange, onNavigate, activePanel }: MoreSheetProps) {
  const { t } = useLanguage();
  const { vibrate } = useHaptics();
  const [search, setSearch] = useState("");
  const [recents, setRecents] = useState<MoreSheetPanel[]>([]);

  useEffect(() => {
    if (open) {
      setRecents(getRecents());
      setSearch("");
    }
  }, [open]);

  const labelOf = (item: SheetItem) => resolveNavLabel(item, t);

  const handleSelect = (panel: MoreSheetPanel) => {
    vibrate("light");
    addRecent(panel);
    onNavigate(panel);
    onOpenChange(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return allItems.filter((i) => labelOf(i).toLowerCase().includes(q) || i.id.includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, t]);

  const recentItems = useMemo(
    () => recents.map((id) => allItems.find((i) => i.id === id)).filter(Boolean) as SheetItem[],
    [recents],
  );

  const sections = useMemo(() => {
    const items = filtered || allItems;
    const groups: Record<string, SheetItem[]> = {};
    items.forEach((item) => {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section].push(item);
    });
    return Object.entries(groups);
  }, [filtered]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] bg-background">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 my-3 shrink-0" />
        <div className="px-4 pb-8 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-8 h-9 text-sm bg-muted border-0"
            />
          </div>

          {/* Recents */}
          {!search && recentItems.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Recent
              </span>
              <div className="flex gap-2 mt-2">
                {recentItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
                      "bg-primary/10 text-primary border border-primary/20",
                      "active:scale-95 touch-manipulation transition-all",
                    )}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {labelOf(item)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sections */}
          {sections.map(([sectionLabel, items]) => (
            <div key={sectionLabel}>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                {sectionLabel}
              </span>
              <motion.div
                className="grid grid-cols-3 gap-2 mt-2"
                variants={staggerContainer}
                initial="hidden"
                animate={open ? "show" : "hidden"}
              >
                {items.map((item) => {
                  const isActive = activePanel === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      variants={staggerItem}
                      onClick={() => handleSelect(item.id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all",
                        "active:scale-95 touch-manipulation border",
                        isActive
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "text-muted-foreground border-border bg-card hover:bg-muted",
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-xs font-medium truncate w-full text-center">
                        {labelOf(item)}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          ))}

          {filtered && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">Nothing found</p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export { MoreHorizontal as MoreIcon };
