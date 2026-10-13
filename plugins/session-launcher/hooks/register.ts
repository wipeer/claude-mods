import type { EngineInterface, Register } from 'claude-code'

type $ = EngineInterface
type Os = 'windows' | 'mac' | 'linux'
type Launcher = 'terminal' | 'desktop' | 'both'
type Kind = 'server' | 'interactive'

const isAbsolute = (p: string) => /^([A-Za-z]:[\\/]|[\\/])/.test(p)
const sepOf = (p: string) => (p.includes('\\') ? '\\' : '/')
const trimSep = (p: string) => (/^([A-Za-z]:)?[\\/]$/.test(p) ? p : p.replace(/[\\/]+$/, ''))
export const join = (base: string, name: string) => `${trimSep(base)}${sepOf(base)}${name}`
export const parentOf = (p: string) => {
  const cut = Math.max(trimSep(p).lastIndexOf('/'), trimSep(p).lastIndexOf('\\'))
  return cut <= 0 ? p : p.slice(0, /^[A-Za-z]:$/.test(p.slice(0, cut)) ? cut + 1 : cut)
}
export const baseName = (p: string) => trimSep(p).split(/[\\/]/).pop() || p
// "catan - 20261030-0757": folder name plus local date and time.
export const sessionName = (folder: string, now = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`
  return `${baseName(folder)} - ${stamp}`
}
const unquote = (s: string) => s.trim().replace(/^(["'])(.*)\1$/, '$2')

// The places a folder argument may name, in the order tried: an absolute path
// as given, then under the session's folder, its parent, and each extra root.
export function candidates(arg: string, cwd: string, home: string | undefined, roots: string): string[] {
  let name = unquote(arg)
  if (home && /^~([\\/]|$)/.test(name)) name = home + name.slice(1)
  if (isAbsolute(name)) return [name]
  const bases = [cwd, parentOf(cwd), ...roots.split(';').map(r => r.trim()).filter(Boolean)]
  return [...new Set(bases.map(b => join(b, name)))]
}

// `claude remote-control` is a server: it opens a fresh session and lets a
// phone or claude.ai/code start more in the folder. It serves a folder only
// once and, when one already does, gives up after about 70 seconds; the
// interactive kind (one session with Remote Control on) then starts instead.
export function claudeArgvs(kind: Kind, name: string): string[][] {
  const interactive = ['claude', '--permission-mode', 'auto', '--remote-control', name]
  if (kind === 'interactive') return [interactive]
  return [['claude', 'remote-control', '--permission-mode', 'auto', '--name', name], interactive]
}

// The argv that opens a new terminal window in `folder` running each of
// `claudes` until one succeeds, most preferred window first.
export function terminalArgvs(os: Os, folder: string, name: string, claudes: string[][]): string[][] {
  if (os === 'windows') {
    // wt hands the rest to cmd untouched; `start` runs in a cmd of its own,
    // which would take a bare `||` for itself.
    const chain = (or: string) => claudes.length === 1 ? claudes[0] : ['cmd.exe', '/c', ...claudes.flatMap((c, i) => (i ? [or, ...c] : c))]
    return [
      ['wt.exe', '-w', 'new', '--title', name, '-d', folder, ...chain('||')],
      ['cmd.exe', '/c', 'start', name, '/D', folder, ...chain('^|^|')],
    ]
  }
  const sh = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`
  const line = `cd ${sh(folder)} && { ${claudes.map(c => c.map(sh).join(' ')).join(' || ')}; }`
  if (os === 'mac') {
    const script = line.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
    return [['osascript', '-e', `tell application "Terminal" to do script "${script}"`, '-e', 'tell application "Terminal" to activate']]
  }
  return [
    ['x-terminal-emulator', '-e', 'sh', '-c', line],
    ['gnome-terminal', '--', 'sh', '-c', line],
    ['konsole', '-e', 'sh', '-c', line],
    ['xterm', '-e', 'sh', '-c', line],
  ]
}

export function plan(launcher: Launcher, isRemote: boolean) {
  return {
    wantsDesktop: launcher !== 'terminal' && !isRemote,
    wantsTerminal: launcher !== 'desktop' || isRemote,
  }
}

export const desktopUrl = (folder: string) => `claude://code/new?folder=${encodeURIComponent(folder)}`

export function desktopArgv(os: Os, url: string): string[] {
  if (os === 'windows') return ['rundll32.exe', 'url.dll,FileProtocolHandler', url]
  return [os === 'mac' ? 'open' : 'xdg-open', url]
}

async function osOf($: $): Promise<Os> {
  if ((await $.env.get('OS')) === 'Windows_NT') return 'windows'
  const uname = await $.process.run(['uname', '-s']).catch(() => undefined)
  return uname?.stdout.trim() === 'Darwin' ? 'mac' : 'linux'
}

async function homeOf($: $) {
  return (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
}

async function findFolder($: $, places: string[]) {
  for (const place of places) {
    const stat = await $.fs.stat(place, { resolve: true }).catch(() => undefined)
    if (stat?.kind === 'dir') return stat.realPath ?? place
  }
  return undefined
}

// True when the first argv that starts exits cleanly; wt and start return
// as soon as the window is up, so the session itself is never waited on.
async function runFirst($: $, argvs: string[][], cwd: string) {
  for (const argv of argvs) {
    const ran = await $.process.run(argv, { cwd, timeoutMs: 15000 }).catch(() => undefined)
    if (ran?.exitCode === 0) return argv[0]
  }
  return undefined
}

export const register: Register = (on, options) => {
  const launcher = (options.launcher as Launcher | undefined) ?? 'terminal'
  const roots = (options.roots as string | undefined) ?? ''
  const kind = (options.kind as Kind | undefined) ?? 'server'

  on('session.start', async ($, e, next) => {
    const spec = {
      description: 'Start a fresh Remote Control session in auto mode, here or in [folder]',
      argumentHint: '[folder]',
      immediate: true,
    } as const
    await $.command.register({ name: 'fresh-session', ...spec })
    await $.command.register({ name: 'fs', ...spec })
    return next(e)
  })

  on('command.run', { command: ['fresh-session', 'fs'] }, async ($, e) => {
    const cwd = await $.session.cwd()
    const arg = (e.args ?? '').trim()
    const places = arg ? candidates(arg, cwd, await homeOf($), roots) : [cwd]
    const folder = await findFolder($, places)
    if (!folder) return { text: `No folder "${unquote(arg)}". Looked in:\n${places.map(p => `  ${p}`).join('\n')}` }

    const os = await osOf($)
    const name = sessionName(folder)
    // The desktop link only opens the new-session screen: somebody at this
    // machine has to send it, so a remote device always gets a terminal too.
    const { wantsDesktop, wantsTerminal } = plan(launcher, e.origin?.kind === 'bridge')

    const done: string[] = []
    let isDesktopOpen = false
    if (wantsDesktop) {
      isDesktopOpen = (await runFirst($, [desktopArgv(os, desktopUrl(folder))], cwd)) !== undefined
      if (isDesktopOpen) done.push(`Opened a new desktop session for ${folder}; send its first message there.`)
    }
    if (wantsTerminal || !isDesktopOpen) {
      const claudes = claudeArgvs(kind, name)
      const used = await runFirst($, terminalArgvs(os, folder, name, claudes), folder)
      if (!used) {
        return { text: `Could not open a terminal for ${folder}. Run this there:\n  ${claudes[0].join(' ')}` }
      }
      const fallback = claudes.length > 1
        ? ' If a remote-control server already serves this folder, an interactive Remote Control session starts instead after about a minute.'
        : ''
      done.push(`Started a fresh session in ${folder} (${used}: ${claudes[0].join(' ')}). It shows up in claude.ai/code and the mobile app once it connects.${fallback}`)
    }
    return { text: done.join('\n') }
  }).catch(($, e, next) => ({ text: `/${e.command} failed: ${next.error.message ?? next.error.kind}` }))
}
