import { describe, expect, test } from 'claude-code/testing'
import { folderOf, prefixed } from './register'

describe('folder-title', () => {
  test('folder from path', () => {
    expect(folderOf('C:\\_projects\\catan')).toBe('catan')
    expect(folderOf('C:/_projects/karak/.claude/worktrees/fix-x')).toBe('karak')
    expect(folderOf('C:/Users/a/AppData/Roaming/Claude/scratch-workspaces/x/y/scratch-1')).toBeNull()
  })

  test('prefix once', () => {
    expect(prefixed('catan', 'Fix dice')).toBe('catan - Fix dice')
    expect(prefixed('catan', 'catan - Fix dice')).toBe('catan - Fix dice')
  })

  test('resumed session gets prefixed', async ($, on) => {
    on('classic.SessionStart', () => ({}))
    const r = await $.classic.SessionStart({ source: 'resume', session_title: 'Fix dice', cwd: 'C:\\_projects\\catan' })
    expect(r.sessionTitle).toBe('catan - Fix dice')
  })

  test('existing title on a later prompt gets prefixed', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    const r = await $.classic.UserPromptSubmit({ prompt: 'more', source: 'user', session_title: 'Board UI', cwd: 'C:\\_projects\\karak' })
    expect(r.sessionTitle).toBe('karak - Board UI')
  })

  test('first prompt leaves the title to the app', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    const r = await $.classic.UserPromptSubmit({ prompt: 'the dice roll is broken', source: 'user', cwd: 'C:\\_projects\\catan' })
    expect(r.sessionTitle).toBeUndefined()
  })

  test('no folder leaves the title alone', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}))
    const r = await $.classic.UserPromptSubmit({ prompt: 'more', source: 'user', session_title: 'Board UI', cwd: 'C:/Users/a/AppData/Roaming/Claude/scratch-workspaces/x/y/scratch-1' })
    expect(r.sessionTitle).toBeUndefined()
  })

  test('/folder-title renames the app title and reports it', async ($, on) => {
    const renamed: unknown[] = []
    on('session.cwd', () => ({ value: 'C:/_projects/trains' }))
    on('mcp.call', (_, e) => {
      if (e.tool === 'set_session_title') renamed.push(e.args)
      const text = e.tool === 'get_session' ? JSON.stringify({ title: 'Rail import' }) : 'ok'
      return { value: { content: [{ type: 'text', text }], isError: false } }
    })
    const r = await $.command.run({ command: 'folder-title', args: '' })
    expect(renamed).toEqual([{ session_id: 'self', title: 'trains - Rail import' }])
    expect(r.text).toContain('app: "Rail import" -> "trains - Rail import"')
  })
})
