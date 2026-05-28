# Self-hosted Supabase Edge Functions runtime, deployed as a Railway
# service.
#
# Uses the official supabase/edge-runtime image (the same Deno-based
# isolate manager that Supabase uses to run hosted Edge Functions),
# so the 100+ existing functions under supabase/functions/ run
# unchanged — same Deno APIs, same _shared imports, same env shape.
#
# The boot script at main/index.ts routes /<name>/* requests to a
# fresh isolate that loads supabase/functions/<name>/index.ts. The
# gateway routes /functions/v1/* here; the runtime sees the path
# without the /functions/v1 prefix because Caddy's handle_path strips
# it.
FROM supabase/edge-runtime:v1.67.4

WORKDIR /home/deno

# Copy the existing supabase functions tree (same layout the supabase
# CLI uses locally) plus the boot script.
COPY supabase/functions/ /home/deno/functions/
COPY edge-functions/main/ /home/deno/functions/main/

# supabase/edge-runtime expects to be told which boot script to run.
# All requests land there first and we dispatch to per-function workers.
CMD ["start", "--main-service", "/home/deno/functions/main", "-p", "9000"]
