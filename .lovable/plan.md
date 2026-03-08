

# "What Should I Do Now?" Dashboard Card

## What
Create a prominent AI-powered card on the dashboard that uses the existing `useSmartTaskSuggestions` hook to recommend the single best task to do right now, with alternatives and a start CTA.

## New File: `src/components/dashboard/WhatNowCard.tsx`
- Uses `useSmartTaskSuggestions(tasks, events)` hook
- Shows the top recommendation: task title, reason, estimated minutes, energy badge, start tip
- "Start" button (calls `onStartTask` callback)
- "Something else?" expandable section showing 2 alternatives
- Refresh button to get a new suggestion
- Loading state with shimmer skeleton
- Empty state when no tasks remain
- Styled with `GlassCard` variant="gradient" for visual prominence

## Modified File: `src/components/dashboard/DashboardPanel.tsx`
- Import `WhatNowCard` and `useSmartTaskSuggestions`
- Call `useSmartTaskSuggestions(tasks, events)` in the component
- Add `<WhatNowCard>` as a full-width `StaggerItem` between `DailyBriefingCard` and `FocusCard`
- Pass `onNavigate` so "Start" can navigate to the tasks panel

## Card Layout
```text
┌─ GlassCard (gradient) ──────────────────┐
│ ✨ What should I do now?     [↻ Refresh] │
│                                          │
│ 🎯 [Task Title]                         │
│ "Because it's high priority and due..."  │
│ ⏱ ~15 min  ⚡ Medium energy             │
│ 💡 "Just open the doc and write 1 line" │
│                                          │
│ [▶ Start Now]                            │
│                                          │
│ ▾ Something else?                        │
│   • Alternative task 1 — reason          │
│   • Alternative task 2 — reason          │
│                                          │
│ 💪 "You've got this!"                   │
└──────────────────────────────────────────┘
```

