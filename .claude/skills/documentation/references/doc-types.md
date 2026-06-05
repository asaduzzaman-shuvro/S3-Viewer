# Doc-type structures

Templates and guidance for the four documentation types this skill produces. Read
the section for the type you're writing. These are starting structures, not
straitjackets — drop sections that don't apply and add ones the project needs.
The ordering of sections is deliberate: each leads with what its reader needs
first.

---

## README / project overview

**Reader:** someone landing on the repo for the first time. They want to know
what this is and how to run it, fast.

```markdown
# Project Name

One or two sentences: what it is and who it's for.

## Features
- Bullet the things it actually does (from the code, not aspirations).

## Tech stack
- Framework, language, key libraries and why they're here.

## Getting started
### Prerequisites
- Runtime versions, accounts, tools needed.
### Installation
\`\`\`bash
# real commands, copy-pasteable
\`\`\`
### Configuration
- Env vars / config files. Name each var and what it does. Point at .env.example.

## Usage
- The common commands (pull these from package.json scripts / Makefile, verbatim).

## Project structure
- Brief map of the important directories, one line each.

## License / Contributing
- Only if they exist or are asked for.
```

Keep it scannable. The fastest way to ruin a README is to bury the run command
under three paragraphs of motivation.

---

## API / code reference

**Reader:** a developer who will *call* this code — another module's author, an
API consumer, an integrator. They want exact signatures and behavior.

For a **module/library**, document each public export:

```markdown
## `functionName(arg1, arg2)`

One line: what it does.

**Parameters**
- `arg1` (`type`) — what it is. Required/optional, default.
- `arg2` (`type`) — ...

**Returns:** `type` — what comes back.

**Throws:** conditions that error, if any.

**Example**
\`\`\`ts
// a real call, with realistic values
\`\`\`
```

For an **HTTP API**, document each endpoint:

```markdown
## `GET /api/resource`

What it does and when to call it.

**Query / path params:** name, type, required, meaning.
**Request body:** shape (if any).
**Response:** status codes + body shape, with an example payload.
**Auth:** what's required.
```

Rules that keep reference docs trustworthy:
- Use the **real** names, types, and defaults from the source — read them, don't
  guess. Verify any library types/signatures you describe via Context7.
- Order by importance or logical grouping, not file order.
- Every example must run. Derive values from real usage in the codebase.

---

## Architecture / design

**Reader:** someone who needs to reason about the system before changing it —
understand the moving parts and how they connect.

```markdown
# Architecture

## Overview
A paragraph: what the system does and the shape of the solution.

## Components
For each major component/module:
- **Name** — responsibility, where it lives (`src/...`), what it depends on.

## Data flow
Walk a representative request/operation end to end:
1. Entry point →
2. what processes it →
3. external calls (DB, S3, APIs) →
4. response.
Use a diagram if it clarifies (mermaid fenced block is fine).

## Key decisions
- Notable choices and the *why* — auth model, runtime split, storage layout.
  This is the part future-you will thank you for.

## External dependencies
- Services and major libraries the system relies on, and their role.
```

The value here is the *connections and the why*, not a restatement of each file.
If a reader could get it from reading one file, it doesn't belong in the arch doc.

---

## How-to / tutorial

**Reader:** someone trying to accomplish one specific task. They want a path from
start to working, with no detours.

```markdown
# How to <accomplish the task>

What you'll achieve and when you'd want this. One or two sentences.

## Prerequisites
- What must be true/installed before starting.

## Steps
1. **Do the first thing.**
   \`\`\`bash
   # exact command
   \`\`\`
   What to expect after this step.
2. **Next thing.** ...

## Verify it worked
- How to confirm success (what to run, what you should see).

## Troubleshooting
- Common failure → cause → fix. Only real ones you can foresee.
```

Guidance:
- One task per guide. If it sprawls, split it and link.
- Number the steps; each step is one action with a verifiable outcome.
- When the task uses a library, confirm the current commands/flags via Context7 —
  stale tutorial steps are the most frustrating kind of doc to follow.
- End with verification. A tutorial the reader can't confirm they completed
  correctly leaves them stuck.
