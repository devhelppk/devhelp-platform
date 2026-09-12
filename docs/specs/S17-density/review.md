# Density review: vertical space and organisation

Reviewed in Chrome at 1440×900, signed in, dark. Findings first, then what was changed.

## The root cause is systemic, not per-page

Every page that is not `wide` renders `mx-auto max-w-3xl` — a 768px column **centred** inside the shell's ~1250px inset. That measure was right when these pages were a centred column in a full-width viewport. With the rail now taking the left, centring again floats the content in the middle of the remaining space with roughly 240px dead on each side, and everything that could sit side by side stacks instead. The wasted height is a consequence of the wasted width.

## Findings

1. **`/account` is the worst of them.** Five sections stacked vertically — Email, Profile, Public profile, Security, Role — each spanning the full column, with **two separate Save buttons** for one page. Name and City each get their own row despite being short fields. Three of the five sections are one line of text plus one button, and each consumes ~120px of height. The page runs to roughly 1700px for content that fits on one screen.

2. **`/badges` is cramped and wasteful at the same time.** A three-column grid squeezed into 628px, so every card wraps its description onto three lines, while ~340px sits empty to its right. Narrowing the container did not save space; it just moved it.

3. **Name and City, and the three link fields, are inconsistent.** The link row (GitHub, Website, LinkedIn) already pairs into three columns and reads well. Name and City, directly above, do not — so the page contradicts itself about whether short fields pair.

## Checked and dismissed

- **`/notifications` has no "Mark all read" button.** It does; it renders only when something is unread, and the account under test was caught up. Correct as built.
- **The notification rows themselves.** Two lines with the timestamp aligned right is already compact; the list does not need columns, only a measure that is not adrift.

## What changed

- **The narrow measure is left-aligned** in the tools shell (`mr-auto`, not `mx-auto`), so a reading-width page sits beside the rail instead of floating in the middle of the inset. Prose pages keep their measure; they stop wasting the left margin twice.
- **`/account` is a two-column layout on a wide shell.** The long forms (Profile, Public profile) take the left; the short status blocks (Email, Security, Role) stack in a narrower right column. Every block is a `Card` with a real header, which replaces flat headings separated by 40px gaps. Name and City pair into one row, matching the link row below them.
- **`/badges` moves to the wide shell**, so the grid has room for four columns at `xl` and cards stop wrapping their descriptions to three lines.

Not changed: `/notifications`, `/certificates` and the company pages, which were already either dense or correctly wide.
