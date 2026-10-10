# reload-inventory

`/reload-plugins` and `/reload-skills` only report counts. This mod adds a list of what is actually loaded underneath:

```
Reloaded: 8 plugins · 20 skills · 6 agents

📦 Plugins — 6 enabled, 1 disabled
✅ cache-tax v2.2.1 · cache-tax-local
✅ folder-title v0.2.1 · wipeer-claude-mods
⏸️ old-thing v0.1.0 · some-marketplace
```

```
🧩 Skills — 5 found
▸ User (3): inner, pdf, writer v2.0.0
▸ Project (1): deploy
▸ Plugin alpha (1): lint v0.9
```

## What it reads

- **Plugins:** `~/.claude/plugins/installed_plugins.json`, with versions taken from each plugin's manifest. On/off state comes from `enabledPlugins`, read from user settings, then the project's `.claude/settings.json`, then `.claude/settings.local.json`, with later files winning. Mods loaded from a dev-mods folder are listed with 🛠️.
- **Skills:** folders holding a `SKILL.md` under `~/.claude/skills`, the project's `.claude/skills`, and each enabled plugin's `skills/` folder. Grouped folders up to two levels deep are searched, hidden folders like `.trash` are skipped, and duplicate synced copies are listed once.

`CLAUDE_CONFIG_DIR` is respected. The mod only reads files. If listing fails, the reload output still appears, followed by a one-line error.

## Install

```
/plugin install reload-inventory --marketplace wipeer/claude-mods
```
