/**
 * Single source of truth for app navigation.
 *
 * Every nav surface — the desktop Sidebar, the mobile bottom bar, and the
 * mobile "More" sheet — renders from the structures in this file so they can
 * never drift out of sync (which is how we ended up with e.g. a "family" tab
 * labelled "Cooking" historically).
 *
 * Each leaf `id` maps 1:1 to an existing panel id understood by
 * StandardMode / MobileLayout, so changing the IA here does NOT require
 * touching the panel-rendering switch statements.
 */
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Sparkles,
  StickyNote,
  BookHeart,
  Activity,
  MapPin,
  Video,
  Mail,
  MessageCircle,
  BookUser,
  Users,
  Heart,
  Pill,
  Flame,
  Trophy,
  CalendarCheck,
  Baby,
  Utensils,
  Moon,
  FolderKanban,
  Briefcase,
  FileText,
  Wallet,
  Home,
  Plane,
  Newspaper,
  GraduationCap,
  LineChart,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  /** Panel id consumed by the layout switch statements. */
  id: string;
  /** Plain-text fallback label. */
  label: string;
  /** i18n key, tried before `label` falls back. */
  labelKey?: string;
  icon: LucideIcon;
}

export interface NavArea {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

/**
 * The 7 top-level areas. Daily-use surfaces sit at the top; the long tail is
 * tucked inside an area rather than exposed as its own flat row.
 */
export const NAV_AREAS: NavArea[] = [
  {
    id: 'home',
    label: 'Home',
    icon: LayoutDashboard,
    items: [
      { id: 'dashboard', label: 'Dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
    ],
  },
  {
    id: 'plan',
    label: 'Plan',
    icon: CheckSquare,
    items: [
      { id: 'tasks', label: 'Tasks', labelKey: 'nav.tasks', icon: CheckSquare },
      { id: 'calendar', label: 'Calendar', labelKey: 'nav.calendar', icon: Calendar },
    ],
  },
  {
    id: 'dori',
    label: 'Dori',
    icon: Sparkles,
    items: [
      { id: 'assistant', label: 'Assistant', labelKey: 'nav.assistant', icon: Sparkles },
      { id: 'notes', label: 'Notes', labelKey: 'nav.notes', icon: StickyNote },
      { id: 'journal', label: 'Journal', labelKey: 'nav.journal', icon: BookHeart },
      { id: 'activity', label: 'Activity', labelKey: 'nav.activity', icon: Activity },
      { id: 'location-reminders', label: 'Location Reminders', icon: MapPin },
      { id: 'meetings', label: 'Meeting Bots', icon: Video },
    ],
  },
  {
    id: 'people',
    label: 'People',
    icon: Users,
    items: [
      { id: 'email', label: 'Email', labelKey: 'nav.email', icon: Mail },
      { id: 'social', label: 'Team Chat', labelKey: 'nav.social', icon: MessageCircle },
      { id: 'contacts', label: 'Contacts', labelKey: 'nav.contacts', icon: BookUser },
      { id: 'relationships-plus', label: 'Relationships+', labelKey: 'nav.relationships', icon: Heart },
      { id: 'family-members', label: 'Family Members', icon: Users },
    ],
  },
  {
    id: 'life',
    label: 'Life',
    icon: Heart,
    items: [
      { id: 'health', label: 'Health', labelKey: 'nav.health', icon: Heart },
      { id: 'personal-health', label: 'Personal Health', labelKey: 'nav.personalHealth', icon: Pill },
      { id: 'habits', label: 'Habits', labelKey: 'nav.habits', icon: Flame },
      { id: 'cooking', label: 'Cooking', labelKey: 'nav.cooking', icon: Utensils },
      { id: 'islam', label: 'Islam', labelKey: 'nav.islam', icon: Moon },
      { id: 'challenges', label: 'Challenges', icon: Trophy },
      { id: 'family', label: 'Family Hub', labelKey: 'nav.familyHub', icon: Users },
      { id: 'family-calendar', label: 'Family Calendar', icon: CalendarCheck },
      { id: 'child-mode', label: 'Child Mode', icon: Baby },
    ],
  },
  {
    id: 'work',
    label: 'Money & Work',
    icon: Wallet,
    items: [
      { id: 'finances', label: 'Finances', labelKey: 'nav.finances', icon: Wallet },
      { id: 'contracts', label: 'Contracts', labelKey: 'nav.contracts', icon: FileText },
      { id: 'projects', label: 'Projects', labelKey: 'nav.projects', icon: FolderKanban },
      { id: 'startups', label: 'Startups', labelKey: 'nav.startups', icon: Briefcase },
      { id: 'assets', label: 'Properties & Vehicles', labelKey: 'nav.assets', icon: Home },
      { id: 'travel', label: 'Travel', labelKey: 'nav.travel', icon: Plane },
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    icon: GraduationCap,
    items: [
      { id: 'learning', label: 'Learning', labelKey: 'nav.learning', icon: GraduationCap },
      { id: 'correlations', label: 'Life Correlations', icon: LineChart },
      { id: 'news', label: 'Tech News', labelKey: 'nav.news', icon: Newspaper },
    ],
  },
];

/** Settings lives in the footer, separate from the 7 content areas. */
export const SETTINGS_ITEM: NavItem = {
  id: 'settings',
  label: 'Settings',
  labelKey: 'nav.settings',
  icon: Settings,
};

/**
 * Mobile bottom bar. The center slot (id `dori`) is the Dori assistant FAB and
 * is rendered specially. The other four map straight to panel ids.
 */
export const MOBILE_PRIMARY_TABS: { id: string; label: string; icon: LucideIcon | null; isCenter?: boolean }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'calendar', label: 'Plan', icon: Calendar },
  { id: 'dori', label: 'Dori', icon: null, isCenter: true },
  { id: 'contacts', label: 'People', icon: Users },
  { id: 'health', label: 'Life', icon: Heart },
];

/** Flat list of every leaf nav item (excludes Settings). */
export const ALL_NAV_ITEMS: NavItem[] = NAV_AREAS.flatMap((a) => a.items);

/** Lookup: panel id -> human label (falls back to a Title-Cased id). */
export function panelLabel(panelId: string): string {
  const found = ALL_NAV_ITEMS.find((i) => i.id === panelId) ?? (panelId === 'settings' ? SETTINGS_ITEM : undefined);
  if (found) return found.label;
  return panelId.charAt(0).toUpperCase() + panelId.slice(1);
}

/** Lookup: panel id -> the area that contains it (or undefined). */
export function areaForPanel(panelId: string): NavArea | undefined {
  return NAV_AREAS.find((a) => a.items.some((i) => i.id === panelId));
}
