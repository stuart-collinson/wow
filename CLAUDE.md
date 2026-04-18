# wow — Claude Code Plugin

This repo is the `ways-of-working` plugin consumed by other repos via `.claude/settings.json`.

## Before every commit: bump the version

Consumers' `autoUpdate: true` only refreshes the cached plugin when `.claude-plugin/plugin.json`'s `version` field changes. Push without a bump → nobody gets the update until they manually run `claude plugin update ways-of-working@ways-of-working`.

So: any commit that changes gates, hook script, agents, skills, or plugin config must bump the version in `.claude-plugin/plugin.json` in the same commit.

- Gate tweak / typo / rule edit → patch (`1.0.1 → 1.0.2`)
- New gate / skill / agent → minor (`1.0.x → 1.1.0`)
- Breaking change (remove / rename) → major (`1.x.y → 2.0.0`)

## Before pushing: smoke-test the hook

```bash
CLAUDE_PLUGIN_ROOT="$(pwd)" node scripts/check-wow.mjs | head -c 200
```

Output must start with `{"hookSpecificOutput":{"hookEventName":"SessionStart"` — anything else and Claude Code silently ignores it.
