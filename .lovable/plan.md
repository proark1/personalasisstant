

# Contracts Feature — UI/UX Polish

After auditing all 10 contract component files, the feature is functionally complete (health scores, AI scanning, cancellation emails, document preview, calendar sync, snooze, bulk actions, timeline, cost widgets, sharing). The main gaps are design system consistency and a few missing UX touches.

---

## Issues Found

1. **ContractTimeline uses raw `Card`** — Lines 128, 145 use `Card`/`CardHeader`/`CardContent` instead of `GlassCard`. No motion animations on timeline events.

2. **ContractCostWidget uses raw `Card`** — Line 76 uses `Card className="glass-panel-solid"` instead of `GlassCard`. Inconsistent with the rest of the app.

3. **ContractHealthScore uses raw `Card`** — Line 2 imports `Card` (though only used in the tooltip, not critical). The tooltip content could benefit from a progress bar showing the score visually.

4. **ContractCard missing `pressable` and `haptic`** — Line 117 uses `GlassCard` but without `pressable` or `haptic="light"` props. No `staggerItem` motion wrapper.

5. **ContractManager stats cards missing `pressable`** — The 4 stat cards (lines 454-488) are plain `GlassCard` without interactive feel.

6. **ContractManager header is custom** — The `ContractsPanel` already wraps in `PanelShell`, but the inner `ContractManager` has its own redundant `<h2>` header (line 392-396) that duplicates the panel title.

7. **Empty states use inline text** — Lines 258-263 and 567-571 show plain text instead of the `EmptyState` component.

8. **No stagger animations on card grid** — The card grid (line 573) renders cards without `staggerItem` motion wrappers.

---

## Plan

### 1. ContractTimeline → GlassCard + motion
Replace `Card`/`CardHeader`/`CardContent` imports with `GlassCard` variants. Add `staggerItem` motion wrapper to each timeline event. Add `EmptyState` for empty timeline.

**File:** `src/components/contracts/ContractTimeline.tsx`

### 2. ContractCostWidget → GlassCard
Replace `Card` with `GlassCard`. Remove the `glass-panel-solid` class hack.

**File:** `src/components/contracts/ContractCostWidget.tsx`

### 3. ContractCard → pressable + haptic + staggerItem
Add `pressable haptic="light"` to the `GlassCard` wrapper. Wrap in `motion.div variants={staggerItem}` for staggered entrance.

**File:** `src/components/contracts/ContractCard.tsx`

### 4. ContractManager — remove redundant header + EmptyState + stagger
- Remove the duplicate `<h2>` header block (lines 390-416) since `ContractsPanel` already provides this via `PanelShell`. Move the "Add" and "Sync to Calendar" buttons into the `PanelShell` actions slot instead.
- Replace inline empty text with `EmptyState` component (icon: `FileText`).
- Wrap the card grid in `motion.div variants={staggerContainer}`.

**Files:** `src/components/contracts/ContractManager.tsx`, `src/components/contracts/ContractsPanel.tsx`

### 5. Stats cards — pressable
Add `pressable haptic="light"` to the 4 stat `GlassCard` elements for tactile feel.

**File:** `src/components/contracts/ContractManager.tsx`

---

## Summary

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Timeline → GlassCard + motion | Small | Medium |
| 2 | CostWidget → GlassCard | Tiny | Small |
| 3 | ContractCard → pressable/haptic | Tiny | High |
| 4 | Remove redundant header + EmptyState + stagger | Small | High |
| 5 | Stats cards pressable | Tiny | Small |

