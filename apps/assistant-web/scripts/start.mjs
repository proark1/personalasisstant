import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.PORT ?? "3000";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const standaloneRoot = path.join(
  appRoot,
  ".next",
  "standalone",
  "apps",
  "assistant-web"
);
const standaloneServer = path.join(standaloneRoot, "server.js");

if (!existsSync(standaloneServer)) {
  console.error(
    "Standalone Next.js server not found. Run `npm --workspace apps/assistant-web run build` before starting production."
  );
  process.exit(1);
}

const staticSource = path.join(appRoot, ".next", "static");
const staticTarget = path.join(standaloneRoot, ".next", "static");
if (existsSync(staticSource) && !existsSync(staticTarget)) {
  mkdirSync(path.dirname(staticTarget), { recursive: true });
  cpSync(staticSource, staticTarget, { recursive: true });
}

const publicSource = path.join(appRoot, "public");
const publicTarget = path.join(standaloneRoot, "public");
if (existsSync(publicSource) && !existsSync(publicTarget)) {
  cpSync(publicSource, publicTarget, { recursive: true });
}

const child = spawn(process.execPath, [standaloneServer], {
  env: {
    ...process.env,
    HOSTNAME: "0.0.0.0",
    PORT: port
  },
  stdio: "inherit",
  shell: false
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
