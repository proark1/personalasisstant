

# Startups Feature — UI/UX Overhaul

The startup feature has two rich hooks (`useStartupWorkspaces` with CRUD + metrics, `useStartupIdeas` with full idea management) but the UI is a single bare-bones panel that doesn't expose most of this functionality.

---

## Issues Found

1. **No stagger animations or haptic feedback** — GlassCards lack `pressable`, `haptic`, `staggerItem`.
2. **Empty states are inline text** — "No metrics tracked yet" is a raw `<p>` instead of `EmptyState`.
3. **Stats cards show placeholder dashes** — Team Size, MRR, Growth all show "-" with no way to populate them. Should pull from metrics or allow adding.
4. **Quick Action buttons are non-functional** — "View Tasks", "Team Notes", "Contacts", "Add Metric" buttons do nothing.
5. **No way to add/edit/delete workspaces** — Hook supports full CRUD but UI only renders defaults.
6. **No way to add metrics** — Hook has `addMetric` but no dialog to use it.
7. **Startup Ideas not surfaced at all** — `useStartupIdeas` hook exists with full CRUD, status pipeline, tags, AI insights — zero UI.
8. **No workspace editing** — Can't rename, change color, or archive workspaces.

---

## Plan

### 1. Stagger animations + haptic feedback
Add `staggerContainer`/`staggerItem` motion variants to workspace content. Add `pressable haptic="light"` to stat cards. Wrap each section in `motion.div`.

### 2. EmptyState components
Replace inline "No metrics" text with `EmptyState` (icon: `BarChart3`). Add EmptyState for ideas section.

### 3. Add Workspace dialog
Button in PanelShell `actions` slot. Dialog with name, type (gaming/ai/agency/custom), color picker, description. Wires to `addWorkspace`.

### 4. Edit/Delete workspace
Add dropdown menu (MoreVertical) on workspace header with Edit and Archive options. Edit opens pre-filled dialog, Archive calls `deleteWorkspace`.

### 5. Add Metric dialog
"Add Metric" quick action opens a dialog with metric_name (select or custom), metric_value, metric_date, notes. Wires to `addMetric`. Stats cards (MRR, Growth, Team Size) pull from latest metrics.

### 6. Startup Ideas tab/section
Add a tabbed view within each workspace: **Overview** | **Ideas** | **Metrics**.
- **Ideas tab**: Shows ideas filtered by workspace (`getIdeasForWorkspace`). Each idea is a `GlassCard pressable haptic="light"` showing name, status badge, tags, description preview.
- Add Idea dialog: name, description, problem_statement, target_audience, status, tags.
- Click idea to expand detail view with all fields, edit capability, delete with confirmation.
- Status pipeline badges with color coding (brainstorming=blue, researching=purple, validating=amber, building=green, launched=emerald, archived=gray).

### 7. Live stats from metrics
Stats cards pull real data: MRR from `getLatestMetric(id, 'mrr')`, Team Size from `getLatestMetric(id, 'team_size')`, Growth calculated from last two MRR values.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/startup/StartupWorkspacePanel.tsx` | Full rewrite: tabs, stagger, haptic, add/edit/delete workspace, add metric dialog, ideas section, live stats |

## Summary

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Stagger + haptic | Tiny | Medium |
| 2 | EmptyState | Tiny | Medium |
| 3 | Add Workspace dialog | Small | High |
| 4 | Edit/Delete workspace | Small | High |
| 5 | Add Metric dialog | Small | High |
| 6 | Ideas tab with full CRUD | Medium | High |
| 7 | Live stats from metrics | Small | High |

