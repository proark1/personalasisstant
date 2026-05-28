# Edge Runtime (Railway)

Self-hosted Supabase Edge Functions, running on Railway via Supabase's
own open-source `edge-runtime` image. Lets every Deno function under
`../supabase/functions/` run unchanged, without rewriting any of them
to Node.

## Architecture

```
browser
  │
  ▼  https://<gateway>/functions/v1/<name>
gateway (Caddy)         ← handle_path strips /functions/v1
  │  reverse_proxy
  ▼  http://edge-runtime.railway.internal:9000/<name>
edge-runtime (this service)
  │  spawns per-request worker
  ▼  /home/deno/functions/<name>/index.ts
function code (your Deno files)
  │
  ▼  Deno.env.get('SUPABASE_URL') + supabase-js
gateway → postgrest / gotrue
```

The dispatcher (`supabase/functions/main/index.ts`) routes each request
by reading the first path segment. The Caddy gateway strips
`/functions/v1`, so a browser call to
`/functions/v1/chat` arrives at the dispatcher as `/chat` and spawns
the worker for `supabase/functions/chat/index.ts`.

## Deploy to Railway

1. Add a new service in your Railway project.
2. Source: this repo, build path **`/`** (repo root), Dockerfile path
   **`edge-runtime/Dockerfile`** (so the `COPY supabase/functions`
   instruction sees them).
3. Networking → enable **Private Networking** so the gateway can reach
   it as `edge-runtime.railway.internal:9000`.
4. Set the env vars below.
5. On the **gateway** service, add `EDGE_FUNCTIONS_URL` pointing at
   `http://edge-runtime.railway.internal:9000`.
6. Deploy.

## Required env vars

Set these on the `edge-runtime` service (not the gateway):

### Supabase (the runtime + supabase-js client inside functions)

| Var | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://<your-gateway>.up.railway.app` | The functions' supabase-js client uses this for /rest/v1, /auth/v1. |
| `SUPABASE_SERVICE_ROLE_KEY` | The JWT you minted in cutover Phase 2 | Server-side calls bypass RLS. |
| `SUPABASE_ANON_KEY` _or_ `SUPABASE_PUBLISHABLE_KEY` | The anon JWT | Used by `resolveUserId()` to verify user JWTs. |

### Security (set after PR #28)

| Var | Value | Notes |
|---|---|---|
| `APP_URL` | `https://<your-app>.up.railway.app` | Production frontend origin. CORS will throw at module load if unset. |
| `APP_URLS` _(optional)_ | comma-separated extras | For staging/preview origins. |
| `INTERNAL_AUTH_SECRET` | `openssl rand -hex 32` output | Enables the hardened service-role + x-telegram-user-id path. Without it, the legacy bypass remains with a warning log. |
| `APP_ENV` _(local only)_ | `development` | Whitelists localhost origins. Do NOT set in production. |

### Third-party integrations (set whichever features you use)

| Var | Used by |
|---|---|
| `GEMINI_API_KEY` | `chat`, `gemini-live`, embeddings, TTS |
| `OPENAI_API_KEY` | `openai-realtime-session`, TTS, STT |
| `TELEGRAM_API_KEY` | `telegram-*` family |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Calendar/Gmail OAuth |
| `PERPLEXITY_API_KEY` | `web-search` |
| `PLAID_CLIENT_ID` + `PLAID_SECRET` + `PLAID_ENV` | `plaid-*` |
| `BANK_TOKEN_SECRET` | AES-GCM key for Plaid tokens at rest. `openssl rand -hex 32`. |
| `MEETINGBOT_BASE_URL` + `MEETINGBOT_API_KEY` + `MEETINGBOT_WEBHOOK_SECRET` | Meeting copilot |

Set whatever you actually use. A function that needs a missing key
will fail at first request (or at module load if the var is read
at the top level — `Deno.env.get('FOO')!`).

## Local sanity test

```sh
# From repo root.
docker build -t darai-edge-runtime -f edge-runtime/Dockerfile .
docker run --rm -p 9000:9000 \
  -e APP_URL=http://localhost:8080 \
  -e SUPABASE_URL=http://host.docker.internal:8081 \
  -e SUPABASE_SERVICE_ROLE_KEY=test \
  darai-edge-runtime

# In another terminal:
curl http://localhost:9000/healthz   # → ok
curl -X POST http://localhost:9000/chat -H 'Content-Type: application/json' -d '{"messages":[]}'
# Will likely return 401 (no auth) — that proves the dispatcher → worker → function chain works.
```

## Adding a new function

Drop it under `supabase/functions/<name>/index.ts` and redeploy. The
dispatcher resolves names dynamically; no router edits needed.

## Bumping the runtime image

`FROM supabase/edge-runtime:v1.67.0` in the Dockerfile. Check
[Docker Hub tags](https://hub.docker.com/r/supabase/edge-runtime/tags)
for newer releases. Read the changelog before bumping — major versions
may change the `EdgeRuntime.userWorkers` API used in `main/index.ts`.
