# folder-title

Adds the project folder to the front of every Claude Code session title:

```
Fix dice roll          ->  catan - Fix dice roll
Board UI               ->  karak - Board UI
```

When you have sessions open in several projects, the desktop sidebar shows which one each belongs to.

## How it works

- **The folder** is the last part of the session's working directory. Inside a worktree (`<project>/.claude/worktrees/<name>`) it is the project's name, not the worktree's. Scratch sessions with no folder are left alone.
- **New sessions:** the app names a session after its first prompt. The mod adds the prefix on your next prompt.
- **Resumed sessions** get the prefix when they start.
- **Desktop app:** the sidebar keeps its own copy of the title, so the mod updates that copy too, through the app's session tools.
- The prefix is never added twice, and subagent and automated prompts are skipped.

## Command

`/folder-title` adds the prefix right away and prints what it found, which helps when something looks off:

```
cwd: C:\_projects\trains
folder: trains
app: "Rail import" -> "trains - Rail import"
```

## Install

```
/plugin install folder-title --marketplace wipeer/claude-mods
```
