import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { FormSelect } from "@/components/form-select";

/**
 * The point of these: `FormSelect` replaced native `<select>` elements that were
 * submitted with `FormData`, so what the form posts has to stay identical. Radix
 * refuses `""` as an item value, which is exactly what an optional field needs to
 * post when nobody answered, so the empty choice round-trips through a sentinel.
 */
// Radix's select reaches for pointer-capture and scroll APIs that jsdom does not
// implement; without these stubs the listbox never opens and the failure looks
// like a missing option rather than a missing DOM method.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const hidden = (name: string) =>
  document.querySelector<HTMLInputElement>(
    `input[type="hidden"][name="${name}"]`,
  );

const roles = [
  ["backend", "Backend engineer"],
  ["frontend", "Frontend engineer"],
] as const;

describe("FormSelect", () => {
  it("posts the default value before anyone touches it", () => {
    render(
      <FormSelect
        name="role"
        options={roles}
        defaultValue="backend"
        required
      />,
    );
    expect(hidden("role")?.value).toBe("backend");
  });

  it("posts an empty string for an unanswered optional field", () => {
    render(<FormSelect name="role" options={roles} emptyLabel="Unknown" />);
    // Not the sentinel Radix needs internally: the form must see "".
    expect(hidden("role")?.value).toBe("");
    expect(screen.getByRole("combobox")).toHaveTextContent("Unknown");
  });

  it("posts the chosen value, and posts empty again when cleared", async () => {
    const user = userEvent.setup();
    render(<FormSelect name="role" options={roles} emptyLabel="Unknown" />);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Frontend engineer" }));
    expect(hidden("role")?.value).toBe("frontend");

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Unknown" }));
    expect(hidden("role")?.value).toBe("");
  });

  it("offers no empty choice on a required field", async () => {
    const user = userEvent.setup();
    render(
      <FormSelect
        name="role"
        options={roles}
        required
        defaultValue="backend"
      />,
    );
    await user.click(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option")).toHaveLength(roles.length);
  });
});
