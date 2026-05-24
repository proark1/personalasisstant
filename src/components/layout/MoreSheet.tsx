import { useState, useMemo, useEffect } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHaptics } from '@/hooks/useHaptics';
import {
  BookUser, FileText, StickyNote, Flame, Heart, Utensils, Moon,
  Building2, Briefcase, Newspaper, MessageCircle, Settings,
  MoreHorizontal, Mail, CheckSquare, Search, Clock,
  Users, FolderKanban, Activity, BookHeart, GraduationCap,
  Wallet, Plane, Home, Pill, Target, CalendarCheck, Sparkles, Trophy, MapPin,
  Baby, LineChart, Video,
} from 'lucide-react';

export type MoreSheetPanel =
  | 'contacts' | 'contracts' | 'notes' | 'habits'
  | 'health' | 'family' | 'cooking' | 'islam' | 'properties' | 'assets'
  | 'startups' | 'news' | 'social' | 'settings' | 'email' | 'tasks'
  | 'projects' | 'activity' | 'journal' | 'learning'
  | 'finances' | 'travel' | 'personal-health' | 'relationships-plus'
  | 'assistant' | 'challenges' | 'location-reminders'
  | 'family-members' | 'family-calendar' | 'child-mode' | 'correlations' | 'meetings';

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (panel: MoreSheetPanel) => void;
  activePanel?: string;
}

const allItems = [
  // Assistant & Capture
  { id: 'assistant' as const, icon: Sparkles, labelKey: 'nav.assistant', section: 'Assistant & Capture' },
  { id: 'notes' as const, icon: StickyNote, labelKey: 'nav.notes', section: 'Assistant & Capture' },
  { id: 'journal' as const, icon: BookHeart, labelKey: 'nav.journal', section: 'Assistant & Capture' },
  { id: 'activity' as const, icon: Activity, labelKey: 'nav.activity', section: 'Assistant & Capture' },
  { id: 'location-reminders' as const, icon: MapPin, labelKey: 'Location Reminders', section: 'Assistant & Capture' },

  // Family & Home
  { id: 'family' as const, icon: Users, labelKey: 'nav.familyHub', section: 'Family & Home' },
  { id: 'cooking' as const, icon: Utensils, labelKey: 'nav.cooking', section: 'Family & Home' },
  { id: 'health' as const, icon: Heart, labelKey: 'nav.health', section: 'Family & Home' },
  { id: 'personal-health' as const, icon: Pill, labelKey: 'nav.personalHealth', section: 'Family & Home' },
  { id: 'habits' as const, icon: Flame, labelKey: 'nav.habits', section: 'Family & Home' },
  { id: 'relationships-plus' as const, icon: Heart, labelKey: 'nav.relationships', section: 'Family & Home' },
  { id: 'islam' as const, icon: Moon, labelKey: 'nav.islam', section: 'Family & Home' },
  { id: 'challenges' as const, icon: Trophy, labelKey: 'Challenges', section: 'Family & Home' },
  { id: 'family-members' as const, icon: Users, labelKey: 'Family Members', section: 'Family & Home' },
  { id: 'family-calendar' as const, icon: CalendarCheck, labelKey: 'Family Calendar', section: 'Family & Home' },
  { id: 'child-mode' as const, icon: Baby, labelKey: 'Child Mode', section: 'Family & Home' },

  // Communication
  { id: 'email' as const, icon: Mail, labelKey: 'nav.email', section: 'Communication' },
  { id: 'social' as const, icon: MessageCircle, labelKey: 'nav.social', section: 'Communication' },
  { id: 'contacts' as const, icon: BookUser, labelKey: 'nav.contacts', section: 'Communication' },

  // Work & Money
  { id: 'projects' as const, icon: FolderKanban, labelKey: 'nav.projects', section: 'Work & Money' },
  { id: 'startups' as const, icon: Briefcase, labelKey: 'nav.startups', section: 'Work & Money' },
  { id: 'contracts' as const, icon: FileText, labelKey: 'nav.contracts', section: 'Work & Money' },
  { id: 'finances' as const, icon: Wallet, labelKey: 'nav.finances', section: 'Work & Money' },
  { id: 'assets' as const, icon: Home, labelKey: 'nav.assets', section: 'Work & Money' },
  { id: 'travel' as const, icon: Plane, labelKey: 'nav.travel', section: 'Work & Money' },
  { id: 'news' as const, icon: Newspaper, labelKey: 'nav.news', section: 'Work & Money' },
  { id: 'meetings' as const, icon: Video, labelKey: 'Meeting Bots', section: 'Work & Money' },

  // Learn
  { id: 'learning' as const, icon: GraduationCap, labelKey: 'nav.learning', section: 'Learn' },
  { id: 'correlations' as const, icon: LineChart, labelKey: 'Life Correlations', section: 'Learn' },

  // Settings
  { id: 'settings' as const, icon: Settings, labelKey: 'nav.settings', section: 'Settings' },
];

const RECENTS_KEY = 'moresheet-recents';

function getRecents(): MoreSheetPanel[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  } catch { return []; }
}

function addRecent(panel: MoreSheetPanel) {
  const recents = getRecents().filter(p => p !== panel);
  recents.unshift(panel);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 3)));
}

const staggerContainer = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};
const staggerItem = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
};

export function MoreSheet({ open, onOpenChange, onNavigate, activePanel }: MoreSheetProps) {
  const { t } = useLanguage();
  const { vibrate } = useHaptics();
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState<MoreSheetPanel[]>([]);

  useEffect(() => {
    if (open) { setRecents(getRecents()); setSearch(''); }
  }, [open]);

  const handleSelect = (panel: MoreSheetPanel) => {
    vibrate('light');
    addRecent(panel);
    onNavigate(panel);
    onOpenChange(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return allItems.filter(i => {
      const label = t(i.labelKey) || i.labelKey.split('.').pop() || '';
      return label.toLowerCase().includes(q) || i.id.includes(q);
    });
  }, [search, t]);

  const recentItems = useMemo(() =>
    recents.map(id => allItems.find(i => i.id === id)).filter(Boolean) as typeof allItems,
    [recents]
  );

  const sections = useMemo(() => {
    const items = filtered || allItems;
    const groups: Record<string, typeof allItems> = {};
    items.forEach(item => {
      const s = item.section;
      if (!groups[s]) groups[s] = [];
      groups[s].push(item);
    });
    return Object.entries(groups);
  }, [filtered]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] bg-background">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 my-3" />
        <div className="px-4 pb-8 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search panels..."
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
                {recentItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
                      "bg-primary/10 text-primary border border-primary/20",
                      "active:scale-95 touch-manipulation transition-all"
                    )}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {t(item.labelKey) || item.labelKey.split('.').pop()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sections */}
          {sections.map(([label, items]) => (
            <div key={label}>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                {label}
              </span>
              <motion.div
                className="grid grid-cols-3 gap-2 mt-2"
                variants={staggerContainer}
                initial="hidden"
                animate={open ? 'show' : 'hidden'}
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
                        "active:scale-95 touch-manipulation",
                        "border border-transparent",
                        isActive
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "text-muted-foreground hover:bg-muted glass-card"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-xs font-medium truncate w-full text-center">
                        {t(item.labelKey) || item.labelKey.split('.').pop()}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          ))}

          {filtered && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">No panels found</p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export { MoreHorizontal as MoreIcon };
