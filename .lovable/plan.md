
# Dashboard Redesign: Clean, Focused, World-Class

## Problem
The current dashboard renders 13+ cards in a single vertical scroll, creating information overload with no visual hierarchy. Every card looks identical, there's no clear focus point, and mobile users face endless scrolling.

## Design Philosophy
**"Show less, mean more."** The dashboard should answer one question instantly: "What should I focus on right now?" Everything else is secondary and accessible on demand.

## Architecture

```text
+------------------------------------------+
|  "Good morning, Ahmed"    [XP] [Dori]    |
|  "You have 3 tasks today. Here's #1:"    |
+------------------------------------------+
|                                          |
|  [Hero Focus Card - Next Task/Event]     |
|  Big, prominent, actionable              |
|                                          |
+------------------------------------------+
|  [Streak] [Tasks Done] [Life Score]      |
|  Compact stat pills, single row          |
+------------------------------------------+
|                                          |
|  Today's Timeline (max 5 items)          |
|  Tasks + Events merged, time-ordered     |
|                                          |
+------------------------------------------+
|  [Smart Insight Card] (1 card, rotating) |
|  AI suggestion OR mood OR scheduling     |
+------------------------------------------+
|  [Quick Actions] (collapsed FAB style)   |
+------------------------------------------+
```

## Implementation Plan

### 1. Create `DashboardHero` Component
- Time-aware greeting ("Good morning/afternoon/evening, {name}")
- One-line AI summary: "You have 3 tasks today. Your peak time starts in 2 hours."
- XP badge and Dori button integrated into header
- Uses `GlassCard` with gradient variant for visual prominence

### 2. Create `FocusCard` Component
- Shows the single most important item right now (next task due, upcoming event, or overdue item)
- Large, prominent design with action button ("Start", "Mark Done", "View")
- If nothing urgent, shows encouraging message or AI suggestion
- Uses `PageTransition` for entrance animation

### 3. Redesign Stats as Compact Pill Row
- Replace 4 separate stat cards with a single horizontal scroll row of compact "stat pills"
- Each pill: icon + number + label, all in one line
- Only show stats with meaningful data (hide zeros)
- Streak gets fire emoji animation when active

### 4. Create `TodayTimeline` Component
- Merge tasks and calendar events into a single chronological timeline
- Max 5 items shown, "See all" link to calendar/tasks panel
- Each item shows time, title, type badge (task/event), and priority dot
- Clean, minimal list design -- no cards within cards

### 5. Create `SmartInsightCard` (Single Rotating Insight)
- Instead of showing DayPrediction + WeeklyCoach + MoodTracking + Challenges + AutoPilot + Correlations + SmartScheduling all at once...
- Show ONE card that rotates between the most relevant insight
- Priority logic: overdue items > AI suggestion > mood check-in > scheduling tip > weekly coach
- Swipeable or auto-advances with dots indicator
- "See all insights" link to a dedicated insights panel

### 6. Move Heavy Content to "Insights" Sub-Panel
- Move these to a secondary view (accessible via "See All Insights" or a dedicated panel):
  - Charts (pie chart, bar chart)
  - CorrelationsDashboard
  - ChallengesPanel
  - AutoPilotCard
  - SmartSchedulingCard
  - ContractCostWidget
- These are "deep dive" content, not daily overview content

### 7. Refactor `DashboardPanel.tsx`
- Simplify to render only:
  1. `DashboardHero` (greeting + summary)
  2. `FocusCard` (most important item)
  3. Stat pills row
  4. `TodayTimeline` (merged tasks + events)
  5. `SmartInsightCard` (single rotating insight)
  6. `CheckinPrompt` (only if not yet checked in today)
- Apply `StaggerContainer` and `PageTransition` for entrance animations
- Total scroll: max 2-3 screen heights on mobile

### 8. Progressive Disclosure for New Users
- If user has 0 tasks: show onboarding-style empty state with Dori illustration and "Add your first task" CTA
- If user has less than 5 tasks: hide charts and advanced insights
- If user has 20+ completed tasks: show full insights access

### 9. Add Motion and Delight
- Use `StaggerContainer` for list items to fade in sequentially
- Use `AnimatedCounter` for all stat numbers
- Use `GlassCard` with `pressable` prop for interactive cards
- Subtle parallax on hero section during scroll
- Success checkmark animation when completing tasks from dashboard

### 10. Apply `GlassCard` Design System
- Replace all `Card` with `GlassCard` variants:
  - Hero: `variant="gradient"` with `glow`
  - Stats: `variant="default"`
  - Focus card: `variant="elevated"` with `pressable`
  - Insight: `variant="default"` with subtle border

## Technical Details

### Files to Create
- `src/components/dashboard/DashboardHero.tsx` -- greeting + summary
- `src/components/dashboard/FocusCard.tsx` -- hero next-action card
- `src/components/dashboard/StatPills.tsx` -- compact horizontal stats
- `src/components/dashboard/TodayTimeline.tsx` -- merged task+event timeline
- `src/components/dashboard/SmartInsightCard.tsx` -- rotating single insight

### Files to Modify
- `src/components/dashboard/DashboardPanel.tsx` -- major simplification, use new components
- `src/contexts/LanguageContext.tsx` -- add new translation keys for greeting, focus card, timeline

### Files Unchanged (moved to secondary access)
- All existing insight/chart components remain but are no longer rendered on the main dashboard scroll

## Result
The dashboard goes from 13+ cards and 8-10 screens of scrolling to a focused 5-section layout that fits in 2-3 screens. Users instantly see what matters, feel welcomed, and can dive deeper on demand.
