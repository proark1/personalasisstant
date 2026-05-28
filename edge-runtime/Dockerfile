# Self-hosted Supabase Edge Runtime for Railway.
#
# Runs every function under ../supabase/functions through the same
# Deno-based runtime that Supabase's hosted Edge Functions use.
# Routing is handled by supabase/functions/main/index.ts.
#
# Bumping the tag: check https://hub.docker.com/r/supabase/edge-runtime/tags
# for the current version. Older versions may pin a Deno that doesn't
# support newer std imports.
FROM supabase/edge-runtime:v1.67.0

# All function code lives under /home/deno/functions inside the
# runtime. The "main" function (servicePath at startup) is the
# dispatcher; user functions are spawned per-request from sibling
# directories.
COPY supabase/functions /home/deno/functions

# Railway injects $PORT at runtime. The edge-runtime CLI takes the port
# via -p, not an env var, so we wrap CMD in a shell to interpolate it.
# Default to 9000 for local docker-run sanity.
EXPOSE 9000
ENTRYPOINT []
CMD ["sh", "-c", "exec edge-runtime start --main-service /home/deno/functions/main -p ${PORT:-9000}"]
