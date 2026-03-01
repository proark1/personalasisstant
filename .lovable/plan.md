

# Complete UI/UX Overhaul: Personal Assistant That Works For You

## Core Problem

The current interface has 15+ navigation items competing for attention, an odd bottom bar selection (Notes, Cooking, Islam as primary tabs), too many clicks to reach anything, and zero proactive intelligence surfacing. A personal assistant should anticipate, not wait.

## Design Philosophy

**"Zero-click intelligence, one-tap action."** The interface should proactively show what matters, and let you reach anything in 1-2 taps maximum.

---

## 1. Redesign Bottom Navigation (Mobile)

Current bottom bar: Notes | Calendar | Cooking | **Dori** | Health | Islam | Social (7 items -- too many, wrong priorities)

New bottom bar (5 items, the universal mobile standard):

```text
[Home]  [Calendar]  [*Dori*]  [Tasks]  [More]
```

- **Home** = Dashboard (your proactive daily view)
- **Calendar** = Calendar hub (includes events + schedule)
- **Dori** (center, elevated) = AI assistant chat + voice
- **Tasks** = Task list / Kanban (your most-used action area)
- **More** = Opens a clean grid sheet with all other sections

The "More" button opens a bottom sheet (using Vaul drawer) showing a 3-column icon grid of all secondary panels: Contacts, Contracts, Notes, Habits, Health, Cooking, Islam, Properties, Startups, News, Social, Settings. Each with icon + label. This means everything is 2 taps away max.

## 2. Redesign Header (Mobile)

Current: Hamburger menu | DarAI logo | Notification icons

New contextual header:

```text
[Back/Menu]  "Dashboard" (context title)  [Search] [Notifications]
```

- Shows current section name dynamically
- Search icon opens Global Search (Cmd+K equivalent for mobile)
- When in a sub-section, shows back arrow instead of menu
- Profile avatar tap opens settings directly

## 3. Redesign Desktop Sidebar

Current: 15+ flat items with no grouping hierarchy

New grouped sidebar with collapsible sections:

```text
[DarAI Logo]              [Search] [Notifications]

[Today Focus]  (gradient CTA button)

--- My Day ---
  Dashboard
  Tasks  
  Calendar

--- Assistant ---
  Dori AI
  
--- Life ---
  Health
  Habits
  Cooking
  Islam

--- Business ---
  Contacts
  Contracts
  Properties
  Startups
  News

--- Tools ---
  Notes
  Social
  
[Settings]
[Sign Out]
```

- Groups are collapsible with chevrons
- Active item has clear highlight
- Collapsed state shows only icons with tooltips
- Badge counts on Tasks (pending) and Social (unread)

## 4. "More" Bottom Sheet for Mobile

Create a `MoreSheet` component using Vaul drawer:
- Opens from bottom with spring animation
- 3-column grid of icon+label buttons
- Grouped: Life | Business | Tools
- Each button navigates and closes the sheet
- Recent/pinned items shown at top

## 5. Proactive Dashboard Enhancements

Add to the existing DashboardHero:
- **Quick Actions Row**: Contextual action pills below the greeting (e.g., "Start focus session", "Call Ahmed back", "Review contract expiring tomorrow")
- Uses the existing `QuickActionsBar` component but integrated into the hero
- Weather + next prayer time as compact info chips in the hero

## 6. Global Search Enhancement

- Add search icon to mobile header (currently only in desktop sidebar)
- Make it accessible via swipe-down gesture on dashboard
- Show recent searches and suggested queries

## 7. Remove Redundant Elements

- Remove `QuickActionsFAB` on mobile (conflicts with bottom bar + Dori button)
- Remove hamburger sidebar sheet on mobile (replaced by "More" bottom sheet)
- Remove redundant DarAI logo from header (save space for context title)

---

## Technical Implementation

### Files to Create
- `src/components/layout/MoreSheet.tsx` -- Bottom sheet with all secondary navigation items in a grid
- `src/components/layout/ContextualHeader.tsx` -- Smart header that shows section name + search + notifications

### Files to Modify
- `src/components/layout/MobileLayout.tsx` -- Major refactor: new 5-tab bottom nav, new header, integrate MoreSheet, remove hamburger sidebar
- `src/components/layout/Sidebar.tsx` -- Reorganize into collapsible grouped sections with badges
- `src/components/dashboard/DashboardPanel.tsx` -- Add QuickActionsBar to dashboard flow
- `src/components/dashboard/DashboardHero.tsx` -- Add weather/prayer time chips and integrate quick actions

### Files Unchanged
- All panel components (ContactsPanel, NotesPanel, etc.) remain untouched
- Dashboard sub-components (FocusCard, StatPills, etc.) remain untouched

### Key Patterns Used
- Vaul drawer for the "More" sheet (already installed)
- Framer Motion for sheet and tab transitions (already installed)
- Haptic feedback on all navigation changes (existing useHaptics hook)
- Existing GlassCard system for visual consistency

