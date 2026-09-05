import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarNav, SidebarNavGroup, SidebarNavItem } from "./sidebar-nav";

describe("SidebarNav", () => {
  it("labels groups and marks the active item as the current page", () => {
    render(
      <SidebarNav aria-label="Pages">
        <SidebarNavGroup title="Getting started">
          <SidebarNavItem href="/intro">Introduction</SidebarNavItem>
          <SidebarNavItem href="/setup" active>
            Set up your machine
          </SidebarNavItem>
        </SidebarNavGroup>
      </SidebarNav>,
    );
    expect(
      screen.getByRole("group", { name: "Getting started" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Set up your machine" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Introduction" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("renders a custom link element with asChild", () => {
    render(
      <SidebarNav>
        <SidebarNavGroup title="More">
          <SidebarNavItem asChild active>
            <a href="/faq" data-testid="custom">
              FAQ
            </a>
          </SidebarNavItem>
        </SidebarNavGroup>
      </SidebarNav>,
    );
    const link = screen.getByRole("link", { name: "FAQ" });
    expect(link).toHaveAttribute("data-testid", "custom");
    expect(link).toHaveAttribute("aria-current", "page");
  });
});
