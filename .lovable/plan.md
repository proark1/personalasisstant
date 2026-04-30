## Goal
Keep all Email panel content inside the visible panel width on desktop and mobile, including Smart, All, Actions, and email detail content.

## Likely root cause
This does not look like only one missing line break. The current code already adds `min-w-0`, `max-w-full`, and `overflow-hidden` in several places, so the remaining overflow is likely coming from a combination of:

1. Email UI buttons inheriting `whitespace-nowrap` from the shared `Button` component, which can force cards wider.
2. Some text elements using `truncate` on inline content or without aggressive wrap rules, so very long sender names / subjects / tokens can still push layout.
3. Rendered email HTML needing stronger containment rules for long links, tables, `pre/code`, and unbroken strings.

## Implementation plan
1. Harden all email list card content
   - Update `EmailCard.tsx` so every user-facing text container is width-safe.
   - Convert vulnerable inline truncation targets into block/flex-safe elements.
   - Add stronger wrap utilities such as `break-words`, `[overflow-wrap:anywhere]`, and `break-all` only where needed for pathological strings.
   - Ensure hover action rail cannot widen the card.

2. Fix Email Actions tab width behavior
   - Update `EmailActionPipelineCard.tsx` so action buttons can wrap instead of forcing horizontal growth.
   - Override shared button `whitespace-nowrap` in email-specific action buttons with `whitespace-normal`, `min-w-0`, and compact wrapping layout.
   - Harden subject/reasoning/category rows against long unbroken content.

3. Clamp the Email panel header area
   - Tighten `EmailPanel.tsx` wrappers around stats, search, and tabs.
   - Add explicit wrap/truncate handling for tab labels and badges.
   - Keep the search input/icon row width-safe regardless of placeholder/content.

4. Strengthen email detail/body rendering
   - Extend `.email-body-scoped` styles in `src/index.css` to aggressively contain third-party HTML:
     - `overflow-wrap: anywhere`
     - `word-break: break-word`
     - safe handling for `a`, `pre`, `code`, `table`, `td`, `th`, `img`
   - Prevent long URLs, tables, and pasted plain text from exceeding drawer width.

5. Add final defensive layout guards
   - Re-check shared containers already involved (`PanelShell`, `ScrollArea`) and only add more constraints if still needed.
   - Avoid broad global changes unless necessary; keep the fix scoped to Email surfaces.

6. QA the actual failure states
   - Verify Smart, All, Actions, and opened email detail at desktop width and narrow/mobile width.
   - Confirm there is no horizontal overflow and no text hidden behind icons.

## Files to update
- `src/components/email/EmailCard.tsx`
- `src/components/dashboard/EmailActionPipelineCard.tsx`
- `src/components/email/EmailPanel.tsx`
- `src/components/email/EmailDetailSheet.tsx`
- `src/index.css`
- Possibly one shared wrapper file only if overflow still reproduces after the scoped fixes

## Technical details
Planned tactics:

```text
Email text:
- block/min-w-0/max-w-full
- truncate only on block/flex-safe elements
- break-words / overflow-wrap:anywhere

Email action buttons:
- remove no-wrap behavior locally
- allow wrapping / compact labels
- keep button groups min-w-0 max-w-full

Email HTML:
- clamp links, tables, code, preformatted text
- preserve readability without letting content widen the drawer
```

## Expected result
The Email panel should stop expanding past the right edge, even with long sender names, long subjects, long URLs, large suggested-action rows, or messy email HTML.