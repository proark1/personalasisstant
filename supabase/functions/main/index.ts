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
const TIMEOUT_MS = 60_000;

// Pre-built worker cache keyed by service path. The runtime itself
// caches workers but having an explicit map lets us short-circuit
// pathological re-imports under load.
const workers = new Map<string, { fetch: (req: Request) => Promise<Response> }>();

async function getWorker(servicePath: string) {
  let w = workers.get(servicePath);
  if (w) return w;
  w = await EdgeRuntime.userWorkers.create({
    servicePath,
    memoryLimitMb: MEMORY_LIMIT_MB,
    workerTimeoutMs: TIMEOUT_MS,
    noModuleCache: false,
    importMapPath: null,
    envVars: [],
    forceCreate: false,
    netAccessDisabled: false,
  });
  workers.set(servicePath, w);
  return w;
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

  const servicePath = `${FUNCTIONS_DIR}/${fnName}`;
  try {
    const worker = await getWorker(servicePath);
    return await worker.fetch(req);
  } catch (e) {
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
