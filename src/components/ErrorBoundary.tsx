import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

function describeError(error: unknown) {
  if (!error) return "Unknown error";
  if (error instanceof Error) {
    const head = `${error.name}: ${error.message}`;
    if (!error.stack) return head;
    // V8 (Chrome/Edge) prefixes the stack with `Name: message`; Firefox/Safari don't.
    return error.stack.startsWith(error.name) ? error.stack : `${head}\n\n${error.stack}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // Keep console noise minimal but preserve a real signal for iOS/Safari debugging.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Uncaught error", error);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHardReload = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("t", String(Date.now()));
    window.location.replace(url.toString());
  };

  private handleResetCacheAndReload = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } finally {
      this.handleHardReload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const errorText = describeError(this.state.error);

    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-6 text-center">
          <h1 className="text-balance text-xl font-semibold">
            {this.props.fallbackTitle ?? "Something went wrong"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The app hit an unexpected error and couldn’t render this screen.
          </p>

          <pre className="mt-4 max-h-72 w-full overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-3 text-left text-xs text-muted-foreground">
            {errorText}
          </pre>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={this.handleReload}>Reload</Button>
            <Button variant="secondary" onClick={this.handleHardReload}>
              Hard reload
            </Button>
            <Button variant="outline" onClick={this.handleResetCacheAndReload}>
              Reset cache & reload
            </Button>
          </div>
        </section>
      </main>
    );
  }
}

