

# Islam Feature — Remaining Improvements

After the major overhaul (7→5 tabs, overview dashboard, dhikr counter, duas search, design system), here are the remaining items to complete:

---

## 1. Wire `onPrayerUpdate` in PrayerTimesTab
The countdown effect at line 518-532 updates local state (`countdown`, `nextPrayerName`) but never calls `onPrayerUpdate`. The Home tab therefore shows no prayer data.

**Fix:** Add `onPrayerUpdate?.(next.prayer.name, next.prayer.time || '', countdownStr)` inside the `updateCountdown` function after setting local state.

**File:** `src/components/islam/PrayerTimesTab.tsx` — line ~525

---

## 2. Add Prayer Tracker (Mark Prayers Completed)
The prayer times list (line 792-830) shows times but has no way to mark prayers as prayed. Add a tap-to-check circle next to each prayer row that persists in localStorage (keyed by date), plus a "3/5 prayed" progress indicator at the top of the prayer card.

**File:** `src/components/islam/PrayerTimesTab.tsx` — add `completedPrayers` state with localStorage persistence, a `CheckCircle2` toggle on each row, and a progress summary.

---

## 3. Replace `Card` with `GlassCard` in PrayerTimesTab
The prayer tab still uses raw `Card` imports. Swap all `Card` usage for `GlassCard` for design consistency.

**File:** `src/components/islam/PrayerTimesTab.tsx`

---

## 4. Fix Health "Try Again" CTA (from Round 7)
This was planned in the previous round but not yet implemented. The Health page empty state uses "Try Again" which implies failure.

**Fix:** Change to "Get Started" or "Connect Health Data".

**File:** `src/components/health/HealthHubPanel.tsx`

---

## Summary

| # | Item | Effort |
|---|------|--------|
| 1 | Wire onPrayerUpdate callback | Tiny |
| 2 | Prayer completion tracker | Small |
| 3 | PrayerTimesTab design system | Small |
| 4 | Health CTA copy fix | Tiny |

