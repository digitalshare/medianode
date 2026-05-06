---
name: scenespark-default
description: Operate the SceneSpark CLI for editing and generating videos.
version: 0.1.0
whenToUse: When the user asks to create, edit, render, search, or otherwise operate on SceneSpark projects. Default media studio for MediaNode.
instructions: |
  - Prefer the JSON-emitting subcommands when available (most data-returning
    commands print JSON to stdout). Parse the JSON before describing the result.
  - Show the user a short plan before destructive operations.
  - The `scenespark_run` tool spawns the `scenespark` CLI as a subprocess. Pass
    arguments via the `argv` array.
  - `scenespark_manifest_refresh` re-fetches the canonical CLI manifest and the
    upstream skill doc. Use it when a command appears unsupported or after a
    SceneSpark upgrade.
  - The full SceneSpark CLI surface is documented in the vendored
    "upstream-SKILL" reference block injected into the system prompt.
tools:
  - name: scenespark_run
    description: Run a SceneSpark CLI command. Returns stdout/stderr/exitCode.
    script: scripts/run.ts
    params:
      argv:
        type: array
        items: { type: string }
        description: Arguments passed to `scenespark`.
      cwd:
        type: string
        description: Working directory for the subprocess (optional).
      stdin:
        type: string
        description: Optional stdin to pipe.
      env:
        type: object
        description: Extra environment variables.
        additionalProperties: { type: string }
    required: [argv]
  - name: scenespark_manifest_refresh
    description: Fetch the latest SceneSpark CLI manifest and SKILL.md, write to vendor/. Returns a diff summary.
    script: scripts/refresh-manifest.ts
    params: {}
---

# SceneSpark default skill

This skill is a thin wrapper around the `scenespark` CLI. The detailed
command surface is provided by the vendored upstream skill in the
`vendor/` folder, which is injected into the system prompt verbatim
when this skill is enabled.

## Preflight

On first use per session, MediaNode will run `scenespark --version` to
verify the CLI is available. If missing, install it with one of:

```
pip install scenespark
uv tool install scenespark
```

## Workspace and secrets

`SCENESPARK_WORKSPACE` and `SCENESPARK_DB` are forwarded automatically
from MediaNode's resolved environment (project `.env` first, then
global). API keys are configured via `scenespark provider set-key`;
MediaNode does not touch them.

## Naming clarification

SceneSpark also has its own "skills" concept (`scenespark skill ...`)
for in-TUI generation tasks. Those are *distinct* from MediaNode skills
— this skill (a MediaNode skill) is what exposes the SceneSpark CLI to
the model.
