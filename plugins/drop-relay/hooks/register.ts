import type { Register } from 'claude-code'

// The local terminal shows a hook's drop as a dialog that never reaches
// Remote Control: a phone sees its prompt and a spinner. A system notice is a
// transcript row, so every attached surface gets it; the model never reads it.
export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    const result = await next(e)
    if (result.drop === undefined) return result

    try {
      await $.session.append({
        message: { type: 'system', content: [{ type: 'text', text: `Prompt not sent. ${result.drop}` }] },
      })
    } catch {
      $.ui.toast(`Prompt not sent. ${result.drop}`, { timeoutMs: 10000 })
    }

    return result
  })
}
