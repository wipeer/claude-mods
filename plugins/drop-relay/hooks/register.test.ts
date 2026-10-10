import { expect, mock, test } from 'claude-code/testing'

type Session = ReturnType<typeof mock.session>
const notices = (s: Session) =>
  s.appended().filter(r => r.message.type === 'system').map(r => JSON.stringify(r.message.content))

test('a dropped prompt leaves a notice with the reason', async ($, on) => {
  const session = mock.session(on)
  on('prompt.submit', () => ({ drop: 'cache-tax: cache is cold' }))
  const result = await $.prompt.submit({ text: 'hello' })
  expect(result).toEqual({ drop: 'cache-tax: cache is cold' })
  expect(notices(session).join()).toContain('Prompt not sent. cache-tax: cache is cold')
})

test('a prompt that goes through leaves no notice', async ($, on) => {
  const session = mock.session(on)
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.prompt.submit({ text: 'hello' })
  expect(notices(session)).toHaveLength(0)
})
