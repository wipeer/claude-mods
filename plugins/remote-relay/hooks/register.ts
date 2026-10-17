import type { CommandRunInput, CommandRunResult, EngineInterface, Register } from 'claude-code'

// A session driven over Remote Control draws on no surface: other mods'
// toasts, status lines and dialog panes are drawn nowhere, so a phone sees
// none of them. Each of those is a `$.ui` call raised as an event, so this mod
// copies what it says into the transcript as a system notice, a row every
// attached device shows and the model never reads. It hears only the calls of
// mods that run beneath it.

type Mirror = 'remote' | 'always'
type Digest = 'off' | 'reply'

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

const HELP = ['/relay  what remote-relay mirrors here, and the pinned status lines']

// Each mod serving /w-help adds its lines above those of the mods beneath; the
// engine's own answer, for a command no hook below served, is dropped.
export function helpStack(mine: string[], below?: string): string {
  const theirs = (below ?? '').split('\n').filter(line => line.startsWith('/'))
  return ['w-mods slash commands', ...[...new Set([...mine, ...theirs])].sort()].join('\n')
}

// What the mods beneath answered, or nothing when no hook below serves the command.
async function beneath(next: (e: CommandRunInput) => Promise<CommandRunResult>, e: CommandRunInput): Promise<CommandRunResult | undefined> {
  try {
    return await next(e)
  } catch {
    return undefined
  }
}

async function isMirroring($: EngineInterface, mirror: Mirror): Promise<boolean> {
  if (mirror === 'always') return true
  try {
    return (await $.session.surfaces()).length === 0
  } catch {
    return true
  }
}

// Every call is posted, repeats included: each toast is news to a phone.
async function post($: EngineInterface, text: string) {
  try {
    await $.session.append({ message: { type: 'system', content: [{ type: 'text', text }] } })
  } catch {
    $.ui.log(text)
  }
}

export const register: Register = (on, options) => {
  const mirror = (options.mirror as Mirror | undefined) ?? 'remote'
  const digest = (options.digest as Digest | undefined) ?? 'reply'
  const shapes = new Map<string, string>()
  // Each mod's pinned status line, by the mod that pinned it.
  const lines = new Map<string, string>()

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'relay',
      description: 'What remote-relay mirrors here, and the status lines mods have pinned (remote-relay)',
    })
    // /w-help is shared with cache-tax and token-weather: each mod adds its lines.
    try {
      await $.command.register({ name: 'w-help', description: 'Every slash command of the w-mods (w-mods)', immediate: true })
    } catch {
      // Served by the hook either way.
    }
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

  on('command.run', { command: 'w-help' }, async ($, e, next) => {
    const below = await beneath(next, e)
    return { text: helpStack(HELP, below?.text) }
  })

  // With digest on, each main-loop reply ends with every pinned line as it
  // stands, numbers included, in one notice: it is the reply's footer, so an
  // unchanged line is still worth seeing.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (digest === 'reply' && !e.agentId && lines.size > 0 && (await isMirroring($, mirror))) {
      await post($, [...lines.values()].join('\n'))
    }
    return result
  })

  on('ui.toast', async ($, e, next) => {
    if (await isMirroring($, mirror)) await post($, e.text)
    return next(e)
  })

  on('ui.notify', async ($, e, next) => {
    if (await isMirroring($, mirror)) await post($, e.title ? `${e.title}: ${e.text}` : e.text)
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
        if (await isMirroring($, mirror)) await post($, e.text)
      }
    }
    return next(e)
  })

  // A focused pane is a dialog: say so, since nothing here can draw or press it.
  on('ui.open', async ($, e, next) => {
    if (e.focus && (await isMirroring($, mirror))) {
      await post($, `${e.title ?? e.id} opened a dialog that only a screen running Claude Code can show; answer it there.`)
    }
    return next(e)
  })
}
