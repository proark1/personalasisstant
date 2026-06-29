// "Main service" for the self-hosted Supabase Edge Runtime container.
//
// Supabase's edge-runtime image runs one entry function that decides
// which user function to spawn for each request. This file is that
// entry. It maps the first path segment to a function directory and
// delegates via the `EdgeRuntime.userWorkers.create()` API.
//
// The runtime is mounted at `/home/deno/functions` inside the Docker
// container (see edge-runtime/Dockerfile). A request to
// `/chat` → spawns the worker for `/home/deno/functions/chat`.
//
// In production the Caddy gateway strips `/functions/v1` so the
// runtime never sees that prefix.

import { authorizeFunctionRequest } from "./function-auth.ts";

// The `EdgeRuntime` global is provided by supabase/edge-runtime.
// Declare its shape so TypeScript (and `deno check`) don't complain.
declare const EdgeRuntime: {
  userWorkers: {
    create(opts: {
      servicePath: string;
      memoryLimitMb?: number;
      workerTimeoutMs?: number;
      noModuleCache?: boolean;
      importMapPath?: string | null;
      envVars?: Array<[string, string]>;
      forceCreate?: boolean;
      netAccessDisabled?: boolean;
    }): Promise<{ fetch: (req: Request) => Promise<Response> }>;
  };
};

const FUNCTIONS_DIR = "/home/deno/functions";
const MEMORY_LIMIT_MB = 256;
// Per-worker wall-clock limit. The AI pipeline (chat → web search + LLM +
// tools, then the streamed reply) regularly needs more than a minute end to
// end; at 60s the supervisor killed the isolate mid-request, surfacing as a
// 500 to the Telegram webhook (and silently dropped replies under polling).
// Override with EDGE_WORKER_TIMEOUT_MS if needed.
const TIMEOUT_MS = Number(Deno.env.get("EDGE_WORKER_TIMEOUT_MS")) || 150_000;
// Max time a first attempt may take and still be eligible for a fresh-isolate
// retry. Stale/dead-worker failures return near-instantly (tens of ms); a
// longer failure means the handler actually ran (timeout/OOM) and must NOT be
// retried, to avoid duplicating side effects.
const STALE_RETRY_MAX_MS = Number(Deno.env.get("EDGE_STALE_RETRY_MAX_MS")) || 3_000;

// Spawn (or reuse) the worker for a function. We deliberately do NOT cache the
// worker handle ourselves: the runtime already reuses a live isolate when one
// exists (forceCreate:false). A handle held past the isolate's wall-clock
// lifetime goes stale, and reusing it throws "Function unavailable" forever —
// which is exactly what broke the infrequently-called cron functions. `force`
// requests a brand-new isolate, used to recover from a stale/dead one.
function spawnWorker(servicePath: string, force = false) {
  return EdgeRuntime.userWorkers.create({
    servicePath,
    memoryLimitMb: MEMORY_LIMIT_MB,
    workerTimeoutMs: TIMEOUT_MS,
    noModuleCache: false,
    importMapPath: null,
    // Pass the host process env into the worker isolate. Without this the
    // worker starts with no environment at all, so Deno.env.get('APP_URL')
    // (and every other key the functions read — SUPABASE_URL, GEMINI_API_KEY,
    // service-role JWT, etc.) returns undefined. strictAppOrigin() then throws
    // "CORS misconfigured: set APP_URL" at module load and the worker dies.
    envVars: Object.entries(Deno.env.toObject()),
    forceCreate: force,
    netAccessDisabled: false,
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Health check for Railway's liveness probe.
  if (url.pathname === "/" || url.pathname === "/healthz") {
    return new Response("ok", { status: 200 });
  }

  // First path segment is the function name.
  const segments = url.pathname.split("/").filter(Boolean);
  const fnName = segments[0];
  if (!fnName) return json({ error: "missing function name" }, 400);

  // Disallow anything that could escape the functions directory.
  // The runtime would reject it too, but a fast 400 is friendlier.
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(fnName)) {
    return json({ error: "invalid function name" }, 400);
  }
  if (fnName === "main" || fnName === "_shared") {
    return json({ error: "function not callable" }, 404);
  }

  const authFailure = authorizeFunctionRequest(req, fnName);
  if (authFailure) return authFailure;

  const servicePath = `${FUNCTIONS_DIR}/${fnName}`;
  // Keep a clone so we can retry once on a fresh isolate if the first attempt
  // hits a reclaimed/stale worker. The clone's body is cancelled on every path
  // where it isn't used, so a large payload (e.g. base64 image) isn't pinned in
  // memory by the unread tee branch.
  const retryReq = req.clone();
  const dropRetryBody = () => {
    try {
      retryReq.body?.cancel();
    } catch {
      /* already consumed */
    }
  };
  const startedAt = Date.now();
  try {
    try {
      const worker = await spawnWorker(servicePath);
      const res = await worker.fetch(req);
      dropRetryBody();
      return res;
    } catch (staleErr) {
      // Only retry when the failure looks like a dead/stale cached isolate that
      // never ran the handler — those return near-instantly. Do NOT retry if:
      //  (a) the failure was slow (the handler ran, then hit a wall-clock/OOM
      //      limit), or
      //  (b) the error explicitly signals a timeout/OOM (covers a rare fast OOM
      //      on a huge allocation).
      // Retrying a request whose handler already ran would redo non-idempotent
      // work — double briefing sends, double tool actions, double charges.
      const elapsed = Date.now() - startedAt;
      const errMsg = staleErr instanceof Error ? staleErr.message : String(staleErr);
      const ranAndFailed =
        elapsed > STALE_RETRY_MAX_MS || /timed?\s*out|timeout|wall.?clock|memory|oom/i.test(errMsg);
      if (ranAndFailed) {
        dropRetryBody();
        throw staleErr;
      }
      console.warn(
        `[main] ${fnName} worker failed in ${elapsed}ms, forcing fresh isolate:`,
        errMsg,
      );
      const fresh = await spawnWorker(servicePath, true);
      return await fresh.fetch(retryReq);
    }
  } catch (e) {
    dropRetryBody();
    // Most common reason: the function directory doesn't exist (typo)
    // or the function failed to start (missing env var at module load,
    // syntax error, etc.). Log full detail and return generic message.
    const errorId = crypto.randomUUID();
    console.error(`[${errorId}] worker error for ${fnName}:`, e);
    const msg = e instanceof Error ? e.message : String(e);
    // Module-load failures from missing env vars (e.g. our own
    // strictAppOrigin() throw) are the single most common deploy
    // mistake. Surface a hint.
    const isStartupError = /APP_URL|environment|Deno\.env/.test(msg);
    return json(
      {
        error: isStartupError
          ? `Function '${fnName}' failed to start. Likely a missing env var on the edge-runtime service. request_id: ${errorId}`
          : `Function '${fnName}' is unavailable. request_id: ${errorId}`,
      },
      isStartupError ? 503 : 500,
    );
  }
});
