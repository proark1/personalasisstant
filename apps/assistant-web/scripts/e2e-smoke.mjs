#!/usr/bin/env node
/**
 * HTTP-level E2E smoke test for the assistant web app.
 *
 * Browser-fleet-free: drives the built app over HTTP and asserts the auth gate,
 * the login BFF (httpOnly cookie), the same-origin proxy, and the authenticated
 * page renders. Runs against already-running servers so CI can start them as
 * background steps.
 *
 * Prereqs (stub identity mode is enough — no OneBrain needed):
 *   1. Assistant API:  AUTH_IDENTITY_MODE=stub ONEBRAIN_CLIENT_MODE=memory \
 *                      python -m uvicorn assistant_runtime.api.app:create_app --factory --port 8000
 *   2. Web (built):    npm run build:web && \
 *                      ASSISTANT_API_URL=http://127.0.0.1:8000 PORT=3000 \
 *                      npm --workspace apps/assistant-web run start
 *   3. Smoke:          E2E_WEB_URL=http://127.0.0.1:3000 npm run e2e:smoke
 */

const WEB = (process.env.E2E_WEB_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

let failures = 0;
function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  — ${detail}`}`);
}

function cookieFromResponse(response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) return "";
  const match = raw.match(/assistant_session=([^;]*)/);
  return match ? `assistant_session=${match[1]}` : "";
}

async function main() {
  // 1. The gate redirects unauthenticated app routes to /login.
  for (const path of ["/", "/settings", "/assistant", "/inbox"]) {
    const res = await fetch(`${WEB}${path}`, { redirect: "manual" });
    check(`gate: ${path} unauthenticated -> redirect`, res.status === 307);
    const loc = res.headers.get("location") ?? "";
    check(`gate: ${path} -> /login`, loc.includes("/login"), loc);
  }

  // 2. /login is reachable without a session.
  check("public: /login is 200", (await fetch(`${WEB}/login`)).status === 200);

  // 3. Login BFF mints a session in an httpOnly cookie.
  const loginRes = await fetch(`${WEB}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
    redirect: "manual"
  });
  check("login: BFF returns 200", loginRes.status === 200);
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  check("login: session cookie is HttpOnly", /HttpOnly/i.test(setCookie), setCookie.slice(0, 40));
  const cookie = cookieFromResponse(loginRes);
  check("login: session cookie present", cookie.length > 0);

  // 4. The same-origin proxy authorizes with the cookie, refuses without.
  const proxied = await fetch(`${WEB}/api/assistant/v1/today`, { headers: { cookie } });
  check("proxy: /v1/today with cookie -> 200", proxied.status === 200);
  const noCookie = await fetch(`${WEB}/api/assistant/v1/today`);
  check("proxy: /v1/today without cookie -> 401", noCookie.status === 401);
  const guarded = await fetch(`${WEB}/api/assistant/secrets/x`, { headers: { cookie } });
  check("proxy: non-v1 path -> 404", guarded.status === 404);

  // 5. Authenticated pages render.
  const pages = [
    ["/", "Today"],
    ["/settings", "Settings"],
    ["/assistant", "Assistant"]
  ];
  for (const [path, title] of pages) {
    const res = await fetch(`${WEB}${path}`, { headers: { cookie } });
    const html = await res.text();
    check(`render: ${path} is 200`, res.status === 200);
    check(`render: ${path} shows "${title}"`, html.includes(`page-title">${title}`));
  }

  // 6. Logout clears the session; the proxy then refuses the old cookie.
  const logoutRes = await fetch(`${WEB}/api/auth/logout`, { method: "POST", headers: { cookie } });
  check("logout: BFF returns 200", logoutRes.status === 200);
  const afterLogout = await fetch(`${WEB}/api/assistant/v1/today`, {
    headers: { cookie: cookieFromResponse(logoutRes) || cookie }
  });
  check("logout: revoked session -> 401", afterLogout.status === 401);

  console.log(failures === 0 ? "\nE2E smoke: all checks passed." : `\nE2E smoke: ${failures} failure(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("E2E smoke crashed:", error);
  process.exit(1);
});
