

# Email Hub — Priority Labels on Cards + Next-Level Improvements

## 1. Priority Labels on Email Cards

Currently, the email card only shows small arrow icons (↑ → ↓) in the right column for priority. We'll replace those with clear, color-coded text labels that are immediately visible.

**Changes to `EmailCard.tsx`:**
- Replace the arrow-only priority indicators with labeled badges: "High Priority" (red), "Medium" (amber), "Low" (gray)
- Show the email category as a chip too (e.g., "Action Required", "FYI", "Newsletter")
- Move these into the bottom tags row alongside the existing AI action chip for a clean, scannable layout

**Result:** Each email card will show at a glance: AI suggested action + priority level + category — no need to open the email.

---

## 2. Read/Unread Visual Polish

- Add a bold left-border accent on unread emails (blue bar, like native mail apps)
- Make the unread-to-read transition animated (subtle fade)

---

## 3. Quick Actions Row on Email Cards

Instead of only swipe gestures (which aren't discoverable), add a visible quick-actions row that appears on hover (desktop) or long-press (mobile):
- Archive, Mark Important, Snooze — all without opening the email

---

## 4. Smart Auto-Categorize Nudge

When archiving or marking spam, show a small inline prompt: "Always do this for emails from [domain]?" with Yes/No. This trains the sender rules passively as you triage.

---

## 5. Email Stats Banner

Add a compact stats bar at the top of the email panel showing:
- Total unread count
- Priority emails waiting
- Emails handled today (archived/replied)

This gives a sense of progress and inbox zero motivation.

---

## 6. Pull-to-Refresh

Add a pull-to-refresh gesture on the email list using framer-motion, triggering a sync. More natural than tapping the sync button.

---

## 7. Empty State Improvements

When inbox zero is reached, show a celebratory message ("All caught up!") with a subtle animation instead of a plain "No emails" message.

---

## Technical Details

### Files to Modify

**`src/components/email/EmailCard.tsx`**
- Replace the priority arrow column (lines 175-181) with labeled, color-coded priority badges in the tags row (lines 158-172)
- Add category chip alongside existing action/threat chips
- Add a left border accent for unread emails
- Add hover quick-actions row (Archive, Star, Snooze buttons)

**`src/components/email/EmailPanel.tsx`**
- Add a stats banner below the header showing unread/priority/handled counts
- Improve the empty state with an "All caught up!" message and confetti-style icon
- Add pull-to-refresh via framer-motion drag on the scroll area

**`src/hooks/useEmails.ts`**
- Track "handled today" count (archived + replied in current session)
- Expose the count for the stats banner

**`src/components/email/EmailCard.tsx` — Priority label mapping:**
```text
priority_score 1-2  ->  "High Priority"  (red badge)
priority_score 3    ->  "Medium"         (amber badge)  
priority_score 4    ->  (no label, default)
priority_score 5+   ->  "Low"            (gray badge)
category            ->  Shown as chip: "Action Required", "FYI", "Newsletter", etc.
```

### No database changes needed
All improvements are purely UI/UX and hook logic.

