---
name: audit-security
description: >-
  Perform an on-demand security review of this codebase and report exploitable
  vulnerabilities with severity, exact location, impact, and a concrete fix. Reviews
  the whole codebase by default (no git remote required) and can be scoped to specific
  files/dirs or a diff. Pairs with the installed `security-guidance` plugin — it
  reuses that plugin's vulnerability taxonomy and honors its org-policy file
  (`.claude/claude-security-guidance.md`), acting as the manual, full-repo counterpart
  to the plugin's automatic edit/commit reviews. Use whenever the user asks to
  "review the security", "run a security review", "check for vulnerabilities", "audit
  the code for security", "is this safe / exploitable", "find security issues", "pentest
  this", or mentions specific classes like injection, XSS, SSRF, auth bypass, IDOR,
  secrets, or path traversal — even if they don't say the word "security".
---

# Security review

Find real, exploitable security vulnerabilities in this codebase and report them so
they can be fixed. This is the **on-demand, full-repo** review. It complements the
`security-guidance` plugin (which automatically pattern-checks edits and LLM-reviews
diffs on stop/commit) by reusing the same vulnerability taxonomy and the same project
policy file — so a manual review and the automatic ones speak the same language.

The bar is **precision over volume**: a short list of true, demonstrable issues is far
more useful than a long list of maybes. Every finding must have a plausible exploit
path you can articulate. Mark anything you can't fully confirm as lower confidence
rather than asserting it.

## Workflow

### 1. Determine scope (never depend on a remote)

The built-in command assumed `origin/HEAD`; this repo often has no remote, so resolve
scope locally:

- **Arguments given** — honor them. File/dir paths → review those. `staged` →
  `git diff --cached`. `working` / `uncommitted` → `git diff`. `branch` →
  `git diff $(git rev-list --max-parents=0 HEAD | tail -1)..HEAD` (root commit → HEAD).
- **No arguments (default)** — review the **whole codebase**. Enumerate source files
  (e.g. `git ls-files` or walk `src/`), and prioritize security-relevant code first
  (see step 3). Don't review `node_modules`, build output, or lockfiles.

State what you reviewed at the top of the report so scope is unambiguous.

### 2. Load project security policy

Read these if present and fold their rules into the review (user → project → local):
`~/.claude/claude-security-guidance.md`, `.claude/claude-security-guidance.md`,
`.claude/claude-security-guidance.local.md`. These hold org/project-specific
invariants (e.g. "user-controlled URLs must go through the SSRF allowlist"). Treat a
violation of a stated policy as a real finding. This is the same file the
`security-guidance` plugin uses, so manual and automatic reviews stay consistent.

### 3. Review by tracing data flow, guided by the taxonomy

Read **`references/vulnerability-classes.md`** for the full class list and what to look
for in each. Don't pattern-match blindly — follow untrusted input from **source to
sink**:

- **Sources**: HTTP request params/body/headers, route params, cookies, query strings,
  file names/keys, env values that originate from users, anything fetched externally.
- **Sinks**: SQL/command/HTML construction, file-system paths, outbound HTTP (SSRF),
  deserializers, redirects, template rendering, auth/permission decisions, logging.

Prioritize the security-sensitive surface first: authentication/authorization, secret
and credential handling, anything that builds a request/path/query from input, and
crypto. For this project that means the auth/cookie code, the S3 credential store and
its encryption, presigned-URL generation, and how object keys / regions / buckets flow
from user input into AWS calls.

### 4. Judge severity and exploitability

For each candidate, ask: who can trigger it, with what access, and what's the impact?
Assign severity:

- **Critical** — remote, unauthenticated, high impact (RCE, auth bypass, secret leak).
- **High** — serious impact but needs some condition (authd user, specific input).
- **Medium** — real weakness, limited impact or harder to exploit.
- **Low** — minor hardening gap, defense-in-depth.
- **Info** — not exploitable now, but worth noting.

Drop non-issues. If a "finding" depends on an attacker who already has the secret/host,
say so and lower it. Note whether each issue looks newly introduced vs pre-existing if
git history makes that clear.

### 5. Report

Use the structure below. Lead with a one-line verdict and the scope, then findings
ordered by severity. If there are no real issues, say so plainly — don't manufacture
findings.

```markdown
# Security review

**Scope:** <what was reviewed>
**Verdict:** <e.g. "No critical issues; 1 high, 2 medium" or "Clean — no exploitable issues found">

## Findings

### [SEVERITY] <short title>
- **Location:** `path/to/file.ts:line`
- **Class:** <e.g. SSRF, IDOR, hardcoded secret>
- **What:** how the vulnerability works (source → sink).
- **Impact:** what an attacker achieves.
- **Fix:** the concrete change (name the function/pattern; show a snippet if it helps).
- **Confidence:** high / medium / low — and why, if not high.

## Notes
- Anything reviewed and found safe that's worth confirming, assumptions made, or areas
  needing human judgment / out of scope.
```

## What good looks like

- Every finding is something you could write a proof-of-concept for, or you've labeled
  it lower-confidence.
- Locations are exact (`file:line`), and fixes are actionable, not "validate input".
- The review reflects how *this* app actually works — it traced real data paths, not
  just grepped for scary function names.
- No noise: hardening nits are marked Low/Info and kept separate from real risk.
