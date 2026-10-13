import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// Beneath the plugin: Bash "runs", and the question is answered with `reply`.
function world(on: On, reply: string) {
  const asked: string[] = []
  on('session.cwd', () => ({ value: '/work' }) as never)
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const question = e.questions[0]!.question
    asked.push(question)
    return { result: { questions: e.questions, answers: { [question]: reply } } } as never
  })
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ran', stderr: '', interrupted: false } }) as never)
  return asked
}

const rm = { tool: 'Bash', tool_use_id: 'toolu_1', command: 'rm -rf build' } as never

test('with no screen, Proceed in the question runs the command', async ($, on) => {
  const session = mock.session(on)
  const asked = world(on, 'Proceed')
  const result = await $.tool.call(rm)
  expect(JSON.stringify(result)).toContain('ran')
  expect(asked[0]).toContain('rm -rf build')
  const notices = session.appended().map(r => JSON.stringify(r.message.content))
  expect(notices.join()).toContain('Blast Radius is holding: rm -rf build')
})

test('Cancel in the question refuses it', async ($, on) => {
  mock.session(on)
  world(on, 'Cancel')
  const result = await $.tool.call(rm)
  expect(JSON.stringify(result)).toContain('the user pressed Cancel')
})

test('a typed answer refuses it and passes the answer on', async ($, on) => {
  mock.session(on)
  world(on, 'only delete build/tmp')
  const result = await $.tool.call(rm)
  expect(JSON.stringify(result)).toContain('only delete build/tmp')
})

test('a safe command is not held', async ($, on) => {
  const asked = world(on, 'Cancel')
  const result = await $.tool.call({ tool: 'Bash', tool_use_id: 'toolu_2', command: 'ls -la' } as never)
  expect(JSON.stringify(result)).toContain('ran')
  expect(asked).toHaveLength(0)
})
