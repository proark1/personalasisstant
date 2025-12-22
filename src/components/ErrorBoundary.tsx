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

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-6 text-center">
          <h1 className="text-balance text-xl font-semibold">
            {this.props.fallbackTitle ?? "Something went wrong"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The app hit an unexpected error and couldn’t render this screen.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={this.handleReload}>Reload</Button>
          </div>
        </section>
      </main>
    );
  }
}
