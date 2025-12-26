import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (e) {
  const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  mountFatalOverlay("DarAI couldn’t start", err);
}
