import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Enroll</Button>);
    expect(screen.getByRole("button", { name: "Enroll" })).toBeInTheDocument();
  });

  it("renders as a child element with asChild", () => {
    render(
      <Button asChild>
        <a href="/courses">Courses</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute(
      "href",
      "/courses",
    );
  });
});
