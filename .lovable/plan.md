
# Deep Module Interconnection + AI Daily Voice Briefing

## Vision
Transform DarAI from siloed modules into a deeply interconnected intelligent system where email, calendar, contacts, contracts, and the AI assistant all feed into each other -- with a new AI-generated daily voice briefing as the centerpiece.

---

## Feature 1: AI Daily Voice Briefing on Dashboard

A new dashboard card where the AI generates a personalized daily summary and reads it aloud using text-to-speech. The briefing aggregates data from ALL modules.

### New Edge Function: `daily-voice-briefing`
- Accepts user_id and fetches cross-module data server-side:
  - Pending tasks (count, top 3 by priority)
  - Today's calendar events
  - Unread email count + priority emails
  - Contract alerts (upcoming renewals/cancellations)
  - Contacts overdue for follow-up
  - Habit completion status
  - Yesterday's check-in mood/energy
- Sends all context to Gemini 3 Flash (via Lovable AI gateway) with a prompt like: "Generate a warm, concise 30-second daily briefing script for this user. Be specific, mention names and times."
- Returns: `{ briefingText: string, highlights: [...] }`

### New Component: `DailyBriefingCard`
- Displayed prominently on the dashboard (below the hero)
- Shows a text summary with key highlights as chips/badges
- Play button that reads the briefing aloud via Web Speech API (existing `useTextToSpeech` hook)
- Auto-play option (respects existing morning auto-play setting)
- Cached per day so it doesn't re-generate on every page load

### Files
- `supabase/functions/daily-voice-briefing/index.ts` (new)
- `src/components/dashboard/DailyBriefingCard.tsx` (new)
- `src/hooks/useDailyBriefing.ts` (new)
- `src/components/dashboard/DashboardPanel.tsx` (add card)

---

## Feature 2: Email-to-Calendar Integration

When an email contains dates, times, or meeting references, surface a one-tap "Add to Calendar" action.

### Changes
- Update the `extract-contract-from-email` edge function (or create a shared extraction endpoint) to also detect event-like data: dates, times, locations, meeting links
- Add an "Add to Calendar" button in `EmailDetailSheet.tsx` that pre-fills an event creation dialog with AI-extracted data (title from subject, time from email body, description from snippet)
- Show a small calendar icon badge on `EmailCard.tsx` when the email contains detected dates

### Files
- `supabase/functions/extract-contract-from-email/index.ts` (extend to also return `detectedEvent` data)
- `src/components/email/EmailDetailSheet.tsx` (add "Add to Calendar" action)
- `src/components/email/EmailCard.tsx` (date detection badge)

---

## Feature 3: Email-to-Contact Linking

Automatically link emails to existing contacts and surface contact context when reading emails.

### Changes
- In `EmailDetailSheet.tsx`, match the sender email against `user_contacts` table
- If a match is found, show a mini contact card (name, tier, last contacted, relationship) inline in the email detail view
- Add a "Save as Contact" button when no match exists, pre-filling name and email
- When viewing a contact profile, show their recent emails in the timeline

### Files
- `src/components/email/EmailDetailSheet.tsx` (contact context card)
- `src/components/contacts/ContactTimeline.tsx` (add email history section)

---

## Feature 4: Smart Dashboard Insight Card (Cross-Module)

Upgrade the existing `SmartInsightCard` to pull insights from ALL modules instead of just tasks.

### Changes
- Add email-based insights: "You have 3 unread priority emails from key contacts"
- Add contract insights: "Insurance contract renews in 5 days -- review or cancel?"
- Add contact insights: "You haven't spoken to [Name] in 45 days"
- Add calendar-email correlation: "Meeting with [Contact] tomorrow -- check their latest email"
- Rotate through these insights automatically

### Files
- `src/components/dashboard/SmartInsightCard.tsx` (accept emails, contracts, contacts props)
- `src/components/dashboard/DashboardPanel.tsx` (pass new data to SmartInsightCard)

---

## Feature 5: Contextual Quick Actions (Cross-Module)

Enhance the existing `useContextualActions` hook to suggest actions based on cross-module data.

### Changes
- Add email-aware actions: "Reply to [Contact]'s email" when there are priority unread emails from known contacts
- Add contract-aware actions: "Review [Contract] renewal" when a deadline is within 3 days
- Add calendar-contact actions: "Prepare for meeting with [Name]" when a calendar event matches a contact
- These actions appear in the QuickActionsBar on the dashboard

### Files
- `src/hooks/useContextualActions.ts` (add email, contract, calendar-contact cross-references)
- `src/components/dashboard/DashboardPanel.tsx` (pass onNavigate to QuickActionsBar)

---

## Technical Details

### Daily Voice Briefing Edge Function
```text
POST /daily-voice-briefing
Body: { user_id }
Response: {
  briefingText: "Good morning, Dar! You have 4 tasks today, including...",
  highlights: [
    { type: "task", label: "4 tasks, 1 overdue" },
    { type: "email", label: "3 unread priority" },
    { type: "contract", label: "Insurance renews in 5 days" },
    { type: "contact", label: "Follow up with Ahmed" }
  ]
}
```

Uses Lovable AI gateway with `google/gemini-3-flash-preview` model. Queries tasks, events, user_emails, contracts, user_contacts, daily_checkins tables server-side using the service role key.

### Data Flow for Cross-Module Features
```text
Email sender --> match against user_contacts.email
Email body --> AI extract --> calendar event / contract data
Contact profile --> query user_emails WHERE from_email = contact.email
Calendar event title --> fuzzy match against contact names
Contract provider --> match against email senders
```

### Caching Strategy
- Daily briefing: cached in localStorage with date key, regenerated once per day
- Cross-module matches (email-contact): computed on render, lightweight DB queries
- Smart insights: refreshed every 5 minutes (existing pattern)

## Summary of Files Modified/Created
- `supabase/functions/daily-voice-briefing/index.ts` (new)
- `src/components/dashboard/DailyBriefingCard.tsx` (new)
- `src/hooks/useDailyBriefing.ts` (new)
- `src/components/dashboard/DashboardPanel.tsx` (add briefing card + pass data to SmartInsightCard)
- `src/components/dashboard/SmartInsightCard.tsx` (cross-module insights)
- `src/components/email/EmailDetailSheet.tsx` (contact card + calendar action)
- `src/components/email/EmailCard.tsx` (date badge)
- `src/components/contacts/ContactTimeline.tsx` (email history)
- `src/hooks/useContextualActions.ts` (cross-module actions)
- `supabase/functions/extract-contract-from-email/index.ts` (extend for calendar detection)
