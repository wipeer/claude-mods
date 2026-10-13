# session-launcher

Start a fresh Claude Code session without leaving the one you're in, from your desk or your phone.

```
/fs                 fresh session in this session's folder
/fs catan           fresh session in an existing folder named catan
/fresh-session ...  same as /fs
```

It does what you would do by hand, `cd <folder>` and then `claude remote-control --permission-mode auto`, in a new terminal window, named `<folder> - <yyyymmdd-hhmm>` (folder name plus local date and time, e.g. `catan - 20261030-0757`). The session shows up in claude.ai/code and the Claude mobile app as soon as it connects, and from there you can start more sessions in that folder.

## Session kind

The `kind` option picks the command:

| `kind` | Command | Use it when |
| --- | --- | --- |
| `server` (default) | `claude remote-control --permission-mode auto --name "<folder> - <yyyymmdd-hhmm>"` | You work from the phone or the web. The window only shows the server's status. |
| `interactive` | `claude --permission-mode auto --remote-control "<folder> - <yyyymmdd-hhmm>"` | You also want to type in the terminal window itself. |

`claude remote-control` serves a folder only once per computer. If a server is already running there, it prints `This folder is already served...` and gives up after about a minute. The window then starts the `interactive` command instead, so `/fs` always ends with a fresh session.

## Finding the folder

`/fs <folder>` accepts:

- an absolute path: `/fs D:\work\api`
- `~/...`, expanded to your home folder
- a name, looked up in this order: inside the current folder, beside it (the parent folder), then each folder in the `roots` option

The folder must already exist. If it isn't found, the command lists every place it looked.

## Where the session opens

The `launcher` option (`/config`, or `pluginConfigs` in settings) picks where:

| `launcher` | What happens |
| --- | --- |
| `terminal` (default) | Opens a new terminal window running the `kind` command. On Windows it uses Windows Terminal and falls back to `start`. On macOS it uses Terminal.app. On Linux it uses `x-terminal-emulator`, `gnome-terminal`, `konsole` or `xterm`. |
| `desktop` | Opens the desktop app's new Code session screen for the folder (`claude://code/new?folder=...`). If the app can't be opened, it opens a terminal instead. |
| `both` | Does both. |

**Limits of the desktop app:** its link only *prepares* a session. Someone at the computer has to send the first message, and the session uses the app's own defaults. Remote Control follows *Connect new sessions to Remote Control*. Permission mode follows `permissions.defaultMode`, so set it to `"auto"` in `~/.claude/settings.json` to get auto mode there too. Nobody can press send from a phone, so when `/fs` arrives over Remote Control it always opens a terminal session, whatever `launcher` is set to.

## Using it remotely

The mod runs on the computer that hosts the session, so typing `/fs` from your phone or claude.ai/code opens the new window on that computer. Its session then appears in your session list, ready to use from the phone. The computer must be on and signed in to Claude, as it must be for any Remote Control session.

## Install

```
/plugin install session-launcher --marketplace wipeer/claude-mods
```
