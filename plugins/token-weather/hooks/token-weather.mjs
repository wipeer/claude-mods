// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Modified 2026 by wipeer: where no screen draws the band (Remote Control),
// every reply's forecast (or, by setting, only a change of it) is posted as a
// transcript notice, and /weather reads the forecast out on any device.
//
// Token Weather: a live forecast of the context window, above the prompt.
//
// turn.complete: after each main-loop turn, read the context window's fill
// from $.session.usage() (the same figures the status line shows) and keep
// the last HISTORY readings.
// session.start: take a first reading, so the band shows before any turn.
// ui.render (AbovePrompt): one line: icon, forecast word, percent, tokens
// used of the window, and a block-character chart of the recent turns.
// Notices: a session with no screen of its own never draws the band, so a new
// forecast word is posted as a system notice instead (never seen by the model).
//
// The host reads on(...) and $.noun.method(...) from source, so they are
// spelled literally, and helpers that take $ are top-level functions.

const HISTORY = 12;
const BARS = "▁▂▃▄▅▆▇█";

// Forecast bands, by percent of the window used.
const FORECAST = [
// Single-width text symbols, not emoji: they line up in every terminal font.
  { upTo: 25, icon: "☀", word: "Clear", color: "yellow" },
  { upTo: 50, icon: "☁", word: "Cloudy", color: "cyan" },
  { upTo: 75, icon: "☂", word: "Showers", color: "blue" },
  { upTo: 90, icon: "☇", word: "Storm", color: "magenta" },
  { upTo: Infinity, icon: "↯", word: "Compact soon", color: "red" },
];

// Readings: { tokens, window, percent }, oldest first.
let readings = [];
// The forecast word last posted as a notice, or null before the first reading.
let lastWord = null;
// When to post notices: "remote" (no screen draws the band), "always" or "off".
let notices = "remote";
// How often: "change" (a new forecast word) or "reply" (after every reply).
let cadence = "reply";

export function register(on, options) {
  notices = options?.notices ?? "remote";
  cadence = options?.cadence ?? "reply";

  on("session.start", async ($, e, next) => {
    const result = await next(e);
    readings = [];
    lastWord = null;
    await $.command.register({ name: "weather", description: "Context window forecast: how full it is and how the last turns grew it (token-weather)" });
    await takeReading($);
    return result;
  });

  on("command.run", { command: "weather" }, async ($) => {
    return { text: readings.length === 0 ? "token-weather: no reading yet; one comes after the first turn" : `token-weather: ${line()}` };
  });

  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    if (e.agentId) {
      return result;
    }
    await takeReading($);
    return result;
  });

  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => {
    if (e.hasSurvey || readings.length === 0) {
      return next(e);
    }
    const { Box, Text } = $.ui.resolve(e);
    return band(Box, Text, e.bodyColumns ?? 80);
  });
}

async function takeReading($) {
  try {
    const { context } = await $.session.usage();
    if (!context || !context.window) {
      return;
    }
    const tokens = context.tokens ?? 0;
    const percent = Math.round(context.percent ?? (tokens / context.window) * 100);
    // The session.start reading is 0 before any response; drop it once real readings arrive.
    readings = readings.filter((r) => r.tokens > 0);
    readings.push({ tokens, window: context.window, percent });
    if (readings.length > HISTORY) {
      readings = readings.slice(-HISTORY);
    }
    $.ui.invalidate("ui.render");
    if (tokens > 0) {
      await postChange($);
    }
  } catch {
    // No reading this turn; the band keeps the last one.
  }
}

// Posts the forecast when its word changes, or after every reply with cadence
// "reply". On change, the first reading is posted only when it is past Clear,
// as a resumed session's may be.
async function postChange($) {
  if (notices === "off" || (notices === "remote" && !(await hasNoScreen($)))) {
    return;
  }
  const word = forecastFor(readings[readings.length - 1].percent).word;
  const isNew = lastWord === null ? word !== FORECAST[0].word : word !== lastWord;
  lastWord = word;
  if (!isNew && cadence !== "reply") {
    return;
  }
  const text = `token-weather: ${line()}`;
  try {
    await $.session.append({ message: { type: "system", content: [{ type: "text", text }] } });
  } catch {
    $.ui.log(text);
  }
}

// A session driven over Remote Control draws on no surface.
async function hasNoScreen($) {
  try {
    return (await $.session.surfaces()).length === 0;
  } catch {
    return true;
  }
}

// The band as one plain line, for a notice or /weather.
function line() {
  const now = readings[readings.length - 1];
  const f = forecastFor(now.percent);
  const trend = trendWord();
  return `${f.icon} ${f.word} · ${now.percent}% of context (${short(now.tokens)} / ${short(now.window)}) · last turns ${chart()}${trend ? ` · ${trend}` : ""}`;
}

function band(Box, Text, columns) {
  const now = readings[readings.length - 1];
  const f = forecastFor(now.percent);
  const trend = trendWord();
  const parts = [
    Text({ color: f.color, bold: true, children: `${f.icon}  ${f.word}` }),
    Text({ children: `  ${now.percent}% of context` }),
    Text({ dimColor: true, children: `  ${short(now.tokens)} / ${short(now.window)}` }),
  ];
  if (columns >= 60) {
    parts.push(Text({ dimColor: true, children: "   last turns " }));
    parts.push(Text({ color: f.color, children: chart() }));
    if (trend) {
      parts.push(Text({ dimColor: true, children: `  ${trend}` }));
    }
  }
  return Box({ flexDirection: "row", paddingX: 1, children: parts });
}

function forecastFor(percent) {
  return FORECAST.find((band) => percent < band.upTo) ?? FORECAST[FORECAST.length - 1];
}

// Bars scale to the busiest reading shown, so growth shows at any fill level.
function chart() {
  const top = Math.max(...readings.map((r) => r.tokens), 1);
  const bars = readings.map((r) => BARS[Math.min(BARS.length - 1, Math.floor((r.tokens / top) * (BARS.length - 1)))]);
  return bars.join("");
}

function trendWord() {
  if (readings.length < 2) {
    return "";
  }
  const delta = readings[readings.length - 1].tokens - readings[readings.length - 2].tokens;
  if (delta > 0) return `▲ +${short(delta)} last turn`;
  if (delta < 0) return `▼ ${short(-delta)} last turn`;
  return "steady";
}

function short(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}
