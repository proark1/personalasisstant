
# Unified World-Class UI/UX Across All Modules

## Problem Analysis

After reviewing the codebase, I found these key inconsistencies across panels:

1. **Card components**: Dashboard uses `GlassCard` (glassmorphism), but Habits/Notes/Contacts/Health use plain `Card` from shadcn. Some panels have no card wrappers at all.
2. **Loading states**: Dashboard shows `animate-pulse text-primary`, Contracts shows the same, Habits uses `RefreshCw animate-spin`, Health has its own spinner. No skeleton loaders used consistently.
3. **Empty states**: Some panels have rich empty states (Email), others have none (Contracts, Health).
4. **Panel headers**: Habits/Notes have `px-4 py-3 border-b` headers with icon + title. Email has `p-3 border-b`. Calendar has no header. Dashboard has none (hero instead). No shared pattern.
5. **Animations**: Dashboard uses `StaggerContainer/StaggerItem` (framer-motion). Other panels have zero entrance animations.
6. **Spacing**: Dashboard uses `p-3 md:p-4`, Contracts uses `p-4`, Notes uses `px-4 py-3`. Inconsistent.
7. **Section headers**: Email uses uppercase tracking-wider. Habits doesn't. No shared component.

## Plan

### 1. Create Shared `PanelShell` Layout Component
A reusable wrapper that every panel uses, providing consistent structure:
- Standardized header with icon, title, optional subtitle, and action buttons
- Consistent padding (`p-3 md:p-4`)
- `StaggerContainer` entrance animation built in
- Shared loading skeleton pattern
- Consistent empty state component

**New file:** `src/components/ui/panel-shell.tsx`

```text
<PanelShell
  icon={Target}
  title="Habits & Goals"
  subtitle="3 of 5 completed"
  actions={<Button .../>}
  loading={loading}
  empty={items.length === 0}
  emptyIcon={Target}
  emptyTitle="No habits yet"
  emptyDescription="Start building healthy routines"
  emptyAction={<Button>Add Habit</Button>}
>
  {children}
</PanelShell>
```

### 2. Create Shared `SectionHeader` Component
Consistent section headers across all panels (email sections, habit sections, etc.)

**New file:** `src/components/ui/section-header.tsx`

### 3. Create Shared `EmptyState` Component  
Reusable empty/zero state with icon, title, description, and CTA.

**New file:** `src/components/ui/empty-state.tsx`

### 4. Create Shared `PanelSkeleton` Loading Component
Standardized skeleton loading with configurable layout (list, grid, cards).

**New file:** `src/components/ui/panel-skeleton.tsx`

### 5. Migrate Panels to Use Shared Components
Update these panels to use the new shared components:
- `HabitsPanel.tsx` -- wrap with PanelShell, use GlassCard for habit items
- `NotesPanel.tsx` -- wrap with PanelShell, use GlassCard for note cards
- `ContractsPanel.tsx` / `ContractManager.tsx` -- wrap with PanelShell
- `ContactsPanel.tsx` -- wrap with PanelShell
- `HealthHubPanel.tsx` -- wrap with PanelShell, standardize card usage
- `EmailPanel.tsx` -- adopt SectionHeader, standardize loading/empty states
- `CalendarHubPanel.tsx` -- adopt PanelShell header pattern
- `DashboardPanel.tsx` -- minor alignment (already closest to target)

### 6. Standardize Card Usage
Replace plain `Card` with `GlassCard` across all item cards for visual consistency:
- Habit items, goal items
- Note list items
- Contact cards (already close)
- Contract cards
- Health metric cards

### 7. Add Entrance Animations Everywhere
Wrap all panel content lists with `StaggerContainer`/`StaggerItem` so every panel has the same smooth staggered entrance.

## Technical Details

### PanelShell Structure
```text
┌──────────────────────────────┐
│ Icon  Title        [Actions] │  <- Consistent header
│        Subtitle              │
├──────────────────────────────┤
│                              │
│  {children} or Loading       │  <- Content with StaggerContainer
│  or EmptyState               │
│                              │
└──────────────────────────────┘
```

### Design Tokens Used Consistently
- Cards: `GlassCard` (default variant) everywhere
- Interactive cards: `GlassCard pressable haptic="light"`
- Spacing: `p-3 md:p-4` for panel content, `gap-3` between cards
- Text sizes: Panel title `text-lg font-semibold`, section headers `text-xs font-semibold uppercase tracking-wider`, body `text-sm`
- Colors: `text-primary` for labels, `text-muted-foreground` for secondary text
- Loading: Skeleton shimmer pattern (3 skeleton cards)
- Empty: Centered icon + title + description + optional CTA

### Files Created
- `src/components/ui/panel-shell.tsx`
- `src/components/ui/section-header.tsx`  
- `src/components/ui/empty-state.tsx`
- `src/components/ui/panel-skeleton.tsx`

### Files Modified
- `src/components/habits/HabitsPanel.tsx`
- `src/components/notes/NotesPanel.tsx`
- `src/components/contracts/ContractsPanel.tsx`
- `src/components/contracts/ContractManager.tsx`
- `src/components/contacts/ContactsPanel.tsx`
- `src/components/health/HealthHubPanel.tsx`
- `src/components/email/EmailPanel.tsx`
- `src/components/calendar/CalendarHubPanel.tsx`

This is a large change touching many files. I recommend implementing it in 2 rounds: first create the shared components (round 1), then migrate panels one by one (round 2), to keep changes reviewable.
