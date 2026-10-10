import { test, expect } from 'claude-code/testing'

const FILES: Record<string, string> = {
  '/home/plugins/installed_plugins.json': JSON.stringify({
    version: 2,
    plugins: {
      'alpha@mkt': [{ installPath: '/cache/alpha/1.0.0', version: '1.0.0' }],
      'beta@mkt': [{ installPath: '/cache/beta/0.3.0', version: '0.3.0' }],
    },
  }),
  '/home/settings.json': JSON.stringify({ enabledPlugins: { 'alpha@mkt': true } }),
  '/cache/alpha/1.0.0/.claude-plugin/plugin.json': JSON.stringify({ name: 'alpha', version: '1.0.1' }),
  '/home/skills/writer/SKILL.md': '---\nname: writer\nversion: 2.0.0\ndescription: x\n---\nbody',
  '/home/skills/group/inner/SKILL.md': '---\nname: inner\n---\nbody',
  '/home/skills/synced/s1/pdf/SKILL.md': '---\nname: pdf\n---\n',
  '/home/skills/synced/s2/pdf/SKILL.md': '---\nname: pdf\n---\n',
  '/home/skills/.trash/x/old/SKILL.md': '---\nname: old\n---\n',
  '/cache/alpha/1.0.0/skills/lint/SKILL.md': '---\nname: lint\nversion: 0.9\n---\n',
  '/proj/.claude/skills/deploy/SKILL.md': '---\nname: deploy\n---\n',
}

// The engine hands hooks native paths (C:\home\... on Windows); compare in posix form.
const norm = (p: string) => p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')

const dirsOf = (raw: string) => {
  const path = norm(raw)
  const prefix = path.endsWith('/') ? path : path + '/'
  const names = new Set<string>()
  for (const f of Object.keys(FILES)) if (f.startsWith(prefix)) names.add(f.slice(prefix.length).split('/')[0])
  return [...names]
    .filter(n => !FILES[prefix + n])
    .map(name => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false }))
}

const fakeHome = (on: any) => {
  on('env.get', ($: any, e: any) => ({ value: e.name === 'CLAUDE_CONFIG_DIR' ? '/home' : undefined }))
  on('fs.read', ($: any, e: any) => {
    const path = norm(e.path)
    return path in FILES ? { value: FILES[path] } : { deny: 'ENOENT ' + path }
  })
  on('fs.list', ($: any, e: any) => ({ value: dirsOf(e.path) }))
  on('session.cwd', () => ({ value: '/proj' }))
  on('command.run', () => ({ text: 'Reloaded.' }))
}

test('appends the plugin list after /reload-plugins', async ($, on) => {
  fakeHome(on)
  const { text } = await $.command.run({ command: 'reload-plugins', args: '' })
  expect(text).toContain('Reloaded.')
  expect(text).toContain('📦 Plugins — 1 enabled, 1 disabled')
  expect(text).toContain('✅ alpha v1.0.1 · mkt')
  expect(text).toContain('⏸️ beta v0.3.0 · mkt')
  expect(text!.indexOf('alpha')).toBeLessThan(text!.indexOf('beta'))
})

test('appends the skill list after /reload-skills', async ($, on) => {
  fakeHome(on)
  const { text } = await $.command.run({ command: 'reload_skills', args: '' })
  expect(text).toContain('🧩 Skills — 5 found')
  expect(text).toContain('▸ Project (1): deploy')
  expect(text).toContain('▸ User (3): inner, pdf, writer v2.0.0')
  expect(text).toContain('▸ Plugin alpha (1): lint v0.9')
  expect(text).not.toContain('old')
})

test('project settings override user enablement', async ($, on) => {
  FILES['/proj/.claude/settings.local.json'] = JSON.stringify({ enabledPlugins: { 'alpha@mkt': false, 'beta@mkt': true } })
  try {
    fakeHome(on)
    const { text } = await $.command.run({ command: 'reload-plugins', args: '' })
    expect(text).toContain('⏸️ alpha v1.0.1 · mkt')
    expect(text).toContain('✅ beta v0.3.0 · mkt')
  } finally {
    delete FILES['/proj/.claude/settings.local.json']
  }
})

test('leaves other commands alone', async ($, on) => {
  on('command.run', () => ({ text: 'other' }))
  const { text } = await $.command.run({ command: 'help', args: '' })
  expect(text).toBe('other')
})
