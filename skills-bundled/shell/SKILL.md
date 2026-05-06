---
name: shell
description: Raw shell command execution. Disabled by default — enable explicitly when the model needs to operate outside a structured studio CLI.
version: 0.1.0
whenToUse: Only when no structured tool can accomplish the task. Always echo back the exact command the model intends to run.
instructions: |
  - The user has explicitly opted into raw shell access. Treat with care.
  - Pass the command as `argv` (an array) — no shell metacharacter expansion.
  - For pipelines, set `shell: true` (the runner will use bash -c).
  - Avoid destructive operations without confirming with the user first.
tools:
  - name: shell_exec
    description: Run a shell command. Returns stdout/stderr/exitCode.
    script: scripts/exec.ts
    params:
      argv:
        type: array
        items: { type: string }
        description: Argv form. Ignored when `shell` is true.
      command:
        type: string
        description: Single command string used when `shell` is true.
      shell:
        type: boolean
        description: Run via `bash -c command` instead of argv.
      cwd: { type: string }
      env: { type: object, additionalProperties: { type: string } }
---

# shell (opt-in)

A backstop tool for cases the bundled studio skills don't cover. Enable
with `/skill enable shell` when needed.
