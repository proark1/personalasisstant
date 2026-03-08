

# Wave 4: Scroll UX, Route Transitions & Remaining Card Migration

## Current State

Three waves of UI/UX polish are complete: glassmorphism system, panel transitions, dialog/sheet/input/button micro-interactions, skeleton shimmer, and migrating ~16 panels to PanelShell + GlassCard. The design system is mature.

**76 files** still import `Card` from shadcn. Most are secondary dialogs/settings — diminishing returns. The highest-impact remaining work falls into three categories: route-level transitions, scroll UX improvements, and the remaining high-visibility Card migrations.

## Plan

### 1. Route-Level Page Transitions
Currently, navigating between routes (Auth → Dashboard, Dashboard → Contacts page) is an instant cut. Add `AnimatePresence` at the router level in `App.tsx` so every route change has a subtle fade transition.

**File:** `src/App.tsx`

### 2. Smooth Scroll-to-Top on Panel Change
When switching panels in both mobile and desktop, the scroll position carries over from the previous panel. Add a scroll-to-top reset when `activePanel` changes.

**Files:** `src/components/layout/MobileLayout.tsx`, `src/components/layout/StandardMode.tsx`

### 3. Migrate High-Visibility Remaining Cards
Focus only on panels users see frequently — skip settings/dialogs:
- `HealthHubPanel` — still mixes `Card` and `GlassCard`
- `ContractManager` — uses `Card` alongside `GlassCard`
- `WidgetGrid` — dashboard widgets visible on home screen
- `BrainDumpFAB` — always-visible floating capture card

**Files:** `src/components/health/HealthHubPanel.tsx`, `src/components/contracts/ContractManager.tsx`, `src/components/widgets/WidgetGrid.tsx`, `src/components/capture/BrainDumpFAB.tsx`

### 4. Empty State Polish for TaskList & HabitsPanel
TaskList and HabitsPanel were flagged in Wave 3 but not completed. Add proper `EmptyState` components with icons and CTAs when there are no items.

**Files:** `src/components/tasks/TaskList.tsx`, `src/components/habits/HabitsPanel.tsx`

### 5. Loading Spinner Cleanup
Search for remaining `Loader2 animate-spin` patterns in high-traffic components and replace with `PanelSkeleton` or inline shimmer skeletons.

**Files:** Audit across `src/components/` — targeted replacements only in visible panels.

## Technical Approach

### Route Transitions
Wrap `<Routes>` content with a location-keyed `AnimatePresence`:
```text
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
  >
    <Routes location={location}>...</Routes>
  </motion.div>
</AnimatePresence>
```

### Scroll Reset
Use a `useEffect` watching `activePanel` that calls `scrollContainerRef.current?.scrollTo(0, 0)` on the panel content area.

### Card Migration
Same proven pattern: swap `Card`/`CardContent`/`CardHeader`/`CardTitle` imports to `GlassCard`/`GlassCardContent`/`GlassCardHeader`/`GlassCardTitle`.

## Files Modified Summary
- `src/App.tsx` — route-level AnimatePresence
- `src/components/layout/MobileLayout.tsx` — scroll reset on panel change
- `src/components/layout/StandardMode.tsx` — scroll reset on panel change
- `src/components/health/HealthHubPanel.tsx` — Card → GlassCard
- `src/components/contracts/ContractManager.tsx` — Card → GlassCard
- `src/components/widgets/WidgetGrid.tsx` — Card → GlassCard
- `src/components/capture/BrainDumpFAB.tsx` — Card → GlassCard
- `src/components/tasks/TaskList.tsx` — EmptyState component
- `src/components/habits/HabitsPanel.tsx` — EmptyState component

