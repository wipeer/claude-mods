import { expect, test } from 'claude-code/testing'

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
