# DarAI

AI-powered life dashboard and personal assistant. Built for productivity, health, communication, and personal growth — with deep cross-module intelligence and voice-first interactions.

## Features

**AI Assistant**
- Real-time conversational AI (Gemini Live, OpenAI Realtime)
- AI-generated daily voice briefings aggregating all modules
- Proactive suggestions, smart nudges, and auto-pilot task automation
- Life pattern correlation and weekly coaching insights

**Productivity**
- Task management with Kanban, timeline, and priority views
- Focus timer with ambient sounds and body doubling
- Habit tracking with streaks and gamification (XP system)
- Smart scheduling and contextual quick actions
- Project management with real-time collaboration

**Communication**
- Gmail integration (sync, read, draft replies, send)
- AI-powered email categorization, spam/phishing detection
- Calendar OAuth integration with Google Calendar sync
- Contact management with relationship tiers and follow-up tracking
- Direct messaging and group chat with encryption
- WebRTC voice/video calling

**Health & Wellness**
- Apple HealthKit integration (steps, heart rate, sleep, workouts)
- AI health coach with personalized recommendations
- Daily check-ins (mood, energy, stress, sleep, exercise)
- Meal planning with recipe assistant

**Contract & Finance**
- Contract scanning and AI-powered data extraction
- Renewal alerts and cancellation reminders
- Recurring payment detection from email
- Cancellation email generator

**Islamic Features**
- Prayer times with notifications
- Quran reader with bookmarks and reading progress
- Islamic holidays calendar

**Family**
- Family member profiles and shared tasks
- Family budget tracking and shopping lists
- Family assistant and shared calendar

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5.8, Vite 5 |
| UI | Tailwind CSS 3, shadcn/ui, Radix UI, Framer Motion |
| State | TanStack React Query, React Context |
| Backend | Supabase (Auth, Database, Realtime, Storage, Edge Functions) |
| AI | Google Gemini, OpenAI Realtime API (via Lovable AI Gateway) |
| Mobile | Capacitor 8 (iOS + Android) |
| PWA | Vite PWA Plugin with offline caching |
| Forms | React Hook Form + Zod validation |
| Charts | Recharts |

## Getting Started

### Prerequisites

- Node.js 18+ and npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

### Development

```sh
# Clone the repository
git clone https://github.com/proark1/darai.git
cd darai

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app runs at `http://localhost:8080`.

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run build:dev` | Development build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

Supabase Edge Functions require these secrets (set via Supabase Dashboard):

| Secret | Used By |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-to-server functions |
| `LOVABLE_API_KEY` | AI Gateway (Gemini, OpenAI) |
| `OPENAI_API_KEY` | OpenAI Realtime, TTS, STT |
| `GOOGLE_CLIENT_ID` | Calendar/Gmail OAuth |
| `GOOGLE_CLIENT_SECRET` | Calendar/Gmail OAuth |
| `PERPLEXITY_API_KEY` | Web search |
| `GEMINI_API_KEY` | Gemini Live |
| `APP_URL` | CORS origin restriction |
| `MEETINGBOT_BASE_URL` | Meeting copilot (no trailing slash) — see [proark1/MeetingBot](https://github.com/proark1/MeetingBot) |
| `MEETINGBOT_API_KEY` | Bearer token (`sk_live_…`) generated in MeetingBot's `/auth/keys` |
| `MEETINGBOT_WEBHOOK_SECRET` | HMAC-SHA256 secret used to verify inbound webhook deliveries |
| `PLAID_CLIENT_ID` | Financial OS — bank linking + transaction sync |
| `PLAID_SECRET` | Plaid secret matching `PLAID_ENV` (sandbox/development/production) |
| `PLAID_ENV` | `sandbox` (default), `development`, or `production` |
| `BANK_TOKEN_SECRET` | 64-hex-char (32-byte) AES-GCM key for encrypting bank `access_token`s at rest. Generate with `openssl rand -hex 32` |

### Optional native plugins

| Package | Used by |
|---------|---------|
| `@capacitor/camera` | Vision capture — installs the native iOS / Android camera flow. Without it, the web file-input fallback (`<input type="file" capture="environment">`) is used. Add with `bun add @capacitor/camera && npx cap sync`. |

## Architecture

### Project Structure

```
src/
  pages/           # 11 page components (Index, Dashboard, Auth, etc.)
  components/      # 45 feature directories (tasks, chat, calendar, etc.)
    ui/            # 40+ shadcn/Radix UI primitives
  hooks/           # 135 custom React hooks
  contexts/        # Auth and Language providers
  lib/             # Utilities (encryption, parsing, payload building)
  integrations/    # Supabase client and generated types

supabase/
  functions/       # 36 Deno Edge Functions
  migrations/      # Database schema migrations
  config.toml      # Function configuration and JWT settings
```

### Routes

| Route | Access | Page |
|-------|--------|------|
| `/` | Protected | Main app (tasks, chat, panels) |
| `/dashboard` | Protected | Analytics and insights |
| `/contacts` | Protected | Contact management |
| `/contracts` | Protected | Contract tracking |
| `/landing` | Public | Landing page |
| `/auth` | Public | Login / Signup |
| `/forgot-password` | Public | Password reset request |
| `/reset-password` | Any | Set new password |
| `/auth/calendar-callback` | Protected | OAuth callback |
| `/onboarding` | Protected | New user onboarding |

### Edge Functions (36)

**AI & Chat**
- `chat` — Main AI chat with user context, tasks, contacts, and memory
- `chat-ai` — Smart replies, translation, conversation summaries
- `ai-assistant` — Task suggestions, scheduling, daily planning
- `gemini-live` — Real-time voice assistant with task commands
- `openai-realtime-session` — OpenAI Realtime API session creation
- `family-assistant` — Family-focused AI (homework help, meal planning)
- `recipe-assistant` — AI recipe search and generation
- `weekly-review` — AI-generated weekly productivity review
- `weekly-coach` — Personalized weekly coaching insights
- `morning-briefing` — Personalized news and morning content

**Voice**
- `text-to-speech` — TTS audio generation
- `voice-to-text` — Speech transcription
- `daily-voice-briefing` — Cross-module daily summary

**Email**
- `gmail-sync` — Sync inbox with AI categorization and threat detection
- `gmail-fetch-email` — Fetch individual email content
- `gmail-send-reply` — Send email replies via Gmail API
- `email-draft-reply` — AI-drafted email replies

**Calendar**
- `calendar-oauth-start` — Initiate Google OAuth with HMAC-signed state
- `calendar-oauth-callback` — Handle OAuth callback with HMAC verification
- `calendar-sync` — Sync Google Calendar events
- `import-calendar` — Import ICS calendar files

**Contracts**
- `scan-contract` — AI extraction of contract details from documents
- `extract-contract-from-email` — Detect contracts in emails
- `detect-recurring-payments` — Find recurring payments in email history
- `generate-cancellation-email` — AI-generated cancellation letters

**Analytics**
- `analyze-patterns` — User behavior pattern analysis
- `contact-insights` — AI-powered contact relationship insights
- `health-insights` — Health metrics analysis and recommendations
- `health-coach` — Personalized health coaching
- `life-correlator` — Cross-domain life data correlation
- `auto-pilot` — Automated task rescheduling and follow-ups
- `proactive-assistant` — Proactive reminder generation

**Notifications**
- `send-push-notification` — Push notification delivery (service key auth)
- `push-delivery` — Expo push notification transport (service key auth)
- `call-push-notification` — Incoming call push notifications

**Search**
- `web-search` — Perplexity-powered web search

### Security

All 36 edge functions are authenticated:
- **33 user-facing functions**: JWT verification at Supabase gateway + in-code `getUser()` validation
- **3 server-to-server functions**: Service role key validation (`proactive-assistant`, `push-delivery`, `send-push-notification`)
- **OAuth**: HMAC-SHA256 signed state parameter with 10-minute expiry
- **CORS**: Restricted to `APP_URL` origin (wildcard fallback for development)
- **Headers**: `X-Content-Type-Options: nosniff` on all responses
- **Encryption**: End-to-end encryption for messages using Web Crypto API with CryptoKey stored directly in IndexedDB
- **Input validation**: Email format validation, path traversal prevention, XSS protection via DOMPurify

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

Built with Capacitor for native iOS and Android deployment.

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

## License

Private project.
