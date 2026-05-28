import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { BrandedLoader } from "./branded-loader";
import { EmptyState } from "./empty-state";
import { Inbox } from "lucide-react";

describe("UI primitives — accessibility", () => {
  it("BrandedLoader has no axe violations and exposes a status role", async () => {
    const { container, getByRole } = render(<BrandedLoader message="Loading your day…" />);
    expect(getByRole("status")).toBeInTheDocument();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("EmptyState has no axe violations", async () => {
    const { container } = render(
      <EmptyState
        icon={Inbox}
        title="No tasks yet"
        description="Ask Dori or add one to get started."
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
