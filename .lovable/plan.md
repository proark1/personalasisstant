
# Mobile Email and Calendar Fixes + Contact Picker

## Problem
1. Email cards and calendar items have text overflowing off the right side of the screen on mobile
2. Compose email has no way to search/select contacts -- you must manually type email addresses

## Changes

### 1. Fix Email Panel overflow (`src/components/email/EmailPanel.tsx`)
- Add `overflow-hidden` to the root container `div` (line 200: `h-full flex flex-col relative`)
- Ensure the header section constrains content width with `overflow-hidden` and `min-w-0`

### 2. Fix Email Card overflow (`src/components/email/EmailCard.tsx`)
- Add `overflow-hidden` to the content wrapper div (line 162: `flex-1 min-w-0`)
- The attendees line (line 395) can overflow -- add `truncate` to the attendees text span
- Ensure the tags row (line 183) wraps properly -- it already has `flex-wrap`, but parent needs width constraint

### 3. Fix Calendar Panel overflow (`src/components/calendar/CalendarPanel.tsx`)
- Add `overflow-x-hidden` to the items list container (line 468)
- The `ItemCard` component (line 295) has content that can overflow:
  - The title area (line 309) needs the parent `flex` container to have `min-w-0` and `overflow-hidden`
  - Attendees join text (line 395) needs `truncate`
  - Recurrence description (line 402) needs `truncate`
  - SharedBy badge (line 407) needs `truncate` on the text

### 4. Add Contact Picker to Compose Email (`src/components/email/ComposeEmailSheet.tsx`)
- Replace the plain "To" input with a searchable contact selector
- Import `useContacts` hook to access the user's contacts list
- When the user focuses/types in the "To" field:
  - Filter contacts by name or email matching the typed text
  - Show a dropdown list of matching contacts below the input
  - Clicking a contact fills in their email address
- Keep manual typing supported for non-contact emails
- Show contact name + email in the dropdown for easy identification

## Technical Details

### Contact Picker Implementation
```
ComposeEmailSheet:
  - Add state: contactSearch, showContactList, filteredContacts
  - Import useContacts hook
  - Replace "To" Input with a wrapper div containing:
    - Input field for typing/searching
    - Conditional dropdown below showing filtered contacts
  - On contact select: set `to` to contact.email, clear search
  - On blur (with delay): hide dropdown
```

### Overflow Fixes Summary
The core issue is that `flex-1` children without `min-w-0` or `overflow-hidden` allow content to push beyond viewport. The fix is adding `min-w-0 overflow-hidden` to flex containers and `truncate` to text elements that could exceed available width.

## Files to Modify
1. `src/components/email/EmailPanel.tsx` -- Add overflow containment to root and header
2. `src/components/email/EmailCard.tsx` -- Ensure all text truncates properly within card bounds
3. `src/components/email/ComposeEmailSheet.tsx` -- Add contact search/picker dropdown to "To" field
4. `src/components/calendar/CalendarPanel.tsx` -- Add overflow containment to item cards and text elements
