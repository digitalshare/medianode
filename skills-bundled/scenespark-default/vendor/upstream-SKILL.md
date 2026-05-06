# SceneSpark CLI — generic agent skill (vendored snapshot)

> This file is a **placeholder snapshot**. Run the
> `scenespark_manifest_refresh` tool to fetch the live SKILL.md and
> manifest from `https://digitalshare.github.io/scenespark/cli/`.

The SceneSpark CLI exposes 68 commands grouped under the following
top-level subcommands. The agent should prefer JSON output where
available.

```
scenespark project   create | list | show | rename | delete
scenespark scene     create | list | show | move | delete
scenespark script    create | get | search | replace
scenespark asset     ingest | list | resolve | tag
scenespark render    queue | status | cancel | output
scenespark provider  list | set-key | unset-key | status
scenespark skill     list | run | install
scenespark workspace path | use | export | import
scenespark search    script | asset | scene
scenespark export    bundle | timeline | edl | otio
scenespark version
scenespark --help
```

Conventions (from the upstream skill):

- Most data-returning commands accept `--json` and emit machine-readable
  JSON to stdout.
- Errors land on stderr; the process exits non-zero.
- Workspace selection follows `SCENESPARK_WORKSPACE`, then `--workspace`,
  then the active workspace recorded in `SCENESPARK_DB`.
- Secrets are managed exclusively via `scenespark provider set-key`. They
  are never echoed by status commands.
- Long-running render jobs return a job id; poll `render status <id>` or
  watch `render output <id>`.

Refresh this file in CI or before a session if the CLI version has
changed:

```
medianode skill update scenespark-default
# or, mid-session:
medianode "refresh the SceneSpark manifest"
```
