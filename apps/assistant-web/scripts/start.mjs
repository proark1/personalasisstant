import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";
const command = process.platform === "win32" ? "next.cmd" : "next";
const child = spawn(command, ["start", "--hostname", "0.0.0.0", "--port", port], {
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
