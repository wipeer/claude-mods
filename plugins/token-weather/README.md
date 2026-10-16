# token-weather

A live forecast of the context window above the prompt: a weather icon, how full the window is, and a chart of the last turns. Over Remote Control, where the band can't be drawn, it posts the forecast as a notice after every reply.

This is a fork of [Token Weather](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods/token-weather) by Claude Code DevRel (Anthropic), under the Apache License 2.0 (see [LICENSE](LICENSE)). The changes are listed below.

| Fill | Forecast |
|---|---|
| under 25% | ☀ Clear |
| 25–50% | ☁ Cloudy |
| 50–75% | ☂ Showers |
| 75–90% | ☇ Storm |
| 90% and up | ↯ Compact soon |

## Changes from upstream

- **Remote Control.** A `claude remote-control` session has no screen, so the band is never drawn. There, the forecast is posted as a notice after every reply (or, with `cadence: change`, only when it changes, about four a session, the last being the warning to compact):

  ```
  token-weather: ☂ Showers · 52% of context (104k / 200k) · last turns ▁▂▃▅▇ · ▲ +12k last turn
  ```

  With `cadence: change`, a fresh session's first Clear isn't posted, and a resumed session that is already past Clear is posted at the first turn. Notices are shown to you, never to the model.
- **`/weather`** reads the current forecast out on any device.

## Setting

`notices` (in `/config`, or when installing):
- `remote` (default): post notices only where no screen draws the session.
- `always`: also in a terminal session, for following it from your phone.
- `off`: never.

`cadence`:
- `reply` (default): post the forecast line after every reply, with the fill, chart and last turn's growth.
- `change`: post only when the forecast word changes, about four times a session.

## Install

```
/plugin install token-weather --marketplace wipeer/claude-mods
```

If you have the upstream version installed, uninstall it first: `/plugin uninstall token-weather@claude-code-playground-mods`.
