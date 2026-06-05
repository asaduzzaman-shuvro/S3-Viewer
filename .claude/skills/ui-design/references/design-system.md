# Design system — S3 Storage Viewer

The tokens and patterns that exist today, plus the elevated token layer a redesign
should establish. Verified against the repo's source.

## Current state (as built)

### CSS variables — `src/app/globals.css`

These already adapt to `@media (prefers-color-scheme: dark)`:

| Token          | Light     | Dark      | Role |
|----------------|-----------|-----------|------|
| `--background` | `#ffffff` | `#0a0a0a` | Page background |
| `--foreground` | `#171717` | `#ededed` | Default text |
| `--surface`    | `#f4f6f9` | `#111111` | Subtle panels |
| `--card`       | `#ffffff` | `#1a1a1a` | Card surfaces |
| `--border`     | `#e0e0e0` | `#2e2e2e` | Dividers, outlines |
| `--muted`      | `#666666` | `#999999` | Secondary text |

Fonts: `--font-geist-sans` / `--font-geist-mono` are loaded in `layout.tsx` via
`next/font` but **not actually applied** — the global body font is
`Arial, Helvetica, sans-serif` and components use `system-ui, sans-serif`.

### Hardcoded values worth tokenizing

These appear as literals in component inline styles and **do not adapt to dark mode**:

- Accent / links / primary buttons: `#0070f3` (Vercel blue)
- Error / danger: `#d32f2f`, error background `#fff3f3`
- Assorted grays: `#888`, `#999`, `#bbb`, `#555`, `#666`, `#f9f9f9`, `#fafafa`
- Code/JSON viewer: bg `#1e1e1e`, text `#d4d4d4`
- One shadow, inline on the login card: `0 4px 24px rgba(0,0,0,0.12)`
- One transition, in a single component: `background 0.1s`

### Layout & scale conventions (keep these)

- **Container max-widths:** login `380px`, landing `800px`, browse `860px`,
  preview `960px`.
- **Border radius:** `6px`, `8px`, `12px` (plus a `128px` pill).
- **Spacing:** 4px grid — `4, 8, 12, 16, 20, 24, 28, 32, 48, 60` px.
- **File listing grid:** `gridTemplateColumns: "28px 1fr 100px 160px"` (icon · name ·
  size · modified), gap `8px`.
- **Type weights:** `700` headings, `600` labels/links, normal body.
- **Type sizes:** `11–13px` labels (uppercase headers use `letter-spacing: 0.05em`),
  `14–18px` body, `20–22px` headings.

## Proposed elevated token layer

Add these to `:root` and the dark-mode block in `globals.css`, then replace the
hardcoded literals in components with `var(...)`. This is what makes the redesign
themable and dark-mode-correct instead of just repainted.

```css
:root {
  /* semantic color */
  --accent: #0070f3;          /* choose the redesign's signature color here */
  --accent-hover: #0059c9;
  --accent-contrast: #ffffff; /* text on top of --accent */
  --danger: #d32f2f;
  --danger-surface: #fff3f3;
  --success: #1a7f4b;

  /* elevation & motion */
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.12);
  --radius: 8px;
  --transition: 160ms cubic-bezier(0.4, 0, 0.2, 1);

  /* type scale (optional but recommended) */
  --text-label: 12px;
  --text-body: 15px;
  --text-title: 20px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --accent: #3b9bff;        /* lift accents for contrast on dark */
    --accent-hover: #5fb0ff;
    --danger: #ff6b6b;
    --danger-surface: #2a1414;
    --success: #4ade80;
    --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.5);
  }
}
```

Notes:
- The **signature color move** the redesign commits to should be expressed as
  `--accent` (and its hover/contrast pair), so it propagates everywhere consistently.
- Keep `--accent-contrast` so text on accent surfaces stays legible in both themes.
- Tune the dark values for WCAG AA contrast — the current `#0070f3` on `#0a0a0a` is
  borderline; `#3b9bff` is safer.

## Typography opportunity

`layout.tsx` already imports `next/font` for Geist but the UI doesn't use it. A
redesign should pick a deliberate pairing and actually wire it up — for example a
characterful display face for headings/the app title and a clean grotesque/serif for
body — exposed as CSS variables and referenced in the inline style objects. This
single change does more for "distinctive" than any other.
