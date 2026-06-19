// Mints Supabase-compatible API keys (anon + service_role JWTs) from your
// shared JWT secret. These go in PostgREST/GoTrue/the app.
//
//   node db/migration/mint-jwt.mjs "<JWT_SECRET>"
//
// The "anon" key is what the SPA sends as its apikey (VITE_SUPABASE_PUBLISHABLE_KEY).
// The "service_role" key bypasses RLS — keep it server-side only (never in the SPA).
import crypto from "node:crypto";

const secret = process.argv[2];
if (!secret) {
  console.error('usage: node db/migration/mint-jwt.mjs "<JWT_SECRET>"');
  process.exit(1);
}

const b64url = (o) =>
  Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

function sign(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const data = `${b64url(header)}.${b64url(payload)}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 10; // 10 years

for (const role of ["anon", "service_role"]) {
  console.log(`\n${role}:\n${sign({ role, iss: "supabase", iat, exp })}`);
}
console.log("");
