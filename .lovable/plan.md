

# Final Consistency Pass — Unmigrated Panels

## Problem

Several panels were never migrated to the shared component system (PanelShell, GlassCard, PanelSkeleton). They still use raw `div` + `border-b` headers, plain `Card` from shadcn, and `Loader2 animate-spin` loading states. This creates visible inconsistency when navigating between sections.

### Panels still using old patterns:
1. **FamilyPanel** — raw `div` header with `p-4 border-b`, no PanelShell
2. **CookingPanel** — raw `div` header, no PanelShell
3. **SocialPanel** — raw `div` header with `px-4 pt-3 pb-2 border-b`, no PanelShell
4. **StartupWorkspacePanel** — `Card` from shadcn, `Loader2 animate-spin` loading, raw header
5. **IslamEnhancedPanel** (1922 lines) — uses `Card` from shadcn throughout, no GlassCard, no PanelShell header
6. **CalendarHubPanel** — raw `div` with custom view switcher, no PanelShell wrapper
7. **PropertyPanel** / **TechNewsPanel** — likely same pattern (not yet reviewed but pattern is consistent)

## Plan

### 1. Migrate FamilyPanel to PanelShell
Wrap with `PanelShell` using `Users` icon and family title/subtitle. Move Tabs into PanelShell children.

### 2. Migrate CookingPanel to PanelShell
Wrap with `PanelShell` using `Utensils` icon.

### 3. Migrate SocialPanel to PanelShell
Wrap with `PanelShell` using `MessageCircle` icon. Move action buttons to `actions` prop.

### 4. Migrate StartupWorkspacePanel to PanelShell + GlassCard
Replace `Card` with `GlassCard`. Replace `Loader2 animate-spin` with `PanelSkeleton`. Wrap with PanelShell.

### 5. Migrate CalendarHubPanel to PanelShell
Wrap with PanelShell. Move the view switcher into `headerExtra`.

### 6. Migrate IslamEnhancedPanel header to PanelShell pattern
Due to the panel's 1922-line size, only migrate the top-level header and loading state. Replace `Card` imports with `GlassCard` for the main content cards.

### 7. Review PropertyPanel and TechNewsPanel
Read and migrate to PanelShell if needed.

## Files Modified
- `src/components/family/FamilyPanel.tsx`
- `src/components/cooking/CookingPanel.tsx`
- `src/components/social/SocialPanel.tsx`
- `src/components/startup/StartupWorkspacePanel.tsx`
- `src/components/calendar/CalendarHubPanel.tsx`
- `src/components/islam/IslamEnhancedPanel.tsx`
- `src/components/property/PropertyPanel.tsx`
- `src/components/news/TechNewsPanel.tsx`

