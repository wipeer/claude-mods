# claude-mods

Small quality-of-life mods for [Claude Code](https://claude.com/claude-code), packaged as a plugin marketplace.

| Mod                                          | What it does                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [folder-title](plugins/folder-title)         | Prefixes every session title with its project folder, so the sidebar reads `my-game - Fix dice roll` instead of just `Fix dice roll`.         |
| [reload-inventory](plugins/reload-inventory) | After `/reload-plugins` or `/reload-skills`, lists what is now loaded, with versions and on/off state.                                        |
| [remote-relay](plugins/remote-relay)         | Over Remote Control, posts other mods' toasts, status changes and dialogs as notices your phone shows. Replaces drop-relay.                   |
| [session-launcher](plugins/session-launcher) | `/fs [folder]` (or `/fresh-session`) starts a fresh Remote Control session in auto mode, in this folder or another one, even from your phone. |
| [blast-radius](plugins/blast-radius)         | Holds `rm -rf`, `git reset --hard`, force pushes and migrations, shows what they would change, and asks Proceed or Cancel on any device.      |
| [token-weather](plugins/token-weather)       | A forecast of how full the context window is; over Remote Control, a notice with the forecast after every reply.                              |
| [cache-tax](plugins/cache-tax)               | Keeps the prompt cache warm during breaks and stops a cold send once with its price; over Remote Control, as notices.                         |

Short commands: `/wct` (`/cache-tax`), `/wkw` (`/keepwarm`), `/ww` (`/weather`), `/wch` (`/wct` and `/ww` together), `/w-help` (all of them).

## Install

Type this at the prompt of a terminal Claude Code session:

```
/plugin install folder-title --marketplace wipeer/claude-mods
```

```
/plugin install reload-inventory --marketplace wipeer/claude-mods
```

```
/plugin install remote-relay --marketplace wipeer/claude-mods
```

```
/plugin install session-launcher --marketplace wipeer/claude-mods
```

```
/plugin install blast-radius --marketplace wipeer/claude-mods
```

```
/plugin install token-weather --marketplace wipeer/claude-mods
```

```
/plugin install cache-tax --marketplace wipeer/claude-mods
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

[MIT](LICENSE). The forks keep their own `LICENSE`: [blast-radius](plugins/blast-radius) and [token-weather](plugins/token-weather) are Anthropic's, under the Apache License 2.0, and [cache-tax](plugins/cache-tax) is Karan Bansal's, under MIT.
