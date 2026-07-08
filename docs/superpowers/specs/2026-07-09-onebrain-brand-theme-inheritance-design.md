# OneBrain Brand Theme Inheritance Design

## Purpose

New customer projects should start with a consistent brand across the assistant
and AI communication tools. OneBrain owns the customer/project brand at
deployment time. Each deployed tool receives those main colors as its starting
theme, while still allowing tool-specific color overrides later.

The first standard brand is Assad Dar, matching `assad-dar.de`.

## Goals

- Store the customer/project brand profile centrally in OneBrain.
- Seed every deployed assistant and communication tool from that profile.
- Let each tool keep its own overrides without changing the OneBrain project
  brand.
- Keep UI components on semantic theme tokens instead of raw brand colors.
- Start with the current assistant web app by centralizing the Assad Dar palette
  and preparing it for a future OneBrain brand payload.

## Non-Goals

- No visible theme editor in the first assistant-web slice.
- No automatic logo extraction or AI color picking in the first slice.
- No customer-facing dark-mode system yet, though the data model should allow
  one later.

## Brand Model

OneBrain stores a project-level `brand_profile` as the canonical default:

```json
{
  "project_id": "project_123",
  "brand_name": "Assad Dar",
  "source": "deployment",
  "colors": {
    "primary": "#a66e2f",
    "secondary": "#3e5573",
    "accent": "#8c5a24",
    "background": "#f7f5f1",
    "surface": "#ffffff"
  }
}
```

Tools store only explicit overrides:

```json
{
  "project_id": "project_123",
  "tool_id": "assistant-web",
  "colors": {
    "primary": "#9b6128"
  }
}
```

The effective theme is resolved in this order:

```ts
effectiveTheme = merge(
  assadDarDefaultTheme,
  oneBrainProjectBrand,
  toolThemeOverride
);
```

This means the customer brand travels with the deployment, and tools can become
individual later without drifting from the customer default by accident.

## Semantic Theme Tokens

Raw brand colors are converted into semantic UI tokens before components use
them:

| Token | Meaning |
|---|---|
| `background` | App/page background |
| `surface` | Main cards, nav active states, forms |
| `surfaceSecondary` | Icon wells, soft panels, inactive steps |
| `ink` | Primary text |
| `inkSecondary` | Supporting text |
| `muted` | Metadata and low-emphasis labels |
| `primary` | Primary actions and brand emphasis |
| `primaryHigh` | Hover/pressed primary action |
| `secondary` | Informational accents and secondary emphasis |
| `focus` | Keyboard focus outline |
| `hairline` | Borders and dividers |
| `success` | Success state only |
| `critical` | Error/destructive/high-risk state only |
| `onPrimary` | Text/icon color used on `primary` |

Components must reference semantic tokens, not customer-specific names like
`copper` or `slate`.

## Assad Dar Standard Theme

The current standard theme maps to the live `assad-dar.de` light palette:

| Token | Value |
|---|---|
| `background` | `#f7f5f1` |
| `surface` | `#ffffff` |
| `surfaceSecondary` | `#f1ece2` |
| `ink` | `#16191e` |
| `inkSecondary` | `#454c57` |
| `muted` | `#5f6671` |
| `primary` | `#a66e2f` |
| `primaryHigh` | `#8c5a24` |
| `secondary` | `#3e5573` |
| `success` | `#1f7a4d` |
| `critical` | `#b4453e` |
| `hairline` | `#ddd6ca` |
| `focus` | `#3e5573` |
| `onPrimary` | `#ffffff` |

## Deployment Flow

1. A new customer/project is created in OneBrain.
2. The deployment flow records the project `brand_profile`.
3. OneBrain provisions the assistant stack and AI communication tools with the
   project id and brand version.
4. Each tool loads the project brand from OneBrain during startup or first
   request.
5. Each tool resolves `default theme + project brand + tool override`.
6. If a user changes colors inside a tool, that tool writes a
   `tool_theme_override`; the OneBrain project brand remains unchanged.
7. A reset action in each tool can clear its override and return to the
   OneBrain project brand.

## Architecture

OneBrain remains the durable source of truth for the project brand profile and
brand version. Assistant operational services may cache the resolved theme for
performance, but cached values are not authoritative.

Assistant web receives a resolved theme either from:

- a local `assad-dar` preset in the first implementation slice, or
- a future assistant API endpoint backed by OneBrain project settings.

AI communication tools use the same semantic theme contract. Email templates,
Telegram web/admin surfaces, chat widgets, and future portal screens should all
consume the same resolved theme shape even if they render it differently.

## Data Flow

```text
OneBrain project brand
        |
        v
Deployment/provisioning
        |
        v
Tool startup or settings fetch
        |
        v
Theme resolver
        |
        +-- base Assad Dar default
        +-- OneBrain project brand
        +-- optional tool override
        |
        v
CSS variables / template tokens / channel-specific rendering
```

## Error Handling

- Missing OneBrain brand profile: fall back to the Assad Dar standard theme and
  log a degraded configuration warning.
- Invalid color value: reject the update before saving it.
- Low contrast generated theme: keep the submitted raw color, but adjust derived
  semantic tokens such as `onPrimary`, `primaryHigh`, and `hairline` to preserve
  readability.
- OneBrain unavailable during runtime: use the last cached resolved theme if
  available; otherwise use the Assad Dar default.
- Tool override conflicts with a later project brand update: keep the explicit
  tool override and show that the tool is customized when a settings UI exists.

## First Implementation Slice

The first assistant-web change should:

1. Introduce a central Assad Dar theme preset.
2. Rename the CSS custom property layer from brand-specific names such as
   `--copper` and `--slate` to semantic names such as `--primary` and
   `--secondary`.
3. Keep compatibility aliases only if needed to avoid a risky large edit.
4. Update `docs/development/design-system-baseline.md` to describe the theme
   inheritance direction.
5. Keep the UI visually unchanged.

No database migration, settings screen, or OneBrain API endpoint is required in
the first slice.

## Testing

- Verify assistant-web typecheck/build still passes.
- Search CSS and components to confirm new UI code uses semantic theme tokens.
- Add a focused theme resolver test when the resolver becomes TypeScript code.
- Later backend tests should cover project brand fallback, tool override merge,
  invalid color rejection, and reset-to-project-brand behavior.

## Acceptance Criteria

- The Assad Dar palette is centralized as the default brand.
- The assistant web UI still matches the current `assad-dar.de` colors.
- The theme contract clearly supports OneBrain deployment colors and per-tool
  overrides.
- Future tools can consume the same semantic token shape without learning
  assistant-web CSS internals.
