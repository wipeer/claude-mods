# cache-tax

Keeps Claude Code's one-hour prompt cache warm during breaks, and stops a cold send once with its estimated rewrite cost. Over Remote Control, its warnings and keepwarm state reach your phone as notices.

This is a fork of [Cache Tax](https://github.com/karanb192/claude-code-mods) 2.2.1 by Karan Bansal, under the MIT License (see [LICENSE](LICENSE)). For how it works, its costs and its limits, see the [upstream README](https://github.com/karanb192/claude-code-mods) and [website](https://cachetax.aidojo.si/). The changes are listed below.

## What it does

- **`/keepwarm [6h | 90m | always | off | status]`** arms a window. After 50 idle minutes it sends one small ping that reads the cache, so it isn't re-written when you come back. Pings cost tokens.
- **The guard:** when a session of 50,000 tokens or more has gone cold, your next message is dropped once with its price. Send it again to pay it, or `/clear` and start from a note. `/cache-tax guard warn` only shows the price.
- **`/cache-tax`** shows the cache state, the cold price and this session's cold writes.
- **Short forms:** `/wkw` is `/keepwarm`, `/wct` is `/cache-tax`. `/wch` shows `/wct` and token-weather's `/ww` together, and `/w-help` lists every command of these mods.

## Changes from upstream

A `claude remote-control` session has no screen of its own. Upstream's status line and log lines were drawn nowhere, and a dropped message left the phone with no reason. Where no screen draws the session, this version posts them as notices instead. Notices are shown to every device and never to the model:

```
cache-tax: prompt not sent. the prompt cache went cold 41m ago. Sending this re-writes up to 116,903 tokens at $10/MTok = $1.17 (a warm turn would have cost $0.06). Send it again to pay it, ...
cache-tax: keepwarm 5h59m left · ping in 50m
cache-tax: keepwarm stopped: the ping read 0 and wrote 180k tokens ($3.60), the cache was already gone
cache-tax: keepwarm is off, its window ended
cache-tax: cold write of 200k tokens paid ($4.00). Keeping the cache warm for 3h00m ...
```

The keepwarm line is posted only when its state changes (warm, cold, stopped, off), not as it counts down. `/keepwarm status` gives the exact figures. In a terminal or the desktop app it behaves exactly as upstream.

## Install

```
/plugin install cache-tax --marketplace wipeer/claude-mods
```

If you have the upstream version installed, uninstall it first. Both installed means two guards: `/plugin uninstall cache-tax@cache-tax-local`, or whichever marketplace you installed it from.

## Develop

```bash
claude plugin test plugins/cache-tax
```

The upstream tests run unchanged. The fork's own tests are in the `remote control` block at the end of `tests/register.test.ts`.
