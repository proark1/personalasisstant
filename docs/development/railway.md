# Railway Phase 0 Deployment

Railway is a deployment target, not a product dependency. The same Dockerfiles
used by Railway can run through Docker Compose, on a VM, or in Kubernetes later.

Services:

- `assistant-web`: Next.js app from `apps/assistant-web/Dockerfile`.
- `assistant-api`: FastAPI entrypoint from `services/assistant-runtime/Dockerfile`.
- `assistant-worker`: Python worker entrypoint from the same backend image.
- `postgres`: Railway Postgres plugin or an external Postgres URL.
- `redis`: Railway Redis plugin or an external Redis URL.

Required variables:

- `DATABASE_URL`
- `REDIS_URL`
- `ONEBRAIN_API_URL`
- `SECRET_MASTER_KEY`
- `NEXT_PUBLIC_ASSISTANT_API_URL`

## Config Files

`railway.json` at the repository root is the default deploy profile for
`assistant-web`, because Railway auto-detects that filename from the service
root.

The files in `railway/` are service templates:

- `railway/assistant-web.railway.json`
- `railway/assistant-api.railway.json`
- `railway/assistant-worker.railway.json`

For API and worker services, either configure the same Dockerfile path and start
command in Railway's service settings, or copy the matching template to
`railway.json` before deploying that service.

Start commands:

- Web: `npm --workspace apps/assistant-web run start`
- API: `assistant-api`
- Worker: `assistant-worker`

Both the web and API processes honor Railway's injected `PORT` environment
variable.

Readiness:

- Web: `/api/health`
- API: `/health/ready`
- Worker: `python -m assistant_runtime.worker.healthcheck`
