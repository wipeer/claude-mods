import type { EngineInterface, Register } from 'claude-code'

/** The project a cwd belongs to: its last segment, seen through worktrees; null for a scratch (no folder) session. */
export function folderOf(cwd: string): string | null {
  const parts = cwd.replace(/\\/g, '/').split('/').filter(Boolean)
  const wt = parts.lastIndexOf('worktrees')
  if (wt >= 2 && parts[wt - 1] === '.claude') return parts[wt - 2]
  if (parts.includes('scratch-workspaces')) return null
  return parts[parts.length - 1] ?? 'root'
}

export function prefixed(folder: string, title: string): string {
  const head = `${folder} - `
  return title.startsWith(head) ? title : head + title
}

const APP = 'ccd_session_mgmt'

function textOf(r: { content: { type: string; text?: string }[]; isError: boolean }): string {
  return r.content.map(b => b.text ?? '').join('\n')
}

/** The desktop app's own title for this session; undefined outside the app. */
async function appTitle($: EngineInterface): Promise<string | undefined> {
  const r = await $.mcp.call(APP, 'get_session', { session_id: 'self' })
  if (r.isError) throw new Error(textOf(r))
  return JSON.parse(textOf(r)).title
}

/**
 * The sidebar reads the app's own title store, not the CLI's, so mirror the prefix there.
 * Returns what happened, for /folder-title.
 */
async function syncApp($: EngineInterface, folder: string): Promise<string> {
  const current = await appTitle($)
  if (!current) return 'app: no title yet'
  const title = prefixed(folder, current)
  if (title === current) return `app: already "${current}"`
  const r = await $.mcp.call(APP, 'set_session_title', { session_id: 'self', title })
  return r.isError ? `app: rename failed: ${textOf(r)}` : `app: "${current}" -> "${title}"`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'folder-title', description: 'Prefix this session title with its folder and show debug info' })
    return next(e)
  })

  on('command.run', { command: 'folder-title' }, async $ => {
    const cwd = await $.session.cwd()
    const folder = folderOf(cwd)
    const lines = [`cwd: ${cwd}`, `folder: ${folder ?? '(none - title left alone)'}`]
    try {
      if (folder) lines.push(await syncApp($, folder))
      else lines.push(`app title: "${await appTitle($)}"`)
    } catch (err) {
      lines.push(`app: unreachable (${err instanceof Error ? err.message : String(err)})`)
    }
    return { text: lines.join('\n') }
  })

  // Resumed / restarted sessions: prefix the title they already have.
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    const folder = folderOf(e.cwd)
    if (!e.session_title || e.agent_type || !folder) return result
    const title = prefixed(folder, e.session_title)
    return title === e.session_title ? result : { ...result, sessionTitle: title }
  }).catch(($, e, next) => next(e))

  on('classic.UserPromptSubmit', async ($, e, next) => {
    const result = await next(e)
    if (e.agent_id || (e.source && e.source !== 'user' && e.source !== 'sdk')) return result
    // No folder yet: leave the title alone; a later prompt prefixes it once the session has a folder.
    const folder = folderOf(e.cwd)
    if (!folder) return result
    void syncApp($, folder).catch(() => {})
    if (result.sessionTitle) return { ...result, sessionTitle: prefixed(folder, result.sessionTitle) }

    // First prompt has no title yet: the app names the session itself, and the next prompt prefixes that.
    if (!e.session_title) return result
    const title = prefixed(folder, e.session_title)
    return title === e.session_title ? result : { ...result, sessionTitle: title }
  }).catch(($, e, next) => next(e))
}
