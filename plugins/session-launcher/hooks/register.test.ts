import { describe, expect, mock, test } from 'claude-code/testing'
import { candidates, claudeArgvs, desktopUrl, parentOf, plan, terminalArgvs } from './register'

const dirs = new Set(['C:\\_projects\\claude-mods', 'C:\\_projects\\catan'])

function windows(on: Parameters<Parameters<typeof test>[1]>[1], runs: string[][], failing: string[] = []) {
  mock.env(on, { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\me' })
  on('session.cwd', () => ({ value: 'C:\\_projects\\claude-mods' }))
  on('fs.stat', ($, e) => {
    if (!dirs.has(e.path)) throw new Error('ENOENT')
    return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false, realPath: e.path } }
  })
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    return { value: { exitCode: failing.includes(e.argv[0]) ? 1 : 0, stdout: '', stderr: '' } }
  })
}

describe('session-launcher', () => {
  test('folder candidates', () => {
    expect(parentOf('C:\\_projects\\claude-mods')).toBe('C:\\_projects')
    expect(parentOf('C:\\_projects')).toBe('C:\\')
    expect(parentOf('/home/me/x')).toBe('/home/me')
    expect(candidates('catan', 'C:\\_projects\\claude-mods', undefined, 'D:\\work')).toEqual([
      'C:\\_projects\\claude-mods\\catan',
      'C:\\_projects\\catan',
      'D:\\work\\catan',
    ])
    expect(candidates('"D:\\a b"', 'C:\\x', undefined, '')).toEqual(['D:\\a b'])
    expect(candidates('~/code', '/home/me/x', '/home/me', '')).toEqual(['/home/me/code'])
  })

  test('remote always gets a terminal, never the desktop screen', () => {
    expect(plan('desktop', true)).toEqual({ wantsDesktop: false, wantsTerminal: true })
    expect(plan('desktop', false)).toEqual({ wantsDesktop: true, wantsTerminal: false })
    expect(plan('terminal', false)).toEqual({ wantsDesktop: false, wantsTerminal: true })
    expect(plan('both', false)).toEqual({ wantsDesktop: true, wantsTerminal: true })
  })

  test('terminal argv is a remote, auto session in the folder', () => {
    const SERVER = ['claude', 'remote-control', '--permission-mode', 'auto', '--name', 'catan']
    const INTERACTIVE = ['claude', '--permission-mode', 'auto', '--remote-control', 'catan']
    expect(claudeArgvs('server', 'catan')).toEqual([SERVER, INTERACTIVE])
    expect(claudeArgvs('interactive', 'catan')).toEqual([INTERACTIVE])
    const [wt, start] = terminalArgvs('windows', 'C:\\_projects\\catan', 'catan', [SERVER, INTERACTIVE])
    expect(wt).toEqual(['wt.exe', '-w', 'new', '--title', 'catan', '-d', 'C:\\_projects\\catan', 'cmd.exe', '/c', ...SERVER, '||', ...INTERACTIVE])
    expect(start).toContain('^|^|')
    expect(terminalArgvs('windows', 'C:\\x', 'x', [INTERACTIVE])[0].slice(7)).toEqual(INTERACTIVE)
    const [mac] = terminalArgvs('mac', "/Users/me/it's", 'its', [SERVER, INTERACTIVE])
    expect(mac[2]).toContain(`cd '/Users/me/it'\\\\''s' && { 'claude' 'remote-control' '--permission-mode' 'auto' '--name' 'catan' || 'claude' '--permission-mode'`)
    expect(desktopUrl('C:\\a b')).toBe('claude://code/new?folder=C%3A%5Ca%20b')
  })

  test('/fs with no folder starts in the session folder', async ($, on) => {
    const runs: string[][] = []
    windows(on, runs)
    const r = await $.command.run({ command: 'fs' })
    expect(runs).toHaveLength(1)
    expect(runs[0].slice(0, 7)).toEqual(['wt.exe', '-w', 'new', '--title', 'claude-mods', '-d', 'C:\\_projects\\claude-mods'])
    expect(r.text).toContain('Started a fresh session in C:\\_projects\\claude-mods')
    expect(runs[0].slice(7, 15)).toEqual(['cmd.exe', '/c', 'claude', 'remote-control', '--permission-mode', 'auto', '--name', 'claude-mods'])
  })

  test('interactive kind runs claude --remote-control', { options: { kind: 'interactive' } }, async ($, on) => {
    const runs: string[][] = []
    windows(on, runs)
    await $.command.run({ command: 'fs' })
    expect(runs[0].slice(7)).toEqual(['claude', '--permission-mode', 'auto', '--remote-control', 'claude-mods'])
  })

  test('/fresh-session <name> finds a sibling folder and falls back to start', async ($, on) => {
    const runs: string[][] = []
    windows(on, runs, ['wt.exe'])
    const r = await $.command.run({ command: 'fresh-session', args: 'catan' })
    expect(runs.map(a => a[0])).toEqual(['wt.exe', 'cmd.exe'])
    expect(runs[1]).toContain('C:\\_projects\\catan')
    expect(r.text).toContain('(cmd.exe: claude remote-control --permission-mode auto --name catan)')
  })

  test('an unknown folder lists where it looked', async ($, on) => {
    const runs: string[][] = []
    windows(on, runs)
    const r = await $.command.run({ command: 'fs', args: 'nope' })
    expect(runs).toHaveLength(0)
    expect(r.text).toContain('No folder "nope"')
    expect(r.text).toContain('C:\\_projects\\nope')
  })

  test('desktop launcher opens the new-session link', { options: { launcher: 'desktop' } }, async ($, on) => {
    const runs: string[][] = []
    windows(on, runs)
    const r = await $.command.run({ command: 'fs', args: 'catan' })
    expect(runs).toEqual([['rundll32.exe', 'url.dll,FileProtocolHandler', 'claude://code/new?folder=C%3A%5C_projects%5Ccatan']])
    expect(r.text).toContain('Opened a new desktop session')
  })

  test('desktop launcher falls back to a terminal', { options: { launcher: 'desktop' } }, async ($, on) => {
    const runs: string[][] = []
    windows(on, runs, ['rundll32.exe'])
    const r = await $.command.run({ command: 'fs' })
    expect(runs.map(a => a[0])).toEqual(['rundll32.exe', 'wt.exe'])
    expect(r.text).toContain('Started a fresh session')
  })
})
