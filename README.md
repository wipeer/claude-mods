# claude-mods

Small quality-of-life mods for [Claude Code](https://claude.com/claude-code), packaged as a plugin marketplace.

| Mod | What it does |
| --- | --- |
| [folder-title](plugins/folder-title) | Prefixes every session title with its project folder, so the sidebar reads `catan - Fix dice roll` instead of just `Fix dice roll`. |
| [reload-inventory](plugins/reload-inventory) | After `/reload-plugins` or `/reload-skills`, lists what is now loaded, with versions and on/off state. |
| [drop-relay](plugins/drop-relay) | When a hook blocks a prompt, writes the reason into the conversation so a Remote Control device sees it instead of an endless spinner. |

## Install

Type this at the prompt of a terminal Claude Code session:

```
/plugin install folder-title --marketplace wipeer/claude-mods
```

```
/plugin install reload-inventory --marketplace wipeer/claude-mods
```

```
/plugin install drop-relay --marketplace wipeer/claude-mods
```

The first time, answer `y` to add the marketplace, then pick a scope (user scope is the default). All mods are hooks modules and start working right away. A mod installed at user scope also loads in the desktop app's Code tab.

## Develop

Each mod lives in `plugins/<name>/`, with its hooks module in `hooks/register.ts` and tests beside it.

```bash
claude plugin validate plugins/folder-title
```

```bash
claude plugin test plugins/folder-title
```

To try local edits, run a session with `claude --plugin-dir plugins/<name>`.

## License

[MIT](LICENSE)
