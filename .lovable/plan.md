

# Round 3: Top 10 UI/UX Improvements

Based on reviewing the live app, screenshots, and code after Rounds 1 and 2.

---

## 1. FocusCard and Hero "Next Up" Are Redundant
Both the Hero's "Next up" section and the FocusCard below it show the same overdue task ("Write to 10 investors..."). The user sees the identical task twice on the same screen with separate "Start Now" and "Mark Done" buttons.

**Fix:** Remove FocusCard as a standalone component. The Hero's inline "Next up" section already handles this. Replace FocusCard's slot with a compact "Upcoming tasks" list (next 3 incomplete tasks, not the same one shown in Hero).

---

## 2. StatPills Show "0 Today" — Feels Punishing
When the user hasn't completed any tasks, a single pill shows "0 Today" with an empty progress bar. This is demotivating rather than encouraging.

**Fix:** When value is 0, show an encouraging micro-copy instead: "Start your first task!" with a play icon. Only show the numeric pill once value > 0. For streak = 0, hide the streak pill entirely (already done) — apply the same logic to "Today".

---

## 3. Chat Header Says "Chat" — Should Say "Dori"
The ContextualHeader displays "Chat" when on the Dori panel (from `tabTitles.chat = 'Dori AI'` but `t('nav.chat')` likely returns "Chat"). The Dori sub-header already shows the fish + "Dori", creating a double header that wastes 112px total.

**Fix:** Hide the ContextualHeader when on the chat panel (same pattern as dashboard). The DoriPanel already has its own complete header with the fish icon, history button, and voice mode button.

---

## 4. Dori Empty State Has Dead Space Below Input
The chat input sits at the very bottom, but the empty state content (fish + suggestions) is centered in the middle, leaving a large empty gap between the suggestions and the input bar. The "What can Dori do?" section appears below the fold.

**Fix:** Move the empty state content lower, closer to the input area. Position suggestions just above the input as "quick reply chips" (like Google Assistant). The fish + greeting stays centered but with less top padding.

---

## 5. Timeline Shows "00:00" for Tasks Without Specific Times
Tasks without a specific due time display "00:00" in the timeline, which looks like midnight. This is misleading — the task has no time, not a midnight deadline.

**Fix:** Show "All day" or "—" for tasks where the due time is exactly midnight/00:00 (which means no time was set). Only show HH:mm for tasks with explicit non-midnight times.

---

## 6. No Way to Access Settings or Profile from Dashboard
The hamburger menu icon in the ContextualHeader opens the MoreSheet, but on the dashboard the header is hidden. The only way to reach Settings is: tap a non-dashboard tab → tap hamburger → scroll to Settings. That is 3+ taps for a frequently needed panel.

**Fix:** Add a small avatar/profile icon in the top-right corner of the DashboardHero card that opens a mini profile popover or directly navigates to settings. Alternatively, add a settings gear to the QuickActionsBar.

---

## 7. "Insights & Alerts" Accordion Has No Preview
The collapsed accordion shows "Insights & Alerts" with a red dot, but the user has no idea what is inside. Is it 1 alert or 10? Is it urgent?

**Fix:** Add a count badge next to the label: "Insights & Alerts (3)" or show a one-line preview of the most urgent alert below the trigger: "YouTube contract renews in 2 days".

---

## 8. QuickActions Buttons Look Like Tags, Not Actions
The QuickActionsBar renders colored pill buttons ("Priority Emails", "Quick Wins", "Reach Out") that look like filter tags rather than actionable shortcuts. There is no visual distinction between a filter and an action.

**Fix:** Add a leading "+" or action verb to make them obviously actionable. Use a consistent icon-first layout. Add subtle arrow/chevron to indicate they navigate somewhere. Consider renaming: "Priority Emails" → "Check Priority Emails →".

---

## 9. Bottom Nav Dori Button Blocks Content Behind It
The center Dori button extends above the nav bar with `-mt-6`, creating a floating FAB. But it overlaps with the last timeline item on the dashboard when scrolled to the bottom. Content behind it is not tappable.

**Fix:** Add `pb-8` (extra bottom padding) to the dashboard scroll container to ensure the last item is never hidden behind the floating Dori button. This is a simple safe-area fix.

---

## 10. Email Panel Has No Back/Home Button
After navigating to the Email panel via the bottom tab, the header shows "E-Mail" with a hamburger menu. But there is no obvious "back" or "home" gesture. The hamburger opens MoreSheet (which is for navigating to other panels, not going back). Users may feel stuck.

**Fix:** Replace the hamburger icon with a back arrow when navigating from a non-primary tab. Or better: since the bottom nav already handles navigation, remove the hamburger from the ContextualHeader entirely on mobile — it is redundant with the bottom nav + MoreSheet is accessible via long-press on any tab.

---

## Implementation Priority

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Remove FocusCard redundancy | Medium | High |
| 2 | Hide chat ContextualHeader | Small | High |
| 3 | Fix "00:00" timeline times | Small | High |
| 4 | Add dashboard bottom padding | Small | Medium |
| 5 | Insights accordion preview | Small | Medium |
| 6 | StatPills zero-state messaging | Small | Medium |
| 7 | Dashboard settings access | Small | Medium |
| 8 | QuickActions visual clarity | Small | Medium |
| 9 | Dori empty state positioning | Medium | Medium |
| 10 | Remove redundant hamburger | Small | Low |

