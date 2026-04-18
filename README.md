# wow — my personal ways of working

This is my own engineering standards, packaged as a Claude Code plugin. It's a personal thing — not a team tool, not a product, just a single source of truth for how I want Claude to write code across all my projects. If you stumbled on this, feel free to poke around, but the opinions in here are mine and the gates reflect my own preferences.

## What it does

When I start a Claude Code session in a repo that has this plugin enabled, a `SessionStart` hook reads my gate files and injects them into the session context. From that point on, Claude already knows my coding standards, frontend patterns, backend patterns, and security rules without me having to remind it.

- **Gates** (`gates/`) — the single source of truth. Injected into every session.
- **Skills** (`skills/`) — slash commands like `/commit`, `/implement-code`, `/review-code`, `/test`.
- **Agents** (`agents/`) — specialists like `security-reviewer` I can delegate heavier audits to.
- **Hook** (`hooks/hooks.json` + `scripts/check-wow.mjs`) — wires the gates into the session at start.

## How my other repos use it

Each repo I want this applied to has a single file — `.claude/settings.json`:

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

Then one-time install per project:

```bash
claude plugin marketplace add https://github.com/stuart-collinson/wow --scope project
claude plugin install ways-of-working@ways-of-working --scope project
```

After that, every `claude` session in that repo loads the latest gates automatically.

## Updating gates

1. Edit the gate file in `gates/`
2. Bump the version in `.claude-plugin/plugin.json` (patch for tweaks, minor for new content, major for breaking changes)
3. Commit and push

Next session in any consuming repo picks it up via `autoUpdate`.
