# S16. The signed-in shell, and controls that are actually shadcn

Status: **awaiting founder approval.**

Two halves that belong together: both are about using the design system's own components instead of hand-rolled approximations, and both change how `@repo/ui` grows from here.

Requirement ids refer to `docs/requirements.md`.

---

## Founder decisions needed

### D1. Base UI or Radix? The sidebar doc you linked is the Base UI build

`https://ui.shadcn.com/docs/components/base/sidebar` is shadcn's **Base UI** variant. `@repo/ui` currently depends on `radix-ui` (the unified package, `^1.6.7`) and every primitive in it — dialog, select, dropdown, tooltip, sheet, tabs, accordion, switch, checkbox — is Radix.

Taking the Base UI sidebar means shipping **two primitive libraries**: two focus-trap implementations, two portal strategies, two sets of keyboard conventions, and both in the bundle. They will also drift — a Base UI dialog and a Radix dialog do not behave identically, and the difference shows up in focus return and scroll locking, which is exactly the sort of thing nobody notices until a screen-reader user does.

|                                    |                                                                                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **a. Radix sidebar (recommended)** | `pnpm dlx shadcn@latest add sidebar` resolves to the Radix build, matching everything already in `@repo/ui`. One primitive library.                                                 |
| **b. Base UI sidebar**             | Matches the doc you linked. Adds `@base-ui-components/react` beside `radix-ui`. Defensible only as the first step of migrating the whole package to Base UI, which is its own spec. |

**Recommended: (a).** Same component, same API, same look; it simply sits on the primitives the package already uses. If you want Base UI as the direction, that is a good conversation, but it should be a deliberate migration rather than arriving through one component.

### D2. Which surfaces get the sidebar?

The platform has three kinds of page and they want different shells:

- **Signed-in tools** — `/account`, `/notifications`, `/badges`, `/certificates`, `/studio`, `/moderate`, `/mentor`, `/admin`. A persistent rail is a real improvement here: these are destinations people move between, and the current header hides them behind an avatar menu.
- **Public, indexable pages** — `/`, `/courses`, `/paths`, `/companies`, `/u/*`, `/contributors`, `/verify/*`, `/search`. A nav rail spends 16rem of horizontal space on navigation for a visitor who arrived from Google to read one page, on the same pages we just widened to `max-w-7xl` to make room for content (S15 part A2). It also puts an app chrome around what should read as a document.
- **The lesson reader** — `/courses/[course]/[lesson]` already has `AppShell` + `SidebarNav` + `MobileNav`, a sidebar of module headings. It does not need a second one.

**Recommended:** the sidebar is the shell for the signed-in tools only. Public pages keep `SiteHeader`. The lesson reader keeps its own.

### D3. What happens to `AppShell`?

`AppShell` / `SidebarNav` / `MobileNav` in `@repo/ui` are hand-rolled and predate this. Once shadcn's `Sidebar` is in the package there are two sidebar systems.

**Recommended:** port the lesson reader onto `Sidebar` with `collapsible="icon"` and delete `AppShell`/`SidebarNav`/`MobileNav`, in this spec. Leaving both is how a design system rots — the next person picks whichever they find first. If the port turns out to fight the reader's needs (the module tree, the progress ticks, the 390px behaviour), keep `AppShell`, say so in `review.md`, and mark the components as reader-only so nobody reaches for them again.

### D4. The bundle budget

Recorded so it is not re-argued: **the 250 KB target is guidance, not a gate.** N1.1 already says so in its own words — "the limit catches regressions; it does not drive quality trade-offs" — and the open follow-up asking you to ratify the numbers is hereby answered. The 300 KB ceiling stays as a regression alarm rather than a design constraint. If a page crosses 250 for a real product reason, that is fine and the number gets written down; if it crosses 300 we look at _why_ before we look at the limit.

This spec will cross 250 on some pages. The sidebar is not free and neither is converting native selects to Radix.

---

## Part A — the signed-in shell

### Adding the component

Through the CLI, never by hand (`AGENTS.md`):

```sh
cd packages/ui && pnpm dlx shadcn@latest add sidebar --yes
```

Then the two fixes that add always needs here: the CLI sometimes writes `import { cn } from "cn"` (correct it to `@repo/ui/lib/utils`) and adds a bogus `cn` dependency (`pnpm remove cn`). `sidebar` pulls in `use-mobile`, and `packages/ui/src/hooks/` does not exist yet — the alias is already configured in `components.json`, so the CLI will create it.

**The theming is already done.** `globals.css` defines the full `--sidebar-*` set — `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring` — in both light and dark, on the brand hue (oklch ~272°). They were scaffolded with the design system and never used. Nothing new to invent; check them against `DESIGN.md` and use them as they stand.

### What gets built

- `SidebarProvider` + `Sidebar` + `SidebarInset` as the shell for the D2 routes, with `collapsible="icon"`.
- Navigation grouped by what a person is: Learning (dashboard, courses, certificates, badges), Contributing (studio, moderation, mentor) and Admin, each group rendered only for a role that has it — the same `freshUser` role read the pages already do, never a client-side guess.
- `SidebarTrigger` in the inset header, with the account menu and notification bell moving into `SidebarFooter`.
- The cookie-backed open/closed state and the `cmd/ctrl+B` shortcut come with the component; keep both.
- `SidebarMenuBadge` for the unread notification count and the moderation queue depth, which are currently invisible until you go looking.

### Explicitly out of scope

Public pages, the marketing app, and any change to `SiteHeader` beyond leaving it where it is.

---

## Part B — native selects become shadcn selects

Seven native `<select>` elements remain in six files:

| File                                          | Selects | Form style                |
| --------------------------------------------- | ------- | ------------------------- |
| `components/companies/contribute-form.tsx`    | 2       | controlled, tRPC mutation |
| `components/companies/admin-company-form.tsx` | 1       | controlled                |
| `components/studio/fields.tsx`                | 1       | controlled                |
| `components/studio/credits.tsx`               | 1       | controlled                |
| `components/badges/admin-badges.tsx`          | 1       | controlled                |
| `components/moderation/item.tsx`              | 1       | controlled                |

All are controlled React state rather than `FormData`, which is the thing that makes this straightforward: Radix's `Select` is not a native form control, and the conversion would have been much riskier had any of these relied on native form submission. (S15 fixed their **contrast** by giving each an explicit `bg-background`; that was a stopgap for an unreadable dark-mode popup, not the fix.)

The root problem, for the record: a native option list is drawn by the operating system and does not inherit the page's theme, so on a dark page it renders the theme's light foreground on a white popup. No amount of styling the `<select>` itself fixes the popup.

Each conversion needs a sentinel for "no selection" — Radix rejects an empty string as an item value — following the `ANY = "__any"` pattern S15 established in `panels.tsx` and `directory-filters.tsx`.

### While in there

A sweep for other hand-rolled controls: raw `<input type="checkbox">` (there is a `Checkbox` component), raw `<input>` where `Input` exists, and anything else approximating a component the package already has. Findings that are not converted get written down in `review.md` with a reason, so the list is honest rather than quietly shortened.

---

## Tests

- Unit: each converted select still reports the same value to its form's state, and the "any"/empty sentinel round-trips.
- Existing suites pass unchanged — none of this changes an API.
- **Browser loop** (required, this is all UI): every route in D2 with the sidebar, expanded and collapsed, plus a public page and a lesson page to prove they are untouched; signed out, learner, mentor, admin; light and dark; desktop and 390px; at least two fix-and-reload rounds in `test.md`.
- Every converted select opened **in dark mode** and read — that is the bug that started this, and it is invisible in a light-mode screenshot.
- Keyboard: `cmd/ctrl+B`, tab order through the rail, and focus return after a select closes.
- Re-measure `pnpm check-budget` and record the numbers. Under D4 the numbers are a record, not a gate.

## Acceptance criteria

- [ ] Every component added through `pnpm dlx shadcn@latest add`, with the `cn` import and the bogus dependency fixed after each add.
- [ ] The signed-in routes render inside `SidebarProvider` / `Sidebar` / `SidebarInset`; public pages and the lesson reader are visibly unchanged.
- [ ] Sidebar groups appear by role, decided on the server.
- [ ] Collapsed state survives a reload (cookie) and `cmd/ctrl+B` toggles it.
- [ ] No native `<select>` remains in `apps/lms`, and every converted one is legible in dark mode.
- [ ] `AppShell` is either gone or documented as reader-only, per D3.
- [ ] `DESIGN.md` describes the two shells and when each applies.
- [ ] Bundle numbers re-measured and written down.
- [ ] Browser loop passed across the states above, two rounds recorded.

## Risks

- **Two sidebar systems** if D3 is deferred. The mitigation is deciding D3 now, either way.
- **Role-gated navigation is a disclosure surface.** A group rendered from a stale client-side role would advertise `/admin` to someone who cannot open it. Render from the server role read the pages already perform.
- **The rail costs horizontal space at 390px.** `collapsible="icon"` plus the sheet-based mobile behaviour handles it, but it needs real checking at 390px, not an assumption — and the standing follow-up that mobile checks have only ever run at 500px applies here too.
