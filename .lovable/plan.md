
# Contacts Feature -- UI/UX Overhaul and Scroll Fix

## Problems Identified

1. **Scroll is broken**: The `ContactsPanel` (used on desktop sidebar) wraps `ScrollArea` with `h-full` inside a `PullToRefresh` inside `Tabs`, but the height chain is broken -- `ScrollArea` has no constrained height, so it just expands infinitely and never scrolls.

2. **Two duplicate implementations**: There's `ContactsPanel.tsx` (sidebar panel, 621 lines) AND `ContactsPage.tsx` (full page, 1060 lines). They share almost identical logic (form data, handlers, contact cards) but are maintained separately. The page version is richer (has table view, profile card dialog, email templates, network health, timeline tabs, import/export). The panel version is a stripped-down copy missing many features.

3. **No profile card on sidebar panel**: Clicking a contact in `ContactsPanel` opens the edit dialog directly, while `ContactsPage` opens the rich `ContactProfileCard` with interaction history, AI insights, and quick actions.

4. **Refresh does a full page reload**: `handleRefresh` in `ContactsPanel` calls `window.location.reload()` instead of using the hook's `refetch()`.

5. **Missing integration points**: Contacts are not connected to other features inline (tasks mentioning contacts, calendar showing contact follow-up reminders, family members linked to contacts).

---

## What Changes

### 1. Fix Scroll in ContactsPanel (Critical)

Replace the broken height chain. The `ScrollArea` needs explicit height via `flex-1 min-h-0` pattern on its parent, and the `Tabs` content area needs `overflow-hidden` with a proper flex layout.

- Root div: `h-full flex flex-col` (already correct)
- Header + Search: fixed-height, flex-shrink-0
- Tabs wrapper: `flex-1 flex flex-col min-h-0 overflow-hidden`
- TabsContent: `flex-1 min-h-0`
- ScrollArea: `h-full` inside the constrained container
- Remove `PullToRefresh` wrapping (it breaks flex height chain) or fix its height passthrough

### 2. Upgrade ContactsPanel to Match ContactsPage Features

Instead of maintaining two separate implementations, refactor `ContactsPanel` to include the best features from `ContactsPage`:

- Add `ContactProfileCard` dialog (click contact opens profile, not edit form)
- Add card/table view toggle
- Add Insights and Timeline tabs (compact versions)
- Add Import/Export button in header
- Add Email Template support
- Use `refetch()` instead of `window.location.reload()` for pull-to-refresh

### 3. Better Contact Cards

- Make cards more compact for the sidebar with key info visible at a glance
- Show last contacted time prominently
- Add quick-action buttons that appear on hover (desktop) or are always visible (mobile)
- Add a small priority indicator for overdue contacts (pulsing dot)

### 4. Auto-Link Contacts with Other Features

- When viewing a contact marked as "family", show a badge linking to Family Hub
- When a contact has upcoming birthday, show inline reminder
- Show task count if any tasks mention the contact's name in notes

---

## Technical Details

### File: `src/components/contacts/ContactsPanel.tsx`

**Scroll fix:**
- Change the Tabs wrapper from `className="flex-1 flex flex-col"` to `className="flex-1 flex flex-col min-h-0 overflow-hidden"`
- Wrap each TabsContent in a container with `flex-1 min-h-0 overflow-hidden`
- Either remove `PullToRefresh` or ensure it passes `className="flex-1 min-h-0 overflow-hidden h-full"` through

**Feature additions:**
- Import `ContactProfileCard`, `ContactNetworkHealth`, `ContactTimeline`, `ContactImportExport`, `EmailTemplateDialog`
- Add `selectedContact` state for profile card dialog
- Change `ContactCard` `onClick` to open `ContactProfileCard` instead of edit dialog
- Add edit button on card that opens edit dialog
- Add `viewMode` state (cards/table) with toggle in header
- Add 'insights' and 'timeline' tabs (5 tabs total matching ContactsPage)
- Replace `window.location.reload()` with the hook's `refetch` function
- Add `useContactInteractions` and `useSmartContactReminders` hooks

### File: `src/components/contacts/ContactProfileCard.tsx`

Minor improvements:
- Ensure the ScrollArea inside has proper height constraints
- Add an "Edit" button in the header for quick access to edit dialog

### File: `src/pages/ContactsPage.tsx`

- After the panel is upgraded, redirect `/contacts` route to the main app with contacts panel active (or keep as a standalone page for direct URL access). No code duplication changes needed immediately -- we focus on making the panel great first.

### No database changes needed

All improvements are purely UI/component level.
