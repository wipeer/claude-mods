import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

// Beneath the plugin: the context window holds `tokens.value` of 200k.
function usage(on: On) {
  const tokens = { value: 0 }
  on('session.usage', () => ({ value: { context: { tokens: tokens.value, window: 200_000, percent: (tokens.value / 200_000) * 100 } } }) as never)
  on('session.start', () => ({ cwd: '/work' }) as never)
  on('command.register', ($, e) => ({ value: { command: e.name } }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  return tokens
}

const notices = (s: ReturnType<typeof mock.session>) =>
  s.appended().map(r => JSON.stringify(r.message.content)).join('\n')

const turn = { reason: 'answer', answer: 'done', isAborted: false, turnId: 't1', durationMs: 1000 } as never

test('with no screen, a new forecast is posted once', async ($, on) => {
  const session = mock.session(on)
  const tokens = usage(on)
  await $.session.start({ source: 'startup', cwd: '/work' } as never)
  tokens.value = 20_000
  await $.turn.complete(turn)
  expect(notices(session)).toBe('')
  tokens.value = 60_000
  await $.turn.complete(turn)
  expect(notices(session)).toContain('Cloudy')
  tokens.value = 70_000
  await $.turn.complete(turn)
  expect(notices(session).match(/Cloudy/g)).toHaveLength(1)
})

test('/weather reads the forecast out', async ($, on) => {
  mock.session(on)
  const tokens = usage(on)
  await $.session.start({ source: 'startup', cwd: '/work' } as never)
  tokens.value = 160_000
  await $.turn.complete(turn)
  const result = await $.command.run({ command: 'weather', args: '' } as never)
  expect(JSON.stringify(result)).toContain('Storm')
})
