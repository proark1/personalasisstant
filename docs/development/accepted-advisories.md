# Accepted Dependency Advisories

Advisories that `npm audit` reports but that are deliberately accepted, with the
reasoning. Re-evaluate each entry when the pinned upstream changes.

## GHSA-qx2v-qp2m-jg93 — postcss < 8.5.10 (moderate)

- **Path:** `next` → `postcss@8.4.31` (Next pins the exact version; as of
  2026-07-10 even `next@16.2.10` still pins 8.4.31, so no upgrade resolves it).
- **Vulnerability:** XSS via unescaped `</style>` when PostCSS *stringifies
  untrusted CSS* and the output is embedded in HTML.
- **Why accepted:** Next uses PostCSS at build time on this repository's own
  first-party CSS only. No untrusted CSS is ever parsed or stringified at
  runtime, so the vulnerable code path is not reachable in this product.
- **Attempted fixes:** root `overrides` (flat and nested forms) are silently
  ignored for workspace-hoisted dependencies by npm 11.9 (known npm workspaces
  issue); `npm audit fix --force` would downgrade Next to 9.x.
- **Exit condition:** remove this entry when Next ships a release depending on
  `postcss >= 8.5.10` — then `npm update next` clears the advisory.
