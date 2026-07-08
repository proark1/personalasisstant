# Design System Baseline

Source: `docs/plans/2026-07-08-onebrain-assistant-implementation-plan.md`.

## Tokens

| Token | Value |
|---|---|
| Background | `#f7f5f1` |
| Main surface | `#ffffff` |
| Secondary surface | `#f1ece2` |
| Ink | `#16191e` |
| Secondary ink | `#454c57` |
| Muted text | `#5f6671` |
| Copper accent | `#a66e2f` |
| Copper high | `#8c5a24` |
| Slate accent | `#3e5573` |
| Success | `#1f7a4d` |
| Critical | `#b4453e` |
| Hairline | `#ddd6ca` |

## Rules

- Main screens, large panels, Today, onboarding, and approval flows stay light.
- Copper is used sparingly for primary action emphasis.
- Slate is used for calm informational states.
- Success and critical are status colors only.
- Use hairline borders and restrained shadows for separation.
- Cards stay at 8px border radius or less.
- Do not put cards inside cards.
- Use icons for common actions and labels or tooltips where meaning is not
  obvious.
- Mobile bottom navigation and desktop side navigation are defined from Phase 0.
- Focus, loading, empty, degraded, and approval-card states must be visible.
