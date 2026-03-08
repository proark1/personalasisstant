

# World-Class UX Polish — Wave 3: Remaining Panels & Micro-Details

## Current State

Three waves of polish have been completed: glassmorphism system, panel transitions, sidebar/tab indicators, auth page, skeleton shimmer, dialog/sheet backdrop blur, input glow, button active states, and migrating 8 panels to PanelShell.

**Remaining gaps** fall into two categories: unmigrated panels and missing micro-details.

## Plan

### 1. Migrate ContactsPanel to PanelShell + GlassCard
ContactsPanel (735 lines) still uses `Card` from shadcn, has no PanelShell header, and no PanelShell-based loading state. Replace `Card` with `GlassCard` for contact cards and wrap in `PanelShell`.

**File:** `src/components/contacts/ContactsPanel.tsx`

### 2. Migrate EmailPanel to PanelShell
EmailPanel (558 lines) uses a raw header with inline buttons. Wrap in `PanelShell` with the Gmail connect/refresh actions as `headerExtra`.

**File:** `src/components/email/EmailPanel.tsx`

### 3. Migrate HealthHubPanel to PanelShell + GlassCard
HealthHubPanel (1274 lines) uses both `Card` and `GlassCard` inconsistently, and has a raw header. Wrap in `PanelShell`, replace remaining `Card` imports with `GlassCard`.

**File:** `src/components/health/HealthHubPanel.tsx`

### 4. Migrate ContractsPanel / ContractManager to PanelShell
ContractsPanel has no PanelShell wrapper and ContractCard uses `Card`. Wrap in PanelShell and swap Card to GlassCard in ContractCard.

**Files:** `src/components/contracts/ContractsPanel.tsx`, `src/components/contracts/ContractCard.tsx`

### 5. Migrate Dashboard Sub-Cards to GlassCard
Several dashboard cards still use `Card` from shadcn: `DayPredictionCard`, `ProactiveRemindersCard`, `SmartInsightCard`, `SmartSchedulingCard`, `FollowUpCard`. Replace with GlassCard for visual consistency.

**Files:** `src/components/dashboard/DayPredictionCard.tsx`, `src/components/dashboard/ProactiveRemindersCard.tsx`, `src/components/dashboard/SmartInsightCard.tsx`, `src/components/dashboard/SmartSchedulingCard.tsx`, `src/components/dashboard/FollowUpCard.tsx`

### 6. Add Empty State Illustrations
Panels that show "no data" messages should use the `EmptyState` component with relevant icons and action CTAs instead of plain text. Audit and fix in: TaskList, NotesPanel, HabitsPanel, ContactsPanel.

**Files:** `src/components/tasks/TaskList.tsx`, `src/components/notes/NotesPanel.tsx`, `src/components/habits/HabitsPanel.tsx`, `src/components/contacts/ContactsPanel.tsx`

## Technical Approach

Same pattern used in waves 1-2:
- Replace `import { Card, ... } from '@/components/ui/card'` with `import { GlassCard, ... } from '@/components/ui/glass-card'`
- Wrap top-level return with `<PanelShell icon={X} title="Y">` and move action buttons to `headerExtra` or `actions` props
- Replace `Loader2 animate-spin` loading with `PanelSkeleton`

## Files Modified Summary
- `src/components/contacts/ContactsPanel.tsx` — PanelShell + GlassCard
- `src/components/email/EmailPanel.tsx` — PanelShell
- `src/components/health/HealthHubPanel.tsx` — PanelShell + GlassCard
- `src/components/contracts/ContractsPanel.tsx` — PanelShell
- `src/components/contracts/ContractCard.tsx` — GlassCard
- `src/components/dashboard/DayPredictionCard.tsx` — GlassCard
- `src/components/dashboard/ProactiveRemindersCard.tsx` — GlassCard
- `src/components/dashboard/SmartInsightCard.tsx` — GlassCard
- `src/components/dashboard/SmartSchedulingCard.tsx` — GlassCard
- `src/components/dashboard/FollowUpCard.tsx` — GlassCard
- `src/components/tasks/TaskList.tsx` — EmptyState
- `src/components/notes/NotesPanel.tsx` — EmptyState audit
- `src/components/habits/HabitsPanel.tsx` — EmptyState audit
