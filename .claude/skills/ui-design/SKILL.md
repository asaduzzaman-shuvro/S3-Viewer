---
name: ui-design
description: >-
  Redesign and elevate the S3 Storage Viewer's UI into something distinctive and
  polished — bold typography, a real color system, purposeful motion — while
  staying shippable in its Next.js 16 / React 19 inline-style stack. Use this
  skill whenever the user wants to improve how this app looks or builds new UI in
  it: "redesign the browse page", "make the login screen nicer", "the listing
  looks plain/boring", "polish this component", "restyle X", "give the app some
  personality", "improve the design/UI", or when adding any new page or component
  that should look good. Pairs with the installed `frontend-design` skill: this
  skill brings that skill's aesthetic ambition into *this* codebase's reality.
---

# UI Design — S3 Storage Viewer

Make this app look genuinely good, not generically "AI-generated." The S3 Storage
Viewer is a real tool people use to find files — so the goal isn't maximalist chaos,
it's **confident, characterful restraint**: a strong type pairing, one signature
color move, motion that has a job, and crisp spatial rhythm. Bold choices that still
respect that someone came here to find a file fast.

This skill leans on the installed **`frontend-design`** skill for aesthetic
direction, then grounds every decision in this codebase's actual stack and tokens so
the result ships instead of becoming a throwaway mockup.

## Workflow

### 1. Get aesthetic direction from `frontend-design`

Before touching code, get a point of view. Invoke the **`frontend-design`** skill
(via the Skill tool) — or, if it's already loaded, apply its framework directly:

- **Tone** — commit to one intentional direction (e.g. editorial/precise,
  industrial/utilitarian, refined/luxury, soft/modern). Pick one and execute it with
  precision rather than hedging between several.
- **One differentiator** — decide the single memorable element this redesign will be
  remembered for (a distinctive header treatment, a signature accent, a satisfying
  load/navigation animation). Everything else supports it.
- **The five levers** — typography, color/theme, motion, spatial composition,
  background/detail. The `frontend-design` skill explains each; bring them here.

The `frontend-design` plugin is pure methodology — it bundles no files or assets, so
you're borrowing its thinking, not importing anything.

Translate the tone to *this* app: it's a file browser, so legibility, scannable
density, and fast navigation are non-negotiable. Distinctive means a confident
identity layered onto a tool that stays effortless to use.

### 2. Ground in the app before changing it

Read the target page/component and **`references/design-system.md`** first. The app
has a working light/dark CSS-variable system and consistent layout conventions — a
good redesign *evolves* that deliberately, it doesn't blindly reskin. Note what the
component does (is it a server or client component? see `references/conventions.md`),
what tokens it already uses, and what's hardcoded.

### 3. Elevate within the stack — and improve the system

You're allowed to improve the foundation, not just paint over it. Concrete guidance:

- **Keep the inline-style pattern.** Styling here lives in
  `const styles: Record<string, React.CSSProperties> = { ... }` objects per
  component. Match it — don't introduce Tailwind or CSS modules for new work.
- **Drive every themable color through CSS variables.** The app hardcodes accents
  like `#0070f3` and `#d32f2f` in components, which means they don't adapt to dark
  mode. Promote them into semantic tokens (`--accent`, `--accent-hover`, `--danger`,
  `--success`, a `--shadow`, a `--transition`) in `src/app/globals.css` with
  light/dark values, and reference `var(--accent)` etc. See
  `references/design-system.md` for the proposed token layer. **Never hardcode a
  themable color** — that's the rule that keeps dark mode honest.
- **Make typography do work.** The project loads Geist via `next/font` but the UI
  still falls back to `Arial`/`system-ui`. That's an open opportunity: choose a
  distinctive pairing (a characterful display face + a clean body face) through
  `next/font/google` in `src/app/layout.tsx`, wire them to CSS variables, and use
  them. Generic system fonts are the fastest way to look generic.
- **Add motion with intent.** Prefer CSS `@keyframes`/`transition` — they work in
  server components and cost nothing. Reach for staggered load-in reveals and smooth
  navigation/hover transitions over scattered fidgety micro-interactions. The
  `motion` library is allowed *only when it materially helps* (orchestrated
  sequences) — and it's a new dependency, so call it out to the user before adding
  it (and remember motion components must be client components).

### 4. Verify and report

- Run `npm run lint` and `npm run build` — both must pass.
- Check **both light and dark mode** (the app keys off `prefers-color-scheme`).
  Every new color must look right in both.
- Report what you changed, list any new tokens you added to `globals.css`, and flag
  any new dependency (e.g. `motion`) or font you introduced so the user can decide.

## What good looks like

- A first-time visitor immediately senses the app has a point of view — it doesn't
  look like a default template.
- The redesign reads as one coherent identity (type + color + motion + spacing all
  pulling the same direction), not a pile of effects.
- It's still a great file browser: fast to scan, obvious where to click, legible at a
  glance.
- Light and dark mode are both deliberate. Nothing is hardcoded that should be a
  token.
- It builds and lints clean — this is production code, not a mockup.
