You are about to perform a full pre-PR code review. Follow every step in order.

## Step 1 — Read Gates

Read all of the following files in full before looking at any code:

1. `~/.claude/gates/coding-standards.md`
2. `~/.claude/gates/frontend-patterns.md`
3. `~/.claude/gates/backend-patterns.md`
4. `~/.claude/gates/security-patterns.md`

## Step 2 — Collect the Full Diff

Run the following commands to capture everything that will be in the PR — committed changes, staged changes, and unstaged changes:

```bash
git diff dev...HEAD
git diff --cached
git diff
```

Also run these for context:

```bash
git status
git log dev...HEAD --oneline
```

If the base branch is not `dev`, use whatever the actual base branch is. If uncertain, ask before proceeding.

## Step 3 — Generate the Review Report

Produce a structured report using the format below. Be specific — reference file names, line numbers, and quote the actual offending code where relevant. Do not be vague.

---

### PR Review Report

**Branch:** `<branch-name>`
**Base:** `dev`
**Commits:** `<count>`
**Files changed:** `<count>`

---

#### Summary

One short paragraph describing what this PR does overall.

---

#### 🔴 Blockers
> Must be fixed before merging. Violations of coding standards, security issues, broken patterns.

List each issue with:
- **File + line** — what the problem is
- **Code:** the offending snippet
- **Fix:** what it should be instead

If none: _None found._

---

#### 🟡 Warnings
> Should be fixed. Not strictly blocking but will degrade quality or cause problems later.

Same format as blockers.

If none: _None found._

---

#### 🔵 Suggestions
> Nice to have. Minor style improvements, small optimisations, readability nudges.

If none: _None found._

---

#### Standards Compliance

Score each category. Use ✅ (clean), ⚠️ (minor issues), ❌ (violations found).

| Category | Status | Notes |
|---|---|---|
| TypeScript strictness (no any, explicit return types) | | |
| Arrow functions / no function keyword | | |
| Naming conventions (camelCase, PascalCase, SCREAMING_SNAKE_CASE) | | |
| type vs interface | | |
| File structure (imports → types → logic → render) | | |
| Component architecture (parent/sub-component split) | | |
| No god components / no oversized render blocks | | |
| No prop drilling 3+ levels | | |
| Type scoping (local vs shared types/) | | |
| State management (RHF for forms, Zustand for shared state) | | |
| Security (secrets, validation, auth checks) | | |
| No unused imports / variables / functions | | |
| Near-zero comments | | |

---

#### Overall Verdict

**🟢 Good to go** / **🟡 Merge with fixes** / **🔴 Needs work**

One or two sentences on the overall state of the PR.

---

## Step 4 — Offer to Fix

After presenting the report, ask:

> Would you like me to fix any of the blockers or warnings now?

If yes, apply fixes one file at a time and confirm each one before moving to the next.
