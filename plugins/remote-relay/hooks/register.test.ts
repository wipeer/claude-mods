import { expect, mock, test } from 'claude-code/testing'
import type { Register, TestBody } from 'claude-code'

import { statusShape, statusTopic } from './register'

test('a countdown keeps its shape as the numbers move', () => {
  expect(statusShape('keepwarm 3h00m left · ping in 50m')).toBe(statusShape('keepwarm 2h59m left · ping in 9m'))
  expect(statusShape('cold write $1.17 for 116,903 tokens')).toBe(statusShape('cold write $0.06 for 2,000 tokens'))
})

test('a change of state is a new shape', () => {
  expect(statusShape('keepwarm 3h00m left · ping in 50m')).not.toBe(statusShape('keepwarm 3h00m left · cold now, first ping 50m after the next turn'))
  expect(statusShape('keepwarm 3h00m left')).not.toBe(statusShape('keepwarm stopped: window ended'))
})

test('the first word is the topic', () => {
  expect(statusTopic('keepwarm 3h00m left · ping in 50m')).toBe('keepwarm')
  expect(statusTopic('keepwarm stopped: out of budget')).toBe('keepwarm')
})

test('/relay says what it mirrors', async $ => {
  const result = await $.command.run({ command: 'relay', args: '' } as never)
  expect(JSON.stringify(result)).toContain('remote-relay')
})

const turn = { reason: 'answer', answer: 'done', isAborted: false, turnId: 't1', durationMs: 1000 } as never
const appended = (s: ReturnType<typeof mock.session>) => s.appended().map(r => JSON.stringify(r.message.content)).join('\n')

// A mod beneath the relay that pins its args as a status line on /pin.
const pinner = {
  name: 'pinner',
  register(on: Parameters<Register>[0]) {
    on('command.run', { command: 'pin' }, async ($, e) => {
      $.ui.status(e.args || undefined)
      return { text: '' }
    })
  },
}
const pin = ($: Parameters<TestBody>[0], text: string) => $.command.run({ command: 'pin', args: text } as never)

test('with digest reply, each reply posts the pinned lines', { plugins: [pinner], options: { digest: 'reply' } }, async ($, on) => {
  const session = mock.session(on)
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('clock.now', () => ({ value: Date.now() }) as never)
  await pin($, 'keepwarm 3h00m left · ping in 50m')
  await $.turn.complete(turn)
  await pin($, 'keepwarm 2h59m left · ping in 49m')
  await $.turn.complete(turn)
  expect(appended(session)).toContain('2h59m')
  expect(appended(session).match(/keepwarm/g)).toHaveLength(3)
})

test('a cleared line leaves the digest', { plugins: [pinner], options: { digest: 'reply' } }, async ($, on) => {
  const session = mock.session(on)
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('clock.now', () => ({ value: Date.now() }) as never)
  await pin($, 'keepwarm 3h00m left · ping in 50m')
  await pin($, '')
  await $.turn.complete(turn)
  expect(appended(session).match(/keepwarm/g)).toHaveLength(1)
})

test('without digest, a reply posts nothing', { plugins: [pinner] }, async ($, on) => {
  const session = mock.session(on)
  on('turn.complete', () => ({ text: '' }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('clock.now', () => ({ value: Date.now() }) as never)
  await pin($, 'keepwarm 3h00m left · ping in 50m')
  await $.turn.complete(turn)
  await $.turn.complete(turn)
  expect(appended(session).match(/keepwarm/g)).toHaveLength(1)
})
