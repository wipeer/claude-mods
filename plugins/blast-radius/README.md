# blast-radius

Holds a risky shell command and shows you what it would change before it runs. You answer with **Proceed** or **Cancel**, at the terminal or on your phone over Remote Control.

This is a fork of [Blast Radius](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods/blast-radius) by Claude Code DevRel (Anthropic), under the Apache License 2.0 (see [LICENSE](LICENSE)). The changes are listed below.

## What it holds

| Command | What it shows |
|---|---|
| `rm -r`, `rm -f`, `rm -rf` | The files it would delete, with the count and total size. Globs and `~` are expanded. |
| `git reset --hard` | The files with uncommitted changes. |
| `git checkout -- .`, `git restore .` | The files with unstaged changes. |
| `git clean` | The untracked paths it would remove, from `git clean -n` with the same flags. |
| `git push --force` (also `-f`, `--force-with-lease`, `+ref`) | The commits on the remote branch that your HEAD doesn't have. |
| `manage.py migrate`, `db:migrate`, `alembic upgrade`, `prisma migrate` | The pending migrations. |

Every other command runs as normal. Claude sees a refusal and its reason.

## Changes from upstream

- **Remote Control.** A `claude remote-control` session has no screen of its own. The upstream pane was reported as shown, nobody could see it, and Claude waited 10 minutes. Where no screen draws the session, this version posts the report as a notice and asks with Claude Code's own question dialog, which every device shows:

  ```
  Blast Radius is holding: rm -rf build
  Would delete 214 files (about 3.1 MB)
    build/index.js
    ...
  ```
  > **Blast Radius** It would delete 214 files (about 3.1 MB). Run `rm -rf build`? · Proceed · Cancel

  Type an answer instead ("only delete build/tmp") and the command is refused with your words passed to Claude.
- **Windows.** Git for Windows keeps `bash` and `sleep` out of `PATH`, so upstream could measure nothing and refused every risky command at once. This version finds Git's bash through `git --exec-path` (or `CLAUDE_CODE_GIT_BASH_PATH`).
- **Fails closed.** If the hook itself fails, the command is refused instead of running unchecked.

## Setting

`answer` (in `/config`, or when installing):
- `auto` (default): the pane where a screen draws the session, the question where none does.
- `ask`: always the question. Use this when you follow a terminal session from your phone: the terminal and the phone both show it, and either can answer.
- `pane`: always the pane, as upstream.

When the question is answered on one device, the others may keep showing it until they refresh. That's Claude Code's behaviour, not the mod's.

## Install

```
/plugin install blast-radius --marketplace wipeer/claude-mods
```

If you have the upstream version installed, uninstall it first: `/plugin uninstall blast-radius@claude-code-playground-mods`.
