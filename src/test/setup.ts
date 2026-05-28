import "@testing-library/jest-dom/vitest";
import { expect } from "vitest";
import { toHaveNoViolations } from "jest-axe";

// Register the jest-axe matcher so component tests can assert
// `expect(results).toHaveNoViolations()`.
expect.extend(toHaveNoViolations);
