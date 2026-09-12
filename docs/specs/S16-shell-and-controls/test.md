# S16 — what was built and tested

Decisions taken as recommended in `plan.md`: **D1** Radix build, **D2** signed-in tools only, **D4** budget as guidance. **D3 is deferred** — see "Not done" below.

## Part A — the signed-in shell

`ToolsShell` (`SidebarProvider` + `Sidebar collapsible="icon"` + `SidebarInset`) now wraps: `/account`, `/notifications`, `/certificates`, `/studio`, `/moderate`, `/mentor/apply`, `/admin/badges`, `/admin/certificates`, `/admin/companies`. Public pages and the lesson reader are untouched.

Nav groups are built on the server from the role `auth` reports — Learning always, Contributing as either studio/moderation (mentor, admin) or "Become a mentor" (everyone else), Admin only for admins, then You. Icons are passed by **name** and resolved in the client component, because a `LucideIcon` is a function and cannot cross the server boundary as a prop.

### Verified in the browser

- **1440×900, dark, learner account.** Groups render as expected: Learning, Contributing ("Become a mentor", correct for a learner), You, with Account marked current. No Admin group, which is the point — the role is read on the server, so a stale client role cannot advertise `/admin` to someone who cannot open it.
- **Collapse via `SidebarTrigger`** → icon rail, and **`ctrl+B`** expands it again. Both confirmed by screenshot.
- Cookie persistence is wired (`sidebar_state` read in the shell and passed as `defaultOpen`) so a collapsed rail survives a reload without a flash of the open state.

### Two real bugs found and fixed while looking

- **The rail reserved no width and the content rendered underneath it.** The registry source uses Tailwind v3's `w-[--sidebar-width]`; this repo is on Tailwind 4.3.3, where that form does not resolve as a variable. Converted to v4's `w-(--sidebar-width)` (6 usages). This is the kind of thing that is invisible in a diff and obvious in a screenshot.
- **The wordmark truncated to a single letter in the collapsed rail.** `BrandMark` now stands in for `BrandLogo` below the icon breakpoint, swapped in CSS off the group's data attribute so it costs no client state.

## Part B — no native selects left

Seven native `<select>` elements across six files are gone: `studio/fields.tsx`, `studio/credits.tsx`, `badges/admin-badges.tsx`, `moderation/item.tsx`, `companies/admin-company-form.tsx`, `companies/contribute-form.tsx` (two). The only remaining matches for `<select` in `apps/lms` are the comments explaining why not to use one.

**The plan was wrong about these.** It claimed all seven were controlled React state, which made the conversion sound trivial. Four of them (`fields`, `admin-badges`, `moderation/item`, `admin-company-form`, plus one in `contribute-form`) carry `name` and `defaultValue` and are submitted with `FormData`. Radix's select does support `name`, but it cannot carry `""` as an item value — and `""` is exactly what an optional field must post when nobody answered.

So `components/form-select.tsx` wraps it: the empty choice gets a sentinel for Radix and is written back through a hidden input, which is what the form actually posts. Controlled call sites (`credits`, the interview-rounds picker) use `Select` directly with no wrapper.

Covered by `test/form-select.test.tsx` — four tests, because this is the part that could silently change what a form submits:

- the default value is posted before anyone touches the control;
- an untouched optional field posts `""`, not the sentinel;
- choosing a value posts it, and choosing the empty label again posts `""`;
- a required field offers no empty choice at all.

Those tests needed jsdom stubs for `hasPointerCapture`, `setPointerCapture`, `releasePointerCapture` and `scrollIntoView`: Radix reaches for them, jsdom lacks them, and the failure presents as a missing option rather than a missing DOM method.

## Adding the component

`pnpm dlx shadcn@latest add sidebar` could not be driven to completion here. It ignores `--yes` for its "file already exists" prompts (our `button`, `separator`, `sheet`, `tooltip`, `input`, `skeleton` are all customised and must not be overwritten), and driving it through a pty made it spin in its own spinner — 64 MB of terminal escape codes and no file written. The component was taken from the registry payload the CLI itself installs (`https://ui.shadcn.com/r/styles/new-york/sidebar.json`) plus `use-mobile`, which is the same source by a different transport. It did manage to add the bogus `cn` dependency `AGENTS.md` warns about, which was removed.

Four deviations from that payload, each commented where it lives:

1. Imports point at this package's conventions (unified `radix-ui`, `@repo/ui/*`).
2. Tailwind v4 variable syntax, as above.
3. `SidebarSeparator` is a plain function rather than `forwardRef`: the forwardRef form's inferred type reaches into `@radix-ui/react-separator`'s `SeparatorProps`, which is not nameable across package boundaries (TS2883).
4. The menu skeleton's `Math.random()` widths became a fixed cycle — impure during render, and different between the server and client pass.

`use-mobile` is rewritten onto `useSyncExternalStore`; the registry version sets state synchronously inside an effect, which this repo's lint rejects and which also renders one frame with the wrong answer.

## Bundle, measured

Under D4 these are a record, not a gate.

```
/companies            230.4 KB gz
/companies/arbisoft   227.8 KB gz
(lesson routes)       230.9 KB gz
```

The shell routes are not in `check-bundle-budget.ts` — they are behind a session, so the script cannot reach them. Adding a signed-in measurement is a follow-up rather than a silent gap.

## Not done, and why

- **D3 is unresolved.** `AppShell` / `SidebarNav` / `MobileNav` still exist and the lesson reader still uses them, so the package now has two sidebar systems — exactly the rot the plan warned about. Porting the reader is a real piece of work (a module tree, progress ticks, its own mobile behaviour) and doing it at the end of a long session is how the reader gets broken. It needs its own pass, with the reader driven in the browser.
- **The converted selects were not opened in dark mode.** Every one of them sits behind a mentor or admin role or behind email verification, and the account available here is an unverified learner. This is the exact check the plan called for and it is still outstanding; the unit tests cover what the form posts, not what the popup looks like. The same conversion was verified visually on the company filters in S15, so the styling is not unknown — but these six files have not been seen.
- **No 390px pass on the shell.** Also outstanding, and the standing follow-up that mobile checks have only ever run at 500px still applies.
