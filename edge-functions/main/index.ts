// Boot script for the self-hosted edge-runtime.
//
// supabase/edge-runtime always starts a single "main" Deno isolate
// which receives every HTTP request. We read the first path segment as
// the function name and ask EdgeRuntime.userWorkers to spawn (or
// reuse) an isolate for that function — exactly how Supabase's
// hosted Edge Functions stack does it. Each function under
// /home/deno/functions/<name>/index.ts runs inside its own short-lived
// worker, with the standard env propagated in.
//
// Caddy strips /functions/v1 before reaching us via handle_path, so
// here we expect paths like `/chat`, `/gmail-sync`, …

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: any;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const [, name] = url.pathname.split("/");

  if (!name) {
    return new Response(
      JSON.stringify({ ok: true, runtime: "supabase/edge-runtime" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  const servicePath = `/home/deno/functions/${name}`;

  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      // 256 MB matches Supabase's default; raise for heavy AI calls if needed.
      memoryLimitMb: 256,
      // 150 s — generous because some functions stream LLM output.
      workerTimeoutMs: 150_000,
      noModuleCache: false,
      importMapPath: null,
      envVars: Object.entries(Deno.env.toObject()),
    });
    return await worker.fetch(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // ENOENT-style errors mean the function name doesn't exist.
    const status = msg.includes("No such file") || msg.includes("not found")
      ? 404
      : 500;
    return new Response(
      JSON.stringify({ error: msg, function: name }),
      { status, headers: { "content-type": "application/json" } },
    );
  }
});
