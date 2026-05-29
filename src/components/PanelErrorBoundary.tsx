import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { reportClientError } from "@/lib/telemetry";

type Props = {
  children: React.ReactNode;
  /** Human-friendly name of the panel, shown in the fallback copy. */
  panelName?: string;
};

type State = {
  hasError: boolean;
};

/**
 * Scoped error boundary for a single panel/route. Unlike the app-level
 * `ErrorBoundary` (which takes over the whole screen and offers reloads), this
 * renders a compact, in-place fallback with a "Try again" reset so one panel
 * crashing never blanks the entire app — the sidebar, header and other panels
 * stay usable. Pass `key={activePanel}` at the call site so navigating to a
 * different panel auto-recovers.
 */
export class PanelErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    void reportClientError(error, {
      kind: "react.panelErrorBoundary",
      panel: this.props.panelName,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h3 className="text-base font-semibold">
            {this.props.panelName ? `${this.props.panelName} hit a snag` : "This panel hit a snag"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Something went wrong rendering this view. The rest of the app is still working.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={this.handleRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }
}
