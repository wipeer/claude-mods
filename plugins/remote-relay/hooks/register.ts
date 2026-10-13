import type { EngineInterface, Register } from 'claude-code'

// A session driven over Remote Control draws on no surface: other mods'
// toasts, status lines and dialog panes are drawn nowhere, so a phone sees
// none of them. Each of those is a `$.ui` call raised as an event, so this mod
// copies what it says into the transcript as a system notice, a row every
// attached device shows and the model never reads. It hears only the calls of
// mods that run beneath it.

type Mirror = 'remote' | 'always'
type Digest = 'off' | 'reply'

const REPEAT_MS = 30_000
const RECENT_MAX = 100

// A status line with its numbers and durations blanked: "keepwarm 3h00m left ·
// ping in 50m" and "keepwarm 2h59m left · ping in 49m" are the same news.
export function statusShape(text: string): string {
  return text.replace(/(\d+[hms])+/g, '#').replace(/\d[\d.,]*/g, '#')
}

// Status lines carry no owner, so the first word stands in for one: two mods
// that each pin a line keep their own last shape.
export function statusTopic(text: string): string {
  return text.trim().split(/[\s:·]+/)[0] ?? ''
}

async function isMirroring($: EngineInterface, mirror: Mirror): Promise<boolean> {
  if (mirror === 'always') return true
  try {
    return (await $.session.surfaces()).length === 0
  } catch {
    return true
  }
}

// The same text twice within REPEAT_MS is posted once.
async function post($: EngineInterface, recent: Map<string, number>, text: string) {
  const now = await $.clock.now()
  const last = recent.get(text)
  if (last !== undefined && now - last < REPEAT_MS) return
  recent.set(text, now)
  if (recent.size > RECENT_MAX) recent.delete(recent.keys().next().value as string)

  try {
    await $.session.append({ message: { type: 'system', content: [{ type: 'text', text }] } })
  } catch {
    $.ui.log(text)
  }
}

export const register: Register = (on, options) => {
  const mirror = (options.mirror as Mirror | undefined) ?? 'remote'
  const digest = (options.digest as Digest | undefined) ?? 'off'
  const shapes = new Map<string, string>()
  // Each mod's pinned status line, by the mod that pinned it.
  const lines = new Map<string, string>()
  const recent = new Map<string, number>()

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'relay',
      description: 'What remote-relay mirrors here, and the status lines mods have pinned (remote-relay)',
    })
    return result
  })

  on('command.run', { command: 'relay' }, async $ => {
    const state = (await isMirroring($, mirror))
      ? mirror === 'always' ? 'mirroring on every device' : 'mirroring: no screen draws this session'
      : 'not mirroring: a screen draws this session'
    const pinned = [...lines.values()]
    const each = digest === 'reply' ? ['  after each reply, posts the lines below'] : []
    return { text: [`remote-relay: ${state}`, ...each, ...(pinned.length ? pinned.map(line => `  ${line}`) : ['  no status lines pinned'])].join('\n') }
  })

  // With digest on, each main-loop reply ends with every pinned line as it
  // stands, numbers included, in one notice. Never deduplicated: it is the
  // reply's footer, so an unchanged line is still worth seeing.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (digest === 'reply' && !e.agentId && lines.size > 0 && (await isMirroring($, mirror))) {
      const text = [...lines.values()].join('\n')
      try {
        await $.session.append({ message: { type: 'system', content: [{ type: 'text', text }] } })
      } catch {
        $.ui.log(text)
      }
    }
    return result
  })

  on('ui.toast', async ($, e, next) => {
    if (await isMirroring($, mirror)) await post($, recent, e.text)
    return next(e)
  })

  on('ui.notify', async ($, e, next) => {
    if (await isMirroring($, mirror)) await post($, recent, e.title ? `${e.title}: ${e.text}` : e.text)
    return next(e)
  })

  on('ui.status', async ($, e, next) => {
    const owner = next.origin?.plugin
    if (e.text === undefined || e.text.trim() === '') {
      // A cleared line names no topic; only its owner says whose it was.
      if (owner) lines.delete(owner)
    } else {
      const topic = statusTopic(e.text)
      const shape = statusShape(e.text)
      lines.set(owner ?? topic, e.text)
      if (shapes.get(topic) !== shape) {
        shapes.set(topic, shape)
        if (await isMirroring($, mirror)) await post($, recent, e.text)
      }
    }
    return next(e)
  })

  // A focused pane is a dialog: say so, since nothing here can draw or press it.
  on('ui.open', async ($, e, next) => {
    if (e.focus && (await isMirroring($, mirror))) {
      await post($, recent, `${e.title ?? e.id} opened a dialog that only a screen running Claude Code can show; answer it there.`)
    }
    return next(e)
  })
}
