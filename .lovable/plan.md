

# Round 4: Top 10 UI/UX Improvements

Based on live screenshots and code review after Rounds 1-3.

---

## 1. Dori Chat Has Massive Dead Space Below Suggestions
The Dori empty state shows the fish + greeting + 3 suggestion buttons centered at top, then a huge empty gap, then the input area at the very bottom with more empty space below it (the input area has a large padded container that extends well below the actual text field). The suggestions should sit closer to the input.

**Fix:** Use `justify-end` with `pb-4` on the empty state container and place the suggestion chips directly above the input bar as quick-reply pills. Remove the large empty gap. The input form's outer padding below the field is excessive — tighten it.

---

## 2. Header Shows "Kalender" Instead of "Calendar" — Localization Bug
The Calendar page header shows "Kalender" (German) even though the app appears to be in English. The ContextualHeader pulls from `t('nav.calendar')` which returns the German translation. Meanwhile the bottom nav label correctly says "Calendar".

**Fix:** Verify the language context default. Either set it to English or ensure the header respects the same locale as the bottom nav labels. The bottom nav uses hardcoded English labels (`tabLabels`) which is inconsistent with the i18n system.

---

## 3. QuickActions Bar Is Loading Skeleton Placeholders
The QuickActions area on the dashboard shows 4-5 grey shimmer pills (loading state) but they never resolve to actual content. Either the `useContextualActions` hook is failing silently or returning empty data.

**Fix:** Debug the hook — if it returns no actions, hide the bar entirely instead of showing permanent skeleton placeholders. Add a fallback set of static quick actions.

---

## 4. "Next Up" Section Shows Loading Skeleton Indefinitely
The Hero card's "Next up" section shows two skeleton shimmer bars that never resolve. The `useSmartTaskSuggestions` hook is likely calling an AI endpoint that fails or times out without surfacing an error.

**Fix:** Add a timeout (e.g., 5s) — if no suggestion arrives, show a fallback like the top overdue task from the local data. Don't leave skeletons indefinitely.

---

## 5. Bottom Nav Dori Button Has No Label
All other bottom nav items now have labels (Home, Calendar, Email, Health) but the center Dori button has no label underneath. This is inconsistent — even though the fish icon is distinctive, a "Dori" label would complete the pattern.

**Fix:** Add a small "Dori" label below the floating button, positioned just above the nav bar line.

---

## 6. Notification Badge "9+" Clutters Header
The DoriNotificationIcon shows a red "9+" badge in the Calendar header and other panels. It's distracting and competes with the page title. The user can't clear it from this view.

**Fix:** Make the badge smaller (dot only, no number) or move notification access to a dedicated notification center accessible from the dashboard settings area. Consider showing the count only on the dashboard.

---

## 7. "Inbox up to date" Text at Bottom of Dashboard Is Orphaned
Below the Insights accordion at the very bottom, there's an "Inbox up to date" message with a checkmark. It has no card wrapper, no context, and looks like a rendering artifact.

**Fix:** Either wrap it in a proper card with context ("Email inbox is clear") or remove it. If it's from a widget or status check, integrate it into the SmartInsightCard.

---

## 8. "Reflexion starten" CTA in Check-in Banner Is German
The evening check-in banner shows the correct English label "Time to reflect on your..." but the CTA button reads "Reflexion starten" (German). This is a translation key fallback issue.

**Fix:** The `t('checkin.startReflection')` key likely returns the German value. Add the English translation or use the hardcoded fallback "Reflect" (which is already there but isn't being used, meaning the key IS returning a value — just the wrong language).

---

## 9. Calendar Header Shows Hamburger Menu — Redundant
The Calendar view shows a hamburger menu (☰) on the left that opens the MoreSheet. But the bottom nav already provides navigation to all panels, and the hamburger is not present on Dashboard or Dori. This is inconsistent.

**Fix:** Remove the hamburger menu from the ContextualHeader on all primary tabs (dashboard, calendar, email, health, chat). These are reachable via bottom nav. Only show the hamburger on secondary panels accessed via MoreSheet.

---

## 10. Email Panel Shows HTML Entities in Preview Text
Email previews show raw HTML entities like `We&#39;re validating your Page indexing...` instead of properly decoded text. The preview text is not being sanitized/decoded before display.

**Fix:** Run preview text through a simple HTML entity decoder (e.g., `DOMParser` or a regex for common entities like `&#39;` → `'`, `&amp;` → `&`).

---

## Implementation Priority

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Fix localization bugs (#2, #8) | Small | High |
| 2 | Fix permanent loading skeletons (#3, #4) | Medium | High |
| 3 | Decode HTML entities in email (#10) | Small | High |
| 4 | Dori empty state spacing (#1) | Small | Medium |
| 5 | Remove orphaned "Inbox up to date" (#7) | Small | Medium |
| 6 | Add Dori label to bottom nav (#5) | Small | Medium |
| 7 | Remove hamburger from primary tabs (#9) | Small | Medium |
| 8 | Tame notification badge (#6) | Small | Low |

