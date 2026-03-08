

# Round 2: Top 10 UI/UX Improvements

After reviewing the current state post-Wave 7/8 changes, here are the next 10 highest-impact polish items.

---

## 1. Hero + WhatNow Card Redundancy
Both `DashboardHero` and `WhatNowCard` occupy the top of the dashboard as separate full-width cards with similar gradient styling. The Hero shows a greeting + task count; WhatNow shows a suggested task. Together they push actual content below the fold.

**Fix:** Merge them into a single "Hero" card. Top half: greeting + stat summary. Bottom half: the WhatNow recommendation inline (compact mode). Save ~100px of vertical space.

---

## 2. CheckinPrompt Competes with Hero
The `CheckinPrompt` card renders above the Hero when active (morning/evening), pushing the greeting below the fold. It uses a full `Card` component with icon, text, and button — taking ~80px.

**Fix:** Make it a slim banner (40px) pinned at the top of the dashboard with a single-line CTA: "How are you feeling? Start check-in →". Dismiss with swipe or X.

---

## 3. QuickActionsBar at the Bottom is Invisible
The `QuickActionsBar` renders as the very last item on the dashboard — below the collapsed "Insights & Alerts" accordion. Users will never scroll that far.

**Fix:** Move it immediately below the Hero card as a horizontal scroll strip. These are contextual shortcuts — they should be the second thing users see, not the last.

---

## 4. No Loading/Transition State for Dori Responses
When the AI is processing, the chat shows 3 bouncing dots. There is no streaming — the entire response appears at once. For long responses (web search, summaries), this creates a dead wait.

**Fix:** If streaming is already implemented in the edge function, ensure the client renders tokens as they arrive. If not, add a "Dori is thinking..." label with elapsed time indicator (2s... 4s...) so users know the system hasn't frozen.

---

## 5. MoreSheet Drawer Has No Search or Favorites
The `MoreSheet` lists 14 panels in a 3-column grid. Users who frequently access Notes or Contacts must scroll through Life → Business → Tools every time. No way to search or pin favorites.

**Fix:** Add a small search/filter input at the top of the drawer. Highlight recently used panels (last 3) at the top in a "Recent" row before the categorized sections.

---

## 6. Timeline Items Are Not Actionable
`TodayTimeline` renders tasks and events as read-only rows. Users can see "Call dentist at 14:00" but cannot complete, snooze, or open the task from the timeline.

**Fix:** Add a checkbox for tasks (complete inline) and make the row tappable to navigate to the calendar/task detail. Add a subtle swipe-to-complete gesture.

---

## 7. Weather Card Shows Celsius Only
`WeatherCard` hardcodes `{weather.temperature}°C`. Users in the US or other countries using Fahrenheit have no toggle.

**Fix:** Respect a user setting (`settings.temperatureUnit`) or detect locale. Show °C/°F toggle on the card itself.

---

## 8. Dori Chat Input Is Too Small on Mobile
The chat input bar uses a standard `Input` component with `flex-1`. On iPhone SE or small screens, the input + 2 buttons (mic + send) creates a cramped experience. The input placeholder "Ask Dori anything..." gets truncated.

**Fix:** Make the input full-width with buttons overlaid inside (like WhatsApp/iMessage). Use a `textarea` that grows to 3 lines max for longer prompts.

---

## 9. No Visual Feedback for Task Completion on Dashboard
When clicking "Mark Done" on the `FocusCard`, the task is completed in the DB but the card doesn't animate out. It just... stays, until the next re-render picks a new focus task.

**Fix:** Add a satisfying completion animation — checkmark burst, card slide-out, then the next focus task slides in. Use `AnimatePresence` with exit animations.

---

## 10. Stat Pills Have No Visual Progress
`StatPills` show numbers ("3 Today", "12 Week", "5 Streak") but no visual indicator of progress toward a goal. Is 3 good? Is 12 on track?

**Fix:** Add a tiny progress ring or bar inside each pill. Compare against the user's daily/weekly goal (default: 5/day, 25/week). Show green when on track, amber when behind.

---

## Implementation Priority

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Merge Hero + WhatNow | Medium | High |
| 2 | Slim CheckinPrompt banner | Small | Medium |
| 3 | Move QuickActionsBar up | Small | High |
| 4 | Streaming/elapsed indicator | Medium | High |
| 5 | MoreSheet search + recents | Medium | Medium |
| 6 | Actionable timeline items | Medium | High |
| 7 | Temperature unit toggle | Small | Low |
| 8 | Expandable chat input | Small | Medium |
| 9 | Task completion animation | Small | Medium |
| 10 | Stat pill progress rings | Medium | Medium |

