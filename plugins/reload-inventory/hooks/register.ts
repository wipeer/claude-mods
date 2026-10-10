import type { Register, EngineInterface } from 'claude-code'

type $ = EngineInterface
type Status = 'enabled' | 'disabled' | 'dev'
type Row = { name: string; version?: string; source: string; status: Status }

const PLUGIN_COMMANDS = new Set(['reload-plugins', 'reload_plugins'])
const SKILL_COMMANDS = new Set(['reload-skills', 'reload_skills'])

const join = (...parts: string[]) =>
  parts
    .join('/')
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg, i) => seg !== '' || i === 0)
    .join('/')

async function readJson($: $, path: string): Promise<any> {
  try {
    return JSON.parse(await $.fs.read(path))
  } catch {
    return undefined
  }
}

async function listDirs($: $, path: string): Promise<string[]> {
  try {
    return (await $.fs.list(path)).filter(d => d.kind === 'dir').map(d => d.name)
  } catch {
    return []
  }
}

async function claudeHome($: $): Promise<string> {
  const configDir = await $.env.get('CLAUDE_CONFIG_DIR')
  if (configDir) return configDir
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
  return join(home, '.claude')
}

type Installed = { id: string; installPath: string; version?: string; enabled: boolean }

// enabledPlugins layers like the rest of settings: user, then project, then local.
async function enabledPlugins($: $, home: string): Promise<Record<string, boolean>> {
  const cwd = await $.session.cwd()
  const layers = [
    join(home, 'settings.json'),
    join(cwd, '.claude', 'settings.json'),
    join(cwd, '.claude', 'settings.local.json'),
  ]
  const enabled: Record<string, boolean> = {}
  for (const path of layers) Object.assign(enabled, (await readJson($, path))?.enabledPlugins)
  return enabled
}

async function installedPlugins($: $, home: string): Promise<Installed[]> {
  const file = await readJson($, join(home, 'plugins', 'installed_plugins.json'))
  const enabled = await enabledPlugins($, home)
  const out: Installed[] = []
  for (const [id, entries] of Object.entries<any>(file?.plugins ?? {})) {
    const list = Array.isArray(entries) ? entries : [entries]
    for (const entry of list) {
      out.push({ id, installPath: entry.installPath, version: entry.version, enabled: enabled[id] === true })
    }
  }
  return out
}

async function pluginRows($: $): Promise<Row[]> {
  const home = await claudeHome($)
  const rows: Row[] = []

  for (const p of await installedPlugins($, home)) {
    const manifest = await readJson($, join(p.installPath, '.claude-plugin', 'plugin.json'))
    const [name, marketplace] = p.id.split('@')
    rows.push({
      name,
      version: manifest?.version ?? p.version,
      source: marketplace ?? 'installed',
      status: p.enabled ? 'enabled' : 'disabled',
    })
  }

  // When loaded as a dev mod, its siblings are this session's other dev mods.
  const root = join($.plugin.root)
  if (root.includes('/dev-mods/')) {
    const devRoot = join(root, '..')
    for (const dir of await listDirs($, devRoot)) {
      const manifest = await readJson($, join(devRoot, dir, '.claude-plugin', 'plugin.json'))
      if (manifest) rows.push({ name: manifest.name ?? dir, version: manifest.version, source: 'dev mod', status: 'dev' })
    }
  }
  return rows
}

function frontmatter(text: string): Record<string, string> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const out: Record<string, string> = {}
  if (!m) return out
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^\s*([\w-]+):\s*(.*?)\s*$/.exec(line)
    if (kv && kv[2] && !(kv[1] in out)) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '')
  }
  return out
}

// A skill is a folder holding SKILL.md; look up to two levels deeper for grouped
// folders (skills/synced/<session>/<skill>), skipping hidden ones like .trash.
async function skillsIn($: $, root: string, source: string, depth = 0): Promise<Row[]> {
  const rows: Row[] = []
  for (const dir of await listDirs($, root)) {
    if (dir.startsWith('.')) continue
    const path = join(root, dir)
    let text: string | undefined
    try {
      text = await $.fs.read(join(path, 'SKILL.md'))
    } catch {}
    if (text !== undefined) {
      const fm = frontmatter(text)
      rows.push({ name: fm.name ?? dir, version: fm.version, source, status: 'enabled' })
    } else if (depth < 2) {
      rows.push(...(await skillsIn($, path, source, depth + 1)))
    }
  }
  return rows
}

async function skillRows($: $): Promise<Row[]> {
  const home = await claudeHome($)
  const rows: Row[] = [
    ...(await skillsIn($, join(home, 'skills'), 'User')),
    ...(await skillsIn($, join(await $.session.cwd(), '.claude', 'skills'), 'Project')),
  ]
  for (const p of await installedPlugins($, home)) {
    if (!p.enabled) continue
    const name = p.id.split('@')[0]
    rows.push(...(await skillsIn($, join(p.installPath, 'skills'), `Plugin ${name}`)))
  }
  // Synced copies from several sessions repeat the same skill.
  const seen = new Set<string>()
  return rows.filter(r => {
    const key = `${r.name}|${r.version}|${r.source}`
    return seen.has(key) ? false : (seen.add(key), true)
  })
}

// The desktop app shows this text in a proportional font and collapses runs of
// spaces, so nothing here relies on column alignment or indentation.
const ICON: Record<Status, string> = { enabled: '✅', disabled: '⏸️', dev: '🛠️' }
const byName = (a: Row, b: Row) => a.name.localeCompare(b.name)
const ver = (r: Row) => (r.version ? ` v${r.version.replace(/^v/, '')}` : '')

function pluginReport(rows: Row[]): string {
  if (rows.length === 0) return '📦 Plugins: none found'
  const count = (s: Status) => rows.filter(r => r.status === s).length
  const tally = [
    `${count('enabled')} enabled`,
    count('disabled') && `${count('disabled')} disabled`,
    count('dev') && `${count('dev')} dev`,
  ].filter(Boolean)
  const order: Status[] = ['enabled', 'dev', 'disabled']
  const sorted = [...rows].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || byName(a, b))
  const lines = sorted.map(r => `${ICON[r.status]} ${r.name}${ver(r)} · ${r.source}`)
  return [`📦 Plugins — ${tally.join(', ')}`, ...lines].join('\n')
}

function skillReport(rows: Row[]): string {
  if (rows.length === 0) return '🧩 Skills: none found'
  const groups = new Map<string, Row[]>()
  for (const r of rows) groups.set(r.source, [...(groups.get(r.source) ?? []), r])
  const rank = (s: string) => (s === 'User' ? 0 : s === 'Project' ? 1 : 2)
  const lines = [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([source, list]) => `▸ ${source} (${list.length}): ${[...list].sort(byName).map(r => r.name + ver(r)).join(', ')}`)
  return [`🧩 Skills — ${rows.length} found`, ...lines].join('\n')
}

export const register: Register = on => {
  on('command.run', async ($, e, next) => {
    const isPlugins = PLUGIN_COMMANDS.has(e.command)
    const isSkills = SKILL_COMMANDS.has(e.command)
    if (!isPlugins && !isSkills) return next(e)

    const ran = await next(e)
    try {
      const listing = isPlugins ? pluginReport(await pluginRows($)) : skillReport(await skillRows($))
      return { ...ran, text: [ran.text, listing].filter(Boolean).join('\n\n') }
    } catch (err) {
      return { ...ran, text: [ran.text, `${$.plugin.name}: listing failed: ${err}`].filter(Boolean).join('\n\n') }
    }
  }).catch(($, e, next) => next(e))
}
