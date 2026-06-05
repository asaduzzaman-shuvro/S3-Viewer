# Code conventions for UI work — S3 Storage Viewer

How to make UI changes that fit this codebase. Read before editing a component.

## Styling pattern

Styling is done with **inline style objects**, one per component, at the bottom of
the file:

```tsx
export default function Thing() {
  return <div style={styles.wrapper}>…</div>;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: "flex", flexDirection: "column", gap: 16 },
  // …
};
```

- Match this. Don't introduce Tailwind, CSS modules, or styled-components for new
  work — consistency matters more than personal preference here.
- `globals.css` is the right home for things inline styles can't express:
  CSS variables, `@keyframes`, `@media` queries, and `:hover`/`:focus` pseudo-classes
  for elements that can't easily carry JS hover state. Inline styles can't do
  pseudo-selectors, so hover/focus/keyframe styling lives in `globals.css` (often via
  a `className`) or in a client component with state.

## Server vs client components

The App Router defaults to **server components**. This matters for motion and
interactivity, which need client components (`"use client"` at the top of the file):

| Component / page | Type | Notes |
|------------------|------|-------|
| `app/browse/[[...path]]/page.tsx` | Server | reads S3 directly; no client JS |
| `app/preview/[...key]/page.tsx`   | Server | presigns then renders |
| `app/login/page.tsx`              | Client-ish | form interaction |
| `components/Breadcrumb.tsx`       | Server | pure render |
| `components/FileRow.tsx`          | Server | pure render |
| `components/LogoutButton.tsx`     | Client | has an onClick handler |
| `components/ImagePreview/PdfPreview/JsonPreview` | Client | interactive viewers |

Implications for a redesign:
- **CSS-only motion** (`@keyframes`, `transition`, `animation-delay` for staggered
  reveals) works everywhere, including server components — prefer it.
- **JS-driven motion** (hover state in React, the `motion` library) requires a client
  component. To animate a server component like `FileRow`, either keep it CSS-only or
  extract the animated part into a small client component.

## Dark mode rule

The app themes via `prefers-color-scheme`. The single most important rule:
**never hardcode a color that should change between light and dark.** Add a CSS
variable in `globals.css` (with both light and dark values) and reference
`var(--token)`. Hardcoded `#0070f3`/`#d32f2f`/grays in components are exactly the bug
this prevents — fix them as you touch each component.

## Motion approach

1. **Default to CSS.** `transition` on interactive elements, `@keyframes` +
   `animation-delay` for entrance choreography (e.g. file rows fading/sliding in with
   a small per-row stagger). Use the `--transition` token so timing stays consistent.
2. **Respect motion preferences.** Wrap non-essential animation in
   `@media (prefers-reduced-motion: no-preference)` so it's disabled for users who
   opt out.
3. **`motion` library only when justified** — for orchestrated, stateful sequences
   CSS can't cleanly express. It's a new dependency and forces a client component, so
   surface it to the user before adding it rather than installing silently.

## Verification

- `npm run lint` and `npm run build` must pass before declaring done.
- Eyeball **both** color schemes (toggle your OS theme or DevTools'
  emulate-`prefers-color-scheme`).
- Keep the file browser fast and scannable — if a flourish slows down reading the
  listing, cut it.
