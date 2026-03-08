

# Email Feature — UI/UX Overhaul

The email feature is functionally rich (AI analysis, swipe gestures, threading, contract extraction, recurring payment detection, snooze, sender rules) but doesn't use the app's design system and has several UX gaps.

---

## Issues Found

1. **No design system usage** — EmailPanel, EmailCard, EmailDetailSheet all use raw divs/Cards instead of `GlassCard`, `PanelShell`, `staggerItem` animations. Feels like a different app.

2. **No PanelShell wrapper** — The email panel has a custom header instead of the standardized `PanelShell` used everywhere else.

3. **EmailCard lacks GlassCard** — Cards are plain divs with manual hover/active styles instead of `GlassCard pressable haptic="light"`.

4. **EmailDetailSheet layout issues** — Actions bar is cluttered (Archive, Important, Snooze, Spam, Contract, Calendar all on one row). The "Archive & always archive" and "Open in Gmail" buttons at the bottom feel disconnected. Reply composer lacks visual hierarchy.

5. **Loading state** — Uses a raw `animate-pulse` div instead of `PanelSkeleton`.

6. **Connect state** — The "Connect Gmail" empty state doesn't use `EmptyState` component.

7. **Compose sheet** — Missing CC/BCC fields. No rich text formatting hints.

8. **No "Sent" view** — Users can compose and reply but can't see their sent emails.

---

## Plan

### 1. Wrap EmailPanel in PanelShell
Replace the custom header with `PanelShell` (icon: `Mail`, title: "Email"). Move sync button, search, and compose FAB into `actions`. This gives consistent padding, stagger animations, and header style.

**File:** `src/components/email/EmailPanel.tsx`

### 2. EmailCard → GlassCard
Replace the outer `motion.div` card with `GlassCard pressable haptic="light"`. Keep the swipe gesture logic (it's compatible since GlassCard extends motion.div). This adds glassmorphism, consistent hover/active states, and haptic feedback.

**File:** `src/components/email/EmailCard.tsx`

### 3. Loading skeleton → PanelSkeleton
Replace the raw `animate-pulse` loading state with `PanelSkeleton` for visual consistency.

**File:** `src/components/email/EmailPanel.tsx`

### 4. Connect state → EmptyState
Replace the custom "Connect Your Gmail" layout with the `EmptyState` component (icon: Mail, title, description, action button).

**File:** `src/components/email/EmailPanel.tsx`

### 5. EmailDetailSheet — Reorganize Actions
Group actions into a cleaner 2-row layout:
- **Row 1 (primary):** Archive, Star, Snooze, Reply — large tap targets
- **Row 2 (secondary):** Contract, Calendar, Spam, Open in Gmail — smaller, outline style
- Move the "always archive" rule into a collapsible "More" dropdown

**File:** `src/components/email/EmailDetailSheet.tsx`

### 6. Reply Composer Polish
- Add `GlassCard` wrapper around the reply section
- Make AI Draft button more prominent with a gradient accent
- Add a "Quick replies" row with 3 smart suggestions based on email type (e.g., "Thanks!", "Got it, will review", "Let me get back to you")

**File:** `src/components/email/EmailDetailSheet.tsx`

### 7. Compose Sheet — Add CC/BCC Toggle
Add a "CC/BCC" toggle that reveals additional recipient fields. This is expected in any email client.

**File:** `src/components/email/ComposeEmailSheet.tsx`

### 8. StatsBanner → GlassCard
Wrap the stats banner in `GlassCard` with a subtle gradient for visual polish.

**File:** `src/components/email/EmailPanel.tsx`

---

## Summary

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | PanelShell wrapper | Small | High |
| 2 | EmailCard → GlassCard | Small | High |
| 3 | PanelSkeleton loading | Tiny | Medium |
| 4 | EmptyState connect screen | Tiny | Medium |
| 5 | Detail sheet action reorganization | Medium | High |
| 6 | Reply composer polish + quick replies | Medium | High |
| 7 | CC/BCC in compose | Small | Medium |
| 8 | StatsBanner → GlassCard | Tiny | Small |

