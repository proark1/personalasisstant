# DarAI

AI-powered life dashboard and personal assistant. Built for productivity, health,
communication, finance, travel, and personal growth — with deep cross-module
intelligence, an agentic assistant ("Dori"), and voice-first interactions.

## Features

**Dori — the AI assistant**
- Real-time conversational AI (Google Gemini Live, OpenAI Realtime)
- Agentic planning and action execution (multi-step plans with risk-tiered actions)
- Proactive suggestions, smart nudges, and auto-pilot task automation
- Entity-aware context selection and long-term memory (episodic memory + knowledge graph)
- Learned preferences and routine detection that personalize over time
- AI-generated daily voice briefings aggregating every module

**Productivity**
- Task management with Kanban, timeline, and priority views
- Focus timer with ambient sounds and body doubling
- Habit tracking with streaks and gamification (XP system)
- Smart scheduling — conflict detection, schedule proposals, and one-tap apply
- Project management and shared workspaces with real-time collaboration
- Notes, journaling, and contextual quick actions

**Communication**
- Gmail integration (sync, read, draft replies, send) with email auto-pilot
- AI-powered email categorization, spam/phishing detection, recurring-payment detection
- Calendar OAuth for Google, Microsoft Outlook, and Apple (CalDAV), with two-way sync
- Contact management with relationship tiers and follow-up tracking
- Direct messaging and group chat with end-to-end encryption
- WebRTC voice/video calling
- Telegram bot — chat with Dori, daily/weekly briefings, and family digests

**Meetings**
- Meeting copilot via [MeetingBot](https://github.com/proark1/MeetingBot) — schedule a
  notetaker bot, live control, and webhook-driven transcripts
- Meeting prep, preflight checks, and AI-generated follow-ups

**Health & Wellness**
- Apple HealthKit integration (steps, heart rate, sleep, workouts)
- AI health coach and energy coach with personalized recommendations
- Daily check-ins (mood, energy, stress, sleep, exercise)
- Meal planning with an AI recipe assistant and shopping lists

**Finance**
- Bank linking and transaction sync via Plaid (encrypted tokens at rest)
- AI finance summaries and spending insights
- Contract scanning and AI-powered data extraction
- Renewal alerts, cancellation reminders, and an AI cancellation-email generator

**Travel**
- Trip planning with AI trip overviews and prep checklists
- Travel intelligence (weather, logistics) and AI-generated packing lists

**Content Studio**
- AI content idea generation and script writing, with a daily idea dispatcher

**Islamic Features**
- Prayer times with notifications
- Quran reader with bookmarks and reading progress
- Daily hadith and Islamic holidays calendar with reminders

**Family**
- Family member profiles and shared tasks
- Family budget tracking and shopping lists
- Family assistant/agent (homework help, meal planning), expiry scanning, and spouse hand-off

**Insights & Automation**
- Life-pattern correlation and weekly coaching insights
- Life score with AI commentary
- Activity log of Dori's actions and proactivity instrumentation

**Platform**
- Multi-language UI (English, German) with full i18n
- Admin tooling and per-user data export/import (GDPR-style)
- Offline outbox, PWA offline caching, and graceful degradation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5.8, Vite 5 |
| UI | Tailwind CSS 3, shadcn/ui, Radix UI, Framer Motion |
| State | TanStack React Query, React Context |
| Backend | Supabase-compatible stack, self-hosted on Railway (Auth/GoTrue, Postgres, Realtime, Storage, Edge Functions) |
| Gateway | Caddy reverse proxy (`/rest/v1`, `/auth/v1`, `/realtime/v1`, `/functions/v1`) |
| Edge Functions | Deno, on Supabase's `edge-runtime` image (Railway) |
| Scheduler | Custom long-running cron worker (Railway) — replaces `pg_cron` |
| AI | Google Gemini, OpenAI Realtime API, Perplexity (web search) |
| Mobile | Capacitor 8 (iOS + Android) |
| PWA | Vite PWA Plugin with offline caching |
| Forms | React Hook Form + Zod validation |
| Charts | Recharts |
| i18n | Custom typed i18n (en, de) |
| Tooling | Bun, ESLint 9, Prettier, Vitest, jest-axe |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (the repo is locked with `bun.lock`; CI uses Bun). Node.js 18+
  also works with the same `package.json` scripts.

### Development

```sh
# Clone the repository
git clone https://github.com/proark1/darainew.git
cd darainew

# Install dependencies
bun install

# Start the development server
bun run dev
```

The app runs at `http://localhost:8080`.

### Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Production build |
| `bun run build:dev` | Development build |
| `bun run analyze` | Production build with bundle visualizer |
| `bun run lint` | Run ESLint |
| `bun run format` | Format with Prettier |
| `bun run format:check` | Check formatting |
| `bun run typecheck` | Type-check with `tsc --noEmit` |
| `bun run test` | Run Vitest once |
| `bun run test:watch` | Run Vitest in watch mode |
| `bun run preview` | Preview production build |

### Environment Variables

Create a `.env` file in the project root (see [`.env.example`](./.env.example)):

```env
VITE_SUPABASE_PROJECT_ID=darai
VITE_SUPABASE_URL=https://your-gateway.up.railway.app
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_jwt
```

Anything `VITE_*` is bundled into the client. Point `VITE_SUPABASE_URL` at the Caddy
gateway, which routes to the right backend service.

Server-side secrets live on the Railway services (edge-runtime, gateway), **not** in the
frontend `.env`. The full list is in [`edge-runtime/README.md`](./edge-runtime/README.md);
the most important ones:

| Secret | Used By |
|--------|---------|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | The runtime + supabase-js client inside functions |
| `APP_URL` (+ optional `APP_URLS`) | CORS origin restriction; throws at module load if unset |
| `INTERNAL_AUTH_SECRET` | Hardened service-role + Telegram user path |
| `GEMINI_API_KEY` | Gemini (chat, embeddings, TTS, Live, briefings) |
| `OPENAI_API_KEY` | OpenAI Realtime, TTS, STT |
| `PERPLEXITY_API_KEY` | Web search |
| `TELEGRAM_API_KEY` + `TELEGRAM_WEBHOOK_SECRET` | Telegram bot ([webhook setup](./supabase/functions/telegram-poll/WEBHOOK.md)) |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google Calendar/Gmail OAuth |
| `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` | Outlook Calendar OAuth |
| `MEETINGBOT_BASE_URL` + `MEETINGBOT_API_KEY` + `MEETINGBOT_WEBHOOK_SECRET` | Meeting copilot — see [proark1/MeetingBot](https://github.com/proark1/MeetingBot) |
| `PLAID_CLIENT_ID` + `PLAID_SECRET` + `PLAID_ENV` | Plaid bank linking + transaction sync (`sandbox`/`development`/`production`) |
| `BANK_TOKEN_SECRET` | 64-hex-char (32-byte) AES-GCM key for encrypting Plaid `access_token`s at rest. `openssl rand -hex 32` |

Weather uses [Open-Meteo](https://open-meteo.com) and needs no key.

### Optional native plugins

| Package | Used by |
|---------|---------|
| `@capacitor/camera` | Vision capture — installs the native iOS / Android camera flow. Without it, the web file-input fallback (`<input type="file" capture="environment">`) is used. Add with `bun add @capacitor/camera && npx cap sync`. |

## Architecture

DarAI was migrated off Supabase Cloud onto a self-hosted, Supabase-compatible stack
running on Railway. Each piece has its own service and README:

| Service | Role | Docs |
|---------|------|------|
| **gateway** | Caddy reverse proxy that fronts all `/rest`, `/auth`, `/realtime`, `/functions` traffic | [`gateway/Caddyfile`](./gateway/Caddyfile) |
| **edge-runtime** | Runs all Deno edge functions unchanged on Supabase's `edge-runtime` image | [`edge-runtime/README.md`](./edge-runtime/README.md) |
| **db / migrate** | Postgres + migrate-on-deploy runner | [`db/MIGRATIONS.md`](./db/MIGRATIONS.md), [`db/RAILWAY_DB_MIGRATION.md`](./db/RAILWAY_DB_MIGRATION.md), [`db/CUTOVER_RUNBOOK.md`](./db/CUTOVER_RUNBOOK.md) |
| **cron** | Long-running scheduler that pings cron functions (replaces `pg_cron`) | [`cron/README.md`](./cron/README.md) |

The original Supabase → Railway cutover backup tooling lives in
[`scripts/migration/README.md`](./scripts/migration/README.md).

### Project Structure

```
src/
  pages/           # 15 page components (Index, Dashboard, Finance, Travel, Workspaces, …)
  components/      # 58 feature directories (tasks, chat, calendar, finance, travel, memory, …)
    ui/            # 60+ shadcn/Radix UI primitives
  hooks/           # ~177 custom React hooks
  contexts/        # Auth, Language, Workspace, Dori conversation providers
  config/          # App configuration
  i18n/            # Typed translations (en, de)
  lib/             # Utilities (encryption, parsing, telemetry, payload building)
  integrations/    # Supabase client and generated types
  types/           # Shared TypeScript types
  utils/           # Helpers
  test/            # Test setup

supabase/
  functions/       # 108 Deno Edge Functions (dispatched by main/index.ts)
  migrations/      # Database schema migrations (applied by the migrate service)
  config.toml      # Per-function JWT settings

db/                # Postgres bootstrap, migrate-on-deploy runner, Railway config
edge-runtime/      # Dockerfile + README for the self-hosted edge runtime
gateway/           # Caddy reverse proxy
cron/              # Self-hosted scheduler (scheduler.mjs)
scripts/migration/ # Supabase backup/verify tooling
```

### Routes

| Route | Access | Page |
|-------|--------|------|
| `/` | Protected | Main app (tasks, chat, panels) |
| `/dashboard` | Protected | Analytics and insights |
| `/contacts` | Protected | Contact management |
| `/contracts` | Protected | Contract tracking |
| `/finance` | Protected | Finance OS (Plaid, spending) |
| `/travel` | Protected | Trip planning and travel intelligence |
| `/workspaces` | Protected | Shared team workspaces |
| `/activity` | Protected | Dori activity log |
| `/onboarding` | Protected | New-user onboarding |
| `/auth/calendar-callback` | Protected | OAuth callback |
| `/landing` | Public | Landing page |
| `/auth` | Public | Login / Signup |
| `/forgot-password` | Public | Password reset request |
| `/reset-password` | Any | Set new password |

### Edge Functions (108)

Requests hit the dispatcher (`supabase/functions/main/index.ts`), which routes by the
first path segment to the matching function. Grouped by domain:

**Dori & core AI**
`chat`, `chat-ai`, `ai-assistant`, `gemini-live`, `openai-realtime-session`,
`dori-plan-execute`, `dori-execute-action`, `dori-proactive`, `dori-onboarding-seed`,
`proactive-assistant`, `proactive-feedback`, `auto-pilot`

**Memory & knowledge graph**
`episodic-memory-builder`, `embed-memories-backfill`, `kg-extract`, `memory-forget`,
`learned-preferences-rollup`, `routine-learner`

**Voice & vision**
`text-to-speech`, `voice-to-text`, `daily-voice-briefing`, `vision-capture`, `vision-commit`

**Briefings**
`morning-briefing`, `morning-thread`, `briefing-dispatch-cron`

**Email**
`gmail-sync`, `gmail-sync-cron`, `gmail-fetch-email`, `gmail-send-reply`,
`email-draft-reply`, `email-autopilot`, `email-classifier`, `detect-recurring-payments`,
`extract-contract-from-email`

**Calendar & scheduling**
`calendar-oauth-start`, `calendar-oauth-callback`, `calendar-sync`, `calendar-sync-all`,
`import-calendar`, `conflict-detector`, `propose-schedule`, `apply-schedule`,
`outlook-oauth-start`, `outlook-oauth-callback`, `outlook-sync`,
`apple-caldav-connect`, `apple-caldav-sync`

**Meetings (MeetingBot copilot)**
`meeting-bot-schedule`, `meeting-bot-control`, `meeting-bot-webhook`,
`meeting-bot-reconciler-cron`, `meeting-prep`, `meeting-preflight`, `meeting-followup`

**Finance**
`plaid-link-token`, `plaid-exchange`, `plaid-sync`, `plaid-sync-cron`, `finance-summary`

**Contracts**
`scan-contract`, `generate-cancellation-email`, `cancel-subscription`

**Travel**
`trip-overview`, `trip-prep`, `trip-prep-cron`, `travel-intelligence`,
`generate-packing-list`, `weather-forecast`

**Health**
`health-insights`, `health-coach`, `energy-coach`

**Family**
`family-assistant`, `family-agent`, `family-expiry-scanner`, `spouse-handoff`,
`recipe-assistant`, `telegram-family-morning-digest`

**Islamic**
`prayer-times`, `islamic-daily-hadith`, `islamic-event-reminders`

**Content Studio**
`content-ideas`, `content-ideas-cron`, `content-script`

**Telegram bot**
`telegram-poll`, `telegram-link`, `telegram-router`, `telegram-register-commands`,
`telegram-diagnostics`, `telegram-weekly-briefing`

**Workspaces**
`workspace-join`, `workspace-weekly-recap`, `workspace-recap-cron`

**Insights & analytics**
`analyze-patterns`, `contact-insights`, `life-correlator`, `life-score-commentary`,
`weekly-review`, `weekly-coach`

**Notifications**
`send-push-notification`, `push-delivery`, `call-push-notification`

**Search**
`web-search`

**Admin & data**
`admin-user-management`, `admin-data-export`, `admin-data-import`, `user-data-export`

**Infrastructure**
`main` (request dispatcher)

> Recurring jobs (the `*-cron` functions and a few siblings) are fired by the Railway
> scheduler — see [`cron/README.md`](./cron/README.md). Telegram replies arrive via
> webhook, not the scheduler — see [the webhook guide](./supabase/functions/telegram-poll/WEBHOOK.md).

### Security

- **JWT verification** at the Caddy gateway per [`supabase/config.toml`](./supabase/config.toml),
  plus in-code `getUser()` validation on user-facing functions.
- **Service-role / cron functions** (`*-cron`, `push-delivery`, `proactive-assistant`,
  webhooks) gate internally on a service-role bearer and skip the gateway JWT check.
- **`INTERNAL_AUTH_SECRET`** enables the hardened service-role + Telegram-user path.
- **OAuth**: HMAC-SHA256 signed state parameter with short expiry.
- **CORS**: restricted to `APP_URL` (+ optional `APP_URLS`); throws at module load if unset.
  Localhost is whitelisted only when `APP_ENV=development`.
- **Headers**: `X-Content-Type-Options: nosniff` on responses.
- **Encryption**: end-to-end encrypted messaging via the Web Crypto API (CryptoKey in
  IndexedDB); Plaid `access_token`s encrypted at rest with AES-GCM (`BANK_TOKEN_SECRET`).
- **Mutations** are scoped by `user_id`; input is validated (email format, path-traversal
  prevention, XSS protection via DOMPurify).
- **Webhooks** (MeetingBot, Telegram) verify an HMAC/secret token before processing.

### Design System

Three complete themes with CSS custom properties:
- **Light** — Clean white with teal-cyan primary
- **Dark** — Deep space blue with cyan accents
- **Colorful** — Vibrant magenta primary with neon yellow accent

UI features:
- Glassmorphism effects with backdrop blur
- Framer Motion page transitions and micro-interactions
- Haptic feedback on touch interactions
- `prefers-reduced-motion` WCAG compliance
- 44px minimum touch targets
- Safe-area support for notched devices

## Mobile

Built with Capacitor for native iOS and Android deployment (`com.darai.app`).

**Native capabilities:**
- Apple HealthKit integration
- Biometric authentication (Face ID / Touch ID)
- Push notifications with badge and sound
- Local notifications for reminders
- Haptic feedback
- Geolocation for location-based reminders

**PWA support:**
- Service worker with offline caching
- Font and asset caching (1-year expiration)
- App manifest with shortcuts and icons

## Continuous Integration

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on every PR and push to
`main` using Bun: install (frozen lockfile), lint, type-check, test, and build. Lint
errors block; warnings are still allowed while remaining `no-explicit-any` flags are
paid down.

## License

Private project.
