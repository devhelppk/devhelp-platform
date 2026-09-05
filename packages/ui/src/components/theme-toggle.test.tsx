import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

beforeAll(() => {
  // next-themes reads the OS preference; jsdom has no matchMedia.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe("ThemeToggle", () => {
  it("cycles light, dark and system and updates the html class", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const button = await screen.findByRole("button", {
      name: "Switch to dark theme",
    });
    expect(button).toHaveAttribute("data-theme", "light");

    await user.click(button);
    expect(
      await screen.findByRole("button", { name: "Switch to system theme" }),
    ).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveClass("dark");

    await user.click(screen.getByRole("button"));
    expect(
      await screen.findByRole("button", { name: "Switch to light theme" }),
    ).toHaveAttribute("data-theme", "system");
  });
});
