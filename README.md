# wow — my personal ways of working

My engineering standards for **Next.js** work, packaged as a Claude Code plugin called `ways-of-working`. It's a personal thing — not a team tool, not a product, just one source of truth for how I want Claude to write code across my web projects. Its sibling, [`wow-rn`](https://github.com/stuart-collinson/wow-rn), does the same for React Native / Expo apps. A repo enables one or the other, never both.

If you stumbled on this, feel free to poke around, but the opinions in here are mine.

## What's in it

| Part | What it does |
|---|---|
| `gates/` | The standards themselves — five markdown files, listed below. Loaded in full into every session of a repo that uses this plugin. |
| `skills/` | Slash commands: `/commit`, `/implement-code`, `/review-code`. |
| `agents/` | `security-reviewer`, a specialist I can delegate heavier audits to. |
| `hooks/` + `scripts/` | A `SessionStart` check that confirms the gates are loaded and warns loudly when they are not. |

### The gates

| Gate | Covers |
|---|---|
| `coding-standards.md` | Universal TypeScript style for Next.js projects — the principles every other gate builds on |
| `frontend-patterns.md` | The Next.js App Router + React 19 stack — components, Zustand, React Hook Form + Zod, Tailwind |
| `tanstack-query.md` | Server state on the client via tRPC's TanStack Query integration — the per-domain `hooks/` layout, keys, stale times, mutations, prefetch |
| `backend-patterns.md` | The tRPC API layer behind the app — procedures as the contract, data-source-agnostic |
| `security-patterns.md` | Secrets, vulnerability patterns, and the pre-deployment checklist |

`gates/ROUTING.md` says which gates apply to which kind of task. `gates/GATES.md` is the entry point that imports all of them — it is the file consuming repos point at.

## How the gates get into a session

Two things happen when Claude Code starts in a repo that uses this plugin:

1. **The repo's own `CLAUDE.md` imports the gates.** One line, `@~/.claude/plugins/marketplaces/ways-of-working/gates/GATES.md`, points at the plugin's entry file in the marketplace cache. Claude Code expands `@` imports at launch with no size limit, so every gate arrives in full. Because the line lives in the repo, only that repo gets these gates — a React Native repo importing `wow-rn` never sees them.
2. **The plugin's `SessionStart` hook checks the import is there.** If it is, it says so in a line. If it isn't, or the file it points at is missing, it prints a loud warning with the exact line to add.

The gates deliberately do **not** travel through the hook. Claude Code caps a hook's `additionalContext` at 10,000 characters; anything larger is replaced by a file path and a 2 KB preview, with no error. These gates are ~98,000 characters. Until version 2.0.0 the hook shipped all of them, and every session silently received the first thousand characters of `coding-standards` and nothing else.

## Use it in a new project

Two files to add to the new repo, then one session to approve things. Takes a minute.

### 1. Enable the plugin — `.claude/settings.json`

```json
{
  "extraKnownMarketplaces": {
    "ways-of-working": {
      "source": { "source": "git", "url": "https://github.com/stuart-collinson/wow.git" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "ways-of-working@ways-of-working": true
  }
}
```

This gives the repo the skills, the agent and the hook, and keeps them updated whenever this plugin's version changes.

### 2. Import the gates — `CLAUDE.md`

Add this to the repo's `CLAUDE.md`, creating the file if there isn't one:

```markdown
## Engineering standards

The `ways-of-working` gates load in full through this import. They are rules, not suggestions; where this file and a gate overlap, this file wins.

@~/.claude/plugins/marketplaces/ways-of-working/gates/GATES.md
```

The `~` path is where Claude Code keeps the marketplace clone on every machine, so the line is safe to commit. Keep it outside any code block — Claude Code ignores imports inside backticks.

### 3. Open Claude Code and accept two prompts

Start `claude` in the repo. The first time on a machine you'll be asked to:

- **Install the plugin** that `.claude/settings.json` enables. Accept.
- **Approve the external import.** The `CLAUDE.md` line points outside the working directory, and Claude Code asks once per project before loading it. Accept.

Then start a new session, because imports are expanded at launch.

### 4. Check it worked

The hook's startup context should begin `Engineering standards — ways-of-working` and say the gates are loaded in full. If it begins `WARNING — ways-of-working gates are NOT loaded`, the message says exactly what to fix.

For a real check, ask the session something only a gate answers — *"what does the tanstack-query gate say about stale times?"* — and it should answer without reading any files.

Commit `.claude/settings.json` and `CLAUDE.md`. The next clone of the repo, on any machine, needs only step 3.

## Updating the gates

1. Edit the gate file in `gates/`.
2. Bump `version` in `.claude-plugin/plugin.json` — patch for tweaks, minor for new content, major for anything consumers must act on.
3. Commit and push.

Consuming repos pick the new version up on their next session via `autoUpdate`, and the import reads from the refreshed cache, so the new text is live immediately.

### Adding a gate

Create the file under `gates/`, add an `@name.md` line to `gates/GATES.md`, and add it to `gates/ROUTING.md`. A gate missing from `GATES.md` is a gate nobody gets.

## Layout

```
.claude-plugin/
├── plugin.json           # plugin manifest — bump version here
└── marketplace.json      # this repo is its own marketplace
gates/
├── GATES.md              # entry point: imports every gate; consuming repos import this file
├── ROUTING.md            # which gates apply to which task
└── *.md                  # the gates
hooks/hooks.json          # wires check-gates.mjs into SessionStart
scripts/check-gates.mjs   # confirms the import is in place; warns if not; never carries gate text
skills/                   # /commit, /implement-code, /review-code
agents/                   # security-reviewer
CLAUDE.md                 # notes for Claude when working on this repo itself
```
