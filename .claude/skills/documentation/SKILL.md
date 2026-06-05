---
name: documentation
description: >-
  Create high-quality project documentation — README files, API/code reference,
  architecture/design docs, and how-to guides or tutorials — written as markdown
  into the repository and enriched with up-to-date library documentation fetched
  via Context7. Use this skill whenever the user wants to document code, write or
  update a README, generate API or endpoint reference, explain how a system or
  module works, describe the architecture, or produce a setup/usage guide or
  tutorial — even when they don't literally say "documentation". Trigger on
  phrases like "document this", "write docs for", "add a README", "explain the
  architecture", "generate API docs", "write a how-to", "create a setup guide",
  or "I need docs for <library/feature>".
---

# Documentation

Create clear, accurate, maintainable documentation for a codebase and write it
into the repository as markdown. The defining quality of good docs is that they
are *true* — they match the code as it actually is and the libraries as they
actually behave today. This skill leans on two things to get there: reading the
real code, and pulling current library docs through **Context7** so examples and
API references don't drift from reality.

## Core workflow

Follow these steps in order. Skip a step only when it clearly doesn't apply
(e.g. a pure how-to for an external library may not need a deep codebase read).

### 1. Clarify the target

Establish three things before writing:

- **Doc type** — README/project overview, API/code reference, architecture/design,
  or how-to/tutorial. If the request maps to more than one (e.g. "document the
  auth system" often wants both reference *and* a how-to), say so and confirm
  scope rather than silently producing one.
- **Audience** — new contributors, API consumers, end users, or your future self.
  This decides depth and vocabulary.
- **Output location** — where the markdown file(s) should live. Default to repo
  conventions: `README.md` at root, deeper docs under `docs/`. Match whatever
  the repo already does.

If any of these is genuinely ambiguous and the answer changes the output, ask.
Otherwise pick the sensible default, state it, and proceed.

### 2. Read the code first

Documentation written from assumptions is worse than none, because readers trust
it. Ground every claim in the source:

- Read the relevant files, entry points, config, and existing docs.
- Note the real names — functions, parameters, routes, env vars, commands — and
  use them verbatim. Never invent an API.
- Pull runnable facts from the repo: scripts in `package.json`, actual CLI flags,
  real file paths. These become your examples.

### 3. Identify libraries, then enrich with Context7

While reading, list the third-party libraries and frameworks that matter to this
doc (from imports, `package.json`, lockfiles, config). For each one whose current
API you need to describe or show examples for, use Context7 — your training data
may lag behind the installed version, and Context7 reflects what's current.

See `references/context7.md` for the exact two-call flow and worked examples.
In short:

1. `resolve-library-id` with the library's proper name to get its `/org/project` ID.
2. `query-docs` with that ID and a *specific* question (e.g. "App Router route
   handler signature and runtime config", not "next.js").

Use Context7 to confirm signatures, current config syntax, recommended patterns,
and version-specific behavior — then write examples that match both the library's
current API *and* how this codebase actually uses it. When the repo pins a version,
prefer the matching `/org/project/version` ID so docs reflect the installed release.

Don't over-fetch: query Context7 only for libraries the doc actually explains, and
cap it at a few targeted queries. If a library is incidental, a mention is enough.

### 4. Write the markdown

Pick the structure for the doc type from `references/doc-types.md` and fill it in.
Across all types:

- **Lead with what the reader needs first.** A README opens with what the project
  is and how to run it, not its license. Reference docs are scannable, not prose.
- **Show, then tell.** Concrete, copy-pasteable examples beat description. Every
  command and snippet must be real — derived from the code or verified via Context7.
- **Link, don't duplicate.** Cross-link related docs and source files
  (`` `src/lib/s3.ts` ``) rather than restating. Duplicated docs rot out of sync.
- **Write only what you can verify.** If you're unsure whether something is true,
  read the code or query Context7 — don't hedge in the prose. It's better to omit
  a section than to fill it with plausible-but-wrong detail.

### 5. Land the file and report

Write the markdown to the chosen path. Then tell the user what you created, where,
and call out anything you couldn't verify or deliberately left out, so they can
fill the gap. If you generated a doc that should be linked from an index or README,
add that link.

## Doc-type structures

Each type has a different shape and emphasis. Read `references/doc-types.md` for
the templates and guidance — it covers README/project, API/code reference,
architecture/design, and how-to/tutorial. Load the section for the type you're
writing.

## What good looks like

- A new contributor can follow the README and get the project running without
  asking a single question.
- Every code example actually runs against the current code and libraries.
- The architecture doc lets someone reason about a change before they open a file.
- Nothing in the doc contradicts the source. When the code changes, it's obvious
  which doc to update because each doc owns a clear slice.
