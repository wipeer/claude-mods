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

test('with cadence change, a new forecast is posted once', { options: { cadence: 'change' } }, async ($, on) => {
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

test('by default, every reply posts the forecast', async ($, on) => {
  const session = mock.session(on)
  const tokens = usage(on)
  await $.session.start({ source: 'startup', cwd: '/work' } as never)
  tokens.value = 20_000
  await $.turn.complete(turn)
  tokens.value = 22_000
  await $.turn.complete(turn)
  expect(notices(session).match(/Clear/g)).toHaveLength(2)
})

test('/ww is /weather', async ($, on) => {
  mock.session(on)
  const tokens = usage(on)
  await $.session.start({ source: 'startup', cwd: '/work' } as never)
  tokens.value = 160_000
  await $.turn.complete(turn)
  const weather = await $.command.run({ command: 'weather', args: '' } as never)
  const ww = await $.command.run({ command: 'ww', args: '' } as never)
  expect(ww).toEqual(weather)
})

test('/wch stacks on a part answered beneath and drops a foreign answer', async ($, on) => {
  mock.session(on)
  const tokens = usage(on)
  let below = 'cache-tax\nstate       warm'
  on('command.run', { command: 'wch' }, () => ({ text: below }))
  await $.session.start({ source: 'startup', cwd: '/work' } as never)
  tokens.value = 20_000
  await $.turn.complete(turn)
  const both = JSON.stringify(await $.command.run({ command: 'wch', args: '' } as never))
  expect(both).toContain('Clear')
  expect(both).toContain('state       warm')
  below = 'No hook answered /wch'
  const alone = JSON.stringify(await $.command.run({ command: 'wch', args: '' } as never))
  expect(alone).toContain('Clear')
  expect(alone).not.toContain('No hook')
})

test('/w-help merges the command lines beneath', async ($, on) => {
  mock.session(on)
  usage(on)
  on('command.run', { command: 'w-help' }, () => ({ text: 'w-mods slash commands\n/keepwarm  (/wkw)  keep warm\n/wch  /wct and /ww at once' }))
  await $.session.start({ source: 'startup', cwd: '/work' } as never)
  const text = String((await $.command.run({ command: 'w-help', args: '' } as never)).text)
  expect(text).toContain('/weather  (/ww)')
  expect(text).toContain('/keepwarm  (/wkw)')
  expect(text.match(/\/wch/g)).toHaveLength(1)
})
