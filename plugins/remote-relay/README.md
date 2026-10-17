# remote-relay

A session you drive over Remote Control has no screen of its own, so other mods' toasts, status lines and dialog panes are drawn nowhere and your phone sees none of them. remote-relay copies what they say into the conversation as notices, which every device shows:

```
Blast Radius: running it
keepwarm 3h00m left · ping in 50m
keepwarm 2h10m left · cold now, first ping 50m after the next turn
Blast Radius opened a dialog that only a screen running Claude Code can show; answer it there.
```

It replaces [drop-relay](https://github.com/wipeer/claude-mods/tree/72349da/plugins/drop-relay), which only saw dropped prompts when it happened to run beneath the mod that dropped them. A mod that drops a prompt should post its own reason; this marketplace's [cache-tax](../cache-tax) does.

## What it mirrors

| A mod calls | remote-relay posts |
| --- | --- |
| `$.ui.toast` | the toast's text |
| `$.ui.notify` | the title and text |
| `$.ui.status` | the line, when its wording changes. A countdown that only changes its numbers is posted once, not every minute. |
| `$.ui.open` with `focus` (a dialog) | that the mod opened a dialog this device can't show |

`/relay` shows whether it is mirroring and the status lines mods have pinned now, numbers included. `/w-help` lists `/relay` with the short commands of cache-tax and token-weather.

When you follow a desktop or terminal session from your phone, that session has a screen, so the default `mirror: remote` posts nothing there. Set `mirror` to `always` (and token-weather's `notices` to `always`) to get the notices on the phone too.

Notices are shown to you and never to the model, so they add nothing to the conversation's context. Every toast and notification is posted each time it fires, repeats included.

## Settings

`mirror` (in `/config`, or when installing):
- `remote` (default): mirror only where no screen draws the session, as with a `claude remote-control` session.
- `always`: also mirror in a terminal session. Use this when you follow a terminal session from your phone. The terminal then shows each line twice: as the mod drew it, and as a notice.

`digest`:
- `reply` (default): after every reply, all status lines mods have pinned are posted in one notice, numbers included, so each reply ends with where things stand:

  ```
  cache-tax: keepwarm 2h59m left · ping in 49m
  ```

  Lines are tracked per mod, and a mod that clears its line drops out. Subagent turns don't post.
- `off`: a status line is posted only when its state changes.

## Limitations

- It hears only the mods that run beneath it. The order between installed mods isn't documented. In testing it ran above cache-tax and blast-radius.
- It can't draw or answer another mod's dialog. A mod that holds Claude until you press a button needs its own remote path. For blast-radius, use [this marketplace's version](../blast-radius), which asks through Claude Code's own question dialog.
- A band above the prompt is drawn by a hook, not by a call the relay can hear. That's why [token-weather](../token-weather) posts its own notices.
- Log lines (`$.ui.log`) aren't mirrored: they reach the terminal but not a remote device, and the relay can't hear them without catching its own. [cache-tax](../cache-tax) posts its own instead.

## Install

```
/plugin install remote-relay --marketplace wipeer/claude-mods
```

If you have drop-relay installed, uninstall it: `/plugin uninstall drop-relay`.
