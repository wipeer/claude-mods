# drop-relay

When a hook blocks a prompt (for example cache-tax refusing a cold-cache send), Claude Code shows the reason in a dialog on the machine running the session. A device connected over Remote Control never gets that dialog: it shows your prompt and a spinner that never ends.

drop-relay writes the reason into the conversation as a notice, so every device sees it:

```
Prompt not sent. cache-tax: the prompt cache went cold 18m ago. ...
```

## How it works

- It runs on every prompt you submit. When a hook beneath it drops the prompt, it adds a system notice with the hook's reason.
- Notices are shown to you, never to the model, so nothing is added to the conversation's context.
- If the notice cannot be added, it falls back to a toast on the local screen.
- On the local machine you see the reason twice: in the dialog and as a notice.

**Limitation:** it only sees blocks from hooks that run beneath it. Mods you install yourself share a tier and their order is not documented, so if a blocking mod runs first, drop-relay never hears about the block.

## Install

```
/plugin install drop-relay --marketplace wipeer/claude-mods
```
