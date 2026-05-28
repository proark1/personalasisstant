import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// One-shot: wipe an old VitePWA service worker + its precache the
// first time a user lands on this bundle. After the realtime-channel
// fixes in #6/#7 we saw users stuck on the pre-fix Index chunk because
// the old SW (registered without skipWaiting) kept serving its
// precached assets. This unregisters every SW under our origin,
// purges Workbox/runtime caches, and forces one reload so the next
// page load runs entirely against the freshly-deployed bundle. Gated
// behind `darai.sw_killswitch_v1` so it only runs once per browser.
// Reentry-safe: the flag is set before the reload so we can't loop.
//
// Returns true if a reload is in flight — caller should skip
// rendering React in that case to avoid flashing a broken state.
const KILLSWITCH_FLAG = "darai.sw_killswitch_v1";
function runSwKillswitchOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(KILLSWITCH_FLAG)) return false;
  } catch {
    return false;
  }
  const hasSw = "serviceWorker" in navigator;
  const hasCaches = "caches" in window;
  if (!hasSw && !hasCaches) {
    try { window.localStorage.setItem(KILLSWITCH_FLAG, "1"); } catch { /* ignore */ }
    return false;
  }
  // Persist the flag *and confirm it stuck* before we trigger the
  // reload. If setItem silently fails (quota, private-mode quirks)
  // and we reload anyway, the flag wouldn't be set on the next load
  // and the killswitch would fire again — infinite loop. Better to
  // skip the wipe entirely than to brick the app.
  try {
    window.localStorage.setItem(KILLSWITCH_FLAG, "1");
    if (window.localStorage.getItem(KILLSWITCH_FLAG) !== "1") return false;
  } catch {
    return false;
  }
  void (async () => {
    try {
      if (hasSw) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (hasCaches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // best-effort
    } finally {
      window.location.reload();
    }
  })();
  return true;
}
const killSwitchReloading = runSwKillswitchOnce();

function mountFatalOverlay(title: string, detail?: string) {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;

  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:hsl(var(--background));color:hsl(var(--foreground));font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:720px;width:100%;border:1px solid hsl(var(--border));border-radius:12px;padding:16px;background:hsl(var(--card));">
        <h1 style="margin:0 0 8px 0;font-size:18px;line-height:1.25;">${title}</h1>
        <p style="margin:0;color:hsl(var(--muted-foreground));font-size:13px;">The app failed to start. Please reload.</p>
        ${detail ? `<pre style="margin-top:12px;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.4;background:hsl(var(--muted));padding:12px;border-radius:10px;border:1px solid hsl(var(--border));color:hsl(var(--foreground));">${detail}</pre>` : ""}
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <button id="fatal-reload" style="padding:10px 12px;border-radius:10px;border:1px solid hsl(var(--border));background:hsl(var(--primary));color:hsl(var(--primary-foreground));font-weight:600;cursor:pointer;">Reload</button>
        </div>
      </div>
    </div>
  `;

  const btn = document.getElementById("fatal-reload");
  btn?.addEventListener("click", () => window.location.reload());
}

// Catch failures that happen before React can render the ErrorBoundary.
window.addEventListener("error", (e) => {
  const msg = e.error instanceof Error ? `${e.error.name}: ${e.error.message}` : String(e.message);
  mountFatalOverlay("DarAI couldn’t start", msg);
});
window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  const reason = e.reason instanceof Error ? `${e.reason.name}: ${e.reason.message}` : String(e.reason);
  mountFatalOverlay("DarAI couldn’t start", reason);
});

if (!killSwitchReloading) {
  try {
    createRoot(document.getElementById("root")!).render(<App />);
  } catch (e) {
    const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    mountFatalOverlay("DarAI couldn’t start", err);
  }
}
