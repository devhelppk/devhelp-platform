import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("renders the wordmark", () => {
    render(<BrandLogo />);
    expect(screen.getByText("devhelp")).toBeInTheDocument();
    expect(screen.getByText(".pk")).toBeInTheDocument();
  });

  it("appends a product name when given one", () => {
    render(<BrandLogo product="Learn" />);
    expect(screen.getByText("Learn")).toBeInTheDocument();
  });
});
