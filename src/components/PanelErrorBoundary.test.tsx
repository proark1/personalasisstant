import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PanelErrorBoundary } from "./PanelErrorBoundary";

// Telemetry would otherwise try to persist the error; stub it out.
vi.mock("@/lib/telemetry", () => ({
  reportClientError: vi.fn(),
}));

function Boom(): JSX.Element {
  throw new Error("panel exploded");
}

describe("PanelErrorBoundary", () => {
  // React logs caught errors to console.error; silence it for clean output.
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("renders children when there is no error", () => {
    const { getByText } = render(
      <PanelErrorBoundary panelName="Tasks">
        <div>healthy panel</div>
      </PanelErrorBoundary>,
    );
    expect(getByText("healthy panel")).toBeInTheDocument();
  });

  it("shows a scoped fallback with the panel name when a child throws", () => {
    const { getByText, getByRole } = render(
      <PanelErrorBoundary panelName="Tasks">
        <Boom />
      </PanelErrorBoundary>,
    );
    expect(getByText("Tasks hit a snag")).toBeInTheDocument();
    expect(getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("reports the error to telemetry", async () => {
    const { reportClientError } = await import("@/lib/telemetry");
    render(
      <PanelErrorBoundary panelName="Health">
        <Boom />
      </PanelErrorBoundary>,
    );
    expect(reportClientError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ kind: "react.panelErrorBoundary", panel: "Health" }),
    );
  });

  it("recovers in place when 'Try again' is clicked and the child no longer throws", () => {
    let shouldThrow = true;
    function MaybeBoom() {
      if (shouldThrow) throw new Error("panel exploded");
      return <div>recovered panel</div>;
    }

    const { getByRole, getByText } = render(
      <PanelErrorBoundary panelName="Tasks">
        <MaybeBoom />
      </PanelErrorBoundary>,
    );

    expect(getByText("Tasks hit a snag")).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(getByRole("button", { name: /try again/i }));

    expect(getByText("recovered panel")).toBeInTheDocument();
  });
});
