import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMark } from "./brand-mark";

describe("BrandMark", () => {
  it("renders a decorative svg at the requested size", () => {
    const { container } = render(<BrandMark size={40} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "40");
    expect(svg).toHaveAttribute("height", "40");
  });
});
