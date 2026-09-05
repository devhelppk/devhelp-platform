import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DashboardPage from "./page";

describe("DashboardPage", () => {
  it("renders the heading", () => {
    render(<DashboardPage />);
    expect(
      screen.getByRole("heading", { name: /your courses/i }),
    ).toBeInTheDocument();
  });
});
