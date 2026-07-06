# DarAI Performance And Reliability Design

Date: 2026-07-06

## Goal

Improve DarAI's startup reliability, first-load performance, PWA update behavior, and maintenance posture without taking on a risky rewrite of the largest feature areas in one pass.

This project turns the audit findings into staged changes that can be verified with the existing checks: format, lint, typecheck, tests, audit, build, and bundle analysis.

## Scope

Included:

- Fail production builds early when required Vite client environment variables are missing.
- Improve initial chunking so shared React runtime code is not accidentally pulled through feature-named chunks.
- Reduce eager app-shell work where a narrow, safe change is available.
- Lazy-load locale data so inactive languages do not inflate the main bundle.
- Tighten PWA precaching so analyzer output and avoidable lazy assets are not forced into the first service-worker install.
- Align Supabase function auth config with the actual `chat` function behavior.
- Add budget checks for bundle and PWA precache growth.
- Document local tooling expectations for Bun and Deno.

Deferred:

- Full decomposition of `supabase/functions/chat/index.ts`.
- Full dashboard data-boundary rewrite of `src/pages/Index.tsx`.
- Major dependency migrations such as React 19, React Router 7, Tailwind 4, Zod 4, or Recharts 3.

These deferred items are intentionally separated because they touch broad runtime behavior and deserve their own focused implementation plans.

## Architecture

### Build Safety

Add a small build-time validation layer that checks `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` during production builds. The validator should fail with a clear error before Vite emits a bundle that can crash at runtime.

The validation must still allow CI's deliberate placeholder values when CI only needs to prove the app compiles. That allowance should be explicit, not accidental.

### Bundle Strategy

Review the manual chunk strategy in `vite.config.ts` so core React runtime modules are grouped before feature-specific vendor chunks. The intended outcome is:

- React, React DOM, scheduler, and router code live in a stable core vendor chunk.
- Feature libraries such as dnd-kit, Recharts, and animation libraries do not become required by unrelated app-shell imports.
- The default route has fewer initial modulepreload dependencies.

Where app-level animation forces a heavy animation chunk into the first load, prefer a CSS-based route fade or a smaller local transition.

### Locale Loading

Change the i18n module from eager imports of every locale to dynamic loading of the active locale. The language context remains the public interface for consumers, but its internals should support async locale resolution with a fallback to English.

Expected behavior:

- Initial app load only fetches the active language.
- Missing or failed locale loads fall back to English.
- Existing translation key access remains compatible.

### PWA Strategy

Adjust Workbox/VitePWA settings so analysis artifacts are excluded and the precache is limited to assets that are useful for the app shell. Lazy route chunks should be cached on demand unless full offline availability for every feature is explicitly required.

Expected behavior:

- `dist/stats.html` is never precached.
- The service worker still supports app-shell offline behavior.
- Precache size becomes measurable and budgeted.

### Supabase Auth Alignment

The `chat` edge function currently requires a resolved user, while config marks it public. Align the Supabase config and local auth manifest with the implemented behavior. If a future anonymous chat mode is needed, it should be added intentionally with rate limits and tests.

Expected behavior:

- Config communicates that `chat` is authenticated.
- Tests or checks protect against accidental auth drift.

### Budget Checks

Add a script that inspects the generated `dist` output and fails when important budgets are exceeded. Initial budgets should be lenient enough to pass the current app after the first optimization pass, then can be tightened over time.

Suggested measured budgets:

- Initial JavaScript gzip size.
- Largest JavaScript chunk gzip size.
- Total service-worker precache size.

The script should print the measured values so CI output is actionable.

### Tooling Documentation

Update local setup documentation to clarify Bun and Deno expectations. Bun is required for the frontend workflow; Deno is required for local edge-function parity with CI.

## Data Flow

Build-time validation runs before or during Vite config evaluation and stops invalid production bundles.

Runtime locale loading flows through the existing language context:

1. Read selected language.
2. Load that locale module.
3. Publish translations to consumers.
4. Fall back to English on failure.

PWA caching remains controlled by VitePWA/Workbox:

1. Build emits assets.
2. Budget script measures `dist`.
3. Service worker precaches only configured shell assets.
4. Runtime caching handles additional lazy chunks as they are requested.

## Error Handling

- Missing production env vars fail fast with the variable names included.
- Locale loading failures fall back to English and avoid a blank app.
- Budget failures report actual values and configured limits.
- Auth misconfiguration should be visible through config/tests rather than discovered through runtime behavior.

## Testing

Run the existing verification suite after implementation:

- `bun run format:check`
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run audit`
- `bun run build`
- `bun run analyze`

Add or update focused tests where behavior changes:

- Env validation helper tests if it is implemented outside Vite config.
- Locale-loading fallback tests around the language/i18n layer.
- Budget script test or fixture if the script has non-trivial parsing logic.

CI should include the new budget check after build.

## Rollout Plan

1. Add build validation and documentation.
2. Adjust vendor chunking and app-shell animation.
3. Lazy-load locale data.
4. Tighten PWA precache and add bundle budget checks.
5. Align Supabase auth config.
6. Run the full verification suite and compare build output.

## Risks

- Manual chunk changes can move bytes between chunks without reducing total JavaScript. Verification must focus on initial preload weight and runtime behavior, not only individual file names.
- Locale loading introduces async state. The fallback path must keep the UI stable.
- PWA changes can affect offline behavior. The app shell should remain available offline, while lazy features can cache on first use.
- Auth config changes can break consumers that relied on anonymous `chat` access. The current function behavior already requires auth, so the config should reflect the existing runtime contract.

## Success Criteria

- Production builds fail early when required client env vars are absent.
- Existing checks pass.
- `dist/stats.html` is excluded from service-worker precache.
- The active locale is not bundled together with every other locale in the initial app chunk.
- Core React runtime code is not loaded through a feature-named dnd chunk.
- Supabase `chat` auth config matches the function's authenticated behavior.
- CI has a measurable budget guard for bundle/precache growth.
