# MediaNode — Plan

## 1. Overview

**MediaNode** is a CLI agent that drives mainstream LLMs and uses them to operate
local media-studio CLIs (image, video, audio). It is conceptually similar to
OpenClaw / Hermes Agent, but specialized for **media production workflows** that
are executed by invoking a media-studio CLI as a subprocess.

The default target studio is **SceneSpark CLI** (`digitalshare/scenespark`).
Other studios can be supported by installing additional skills.

The agent is distributed as an npm package (`@digitalshare/medianode`), a
one-line bash installer, and a cloneable repo at
`https://github.com/digitalshare/medianode`. It stores configuration and chat
history under `~/.medianode/`, and exposes a Claude-Code-style skill system
that the user can extend by pointing at git URLs or local folders.

## 2. Goals (v1)

- Three install paths: bash one-liner, `npm i -g`, and `git clone` + run script.
- Runs on macOS / Linux / Windows (Node ≥ 20 required).
- Interactive REPL **and** one-shot command modes.
- Multi-provider LLM support with provider-native tool calling and streaming.
- Skill manager: install / list / remove / update skills from git or filesystem.
- Per-session chat history persisted as JSONL (replay) + Markdown (human).
- History compaction by turn count or `/compact`, performed by the user's
  currently selected model.
- Default skill bundle that drives SceneSpark CLI workflows.

## 3. Non-Goals (v1)

- Multi-agent / agent-to-agent orchestration.
- Web UI or hosted service.
- Cloud sync of history or config.
- MCP server/client support.
- Sandboxing of skill code (skills are trusted).
- Telemetry / analytics.

## 4. Tech Stack

| Concern             | Choice                                                       |
| ------------------- | ------------------------------------------------------------ |
| Language            | TypeScript                                                   |
| Runtime             | Node.js ≥ 20                                                 |
| Package manager     | `pnpm` for dev, `npm` for end-user install                   |
| Build               | `tsc` → `dist/`, published as ESM with type defs             |
| TUI                 | **Ink** (React for terminals) + `ink-spinner`, `ink-select-input`, `ink-text-input` |
| Markdown rendering  | `marked` + `marked-terminal`                                 |
| Syntax highlighting | `cli-highlight`                                              |
| Config / secrets    | `dotenv` for `.env`, JSON for structured config              |
| Schema validation   | `zod`                                                        |
| Process control     | `execa` for subprocess invocations                           |
| HTTP                | `undici` (used by `scenespark_manifest_refresh` and elsewhere) |
| Git operations      | `simple-git` (for skill install from git URL)                |
| Logging             | `pino` (file sink only; never pollutes TUI)                  |
| Testing             | `vitest`                                                     |
| Lint / format       | `biome` (single tool for both)                               |

## 5. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ CLI entrypoint (commander)                                  │
│   ├── one-shot mode: medianode "prompt"                    │
│   └── REPL mode:     medianode                             │
└─────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Ink TUI Layer                                               │
│   - chat view, status bar, slash-command palette            │
└─────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Agent Core                                                  │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│   │ Provider     │  │ Skill        │  │ History          │ │
│   │ Router       │  │ Registry     │  │ Manager          │ │
│   └──────────────┘  └──────────────┘  └──────────────────┘ │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│   │ Tool         │  │ Slash        │  │ Compactor        │ │
│   │ Dispatcher   │  │ Commands     │  │                  │ │
│   └──────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────┐         ┌──────────────────────────┐
│ Provider Adapters    │         │ Installed Skills         │
│ - anthropic          │         │ - scenespark-default     │
│ - openai             │         │ - fs-notes               │
│ - google             │         │ - shell (opt-in)         │
│ - openrouter         │         │ - <user-installed>       │
│ - ollama             │         │                          │
│ - xai / deepseek     │         │ each skill spawns        │
│                      │         │ studio CLI as subprocess │
└──────────────────────┘         └──────────────────────────┘
```

## 6. CLI / UX

### 6.1 Invocation

```bash
medianode                          # REPL
medianode "edit clip.mp4 ..."      # one-shot
medianode --provider anthropic --model claude-opus-4-7 "..."
medianode skill install <git-url>  # subcommand form for management
medianode skill list
medianode config init              # writes default config
```

### 6.2 Slash commands (REPL)

| Command                   | Effect                                               |
| ------------------------- | ---------------------------------------------------- |
| `/help`                   | List commands                                        |
| `/provider [name]`        | Show / switch provider                               |
| `/model [name]`           | Show / switch model on current provider              |
| `/providers`              | List configured providers                            |
| `/models`                 | List models for current provider                     |
| `/skill list`             | Show installed skills                                |
| `/skill install <src>`    | Install from git URL or filesystem path              |
| `/skill remove <name>`    | Uninstall                                            |
| `/skill update [name]`    | `git pull` for git-sourced skills                    |
| `/skill enable / disable` | Toggle a skill for the current session               |
| `/tools`                  | Show tools currently exposed to the model            |
| `/compact`                | Manually summarize and replace older turns           |
| `/clear`                  | New session                                          |
| `/save [name]`            | Bookmark current session                             |
| `/load <name>`            | Resume a saved session                               |
| `/history`                | Open the markdown transcript path                    |
| `/system <text>`          | Set or replace the system prompt for the session     |
| `/cwd [path]`             | Show / change the working directory passed to skills |
| `/quit`                   | Exit                                                 |

### 6.3 TUI layout (Ink)

- Top: scrollable conversation pane (markdown rendered inline).
- Bottom: input box.
- Status bar: provider · model · session · turn count · skills enabled.
- Modal overlays for `/skill install`, `/provider`, `/model` (selectable list).

### 6.4 First-run provider picker order

`anthropic`, `openai`, `google`, `openrouter`, `ollama`, `xai`, `deepseek`.

## 7. Configuration & Secrets

### 7.1 Locations & project detection

```
~/.medianode/
  config.json            # global config (providers, defaults, UI prefs)
  .env                   # global API keys (default workspace)
  skills/                # globally installed skills
  sessions/              # global sessions if no project
  logs/

<project>/.medianode/
  config.json            # per-project overrides
  .env                   # per-project keys (override global)
  skills/                # project-scoped skills
  sessions/              # project-scoped chat history
```

**Project detection:** walk up from `cwd` looking for a `.medianode/` folder. If
none is found, use global scope. `package.json` / `.git` are **not** project
markers — only an explicit `.medianode/` counts. Implemented in
`src/config/paths.ts`.

Project config wins over global where both define the same key.

### 7.2 Config schema (sketch)

```jsonc
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-opus-4-7",
  "providers": {
    "anthropic":  { "envKey": "ANTHROPIC_API_KEY" },
    "openai":     { "envKey": "OPENAI_API_KEY"   },
    "google":     { "envKey": "GOOGLE_API_KEY"   },
    "openrouter": { "envKey": "OPENROUTER_API_KEY" },
    "ollama":     { "baseUrl": "http://localhost:11434" },
    "xai":        { "envKey": "XAI_API_KEY" },
    "deepseek":   { "envKey": "DEEPSEEK_API_KEY" }
  },
  "compaction": { "turnThreshold": 40, "keepRecentTurns": 8 },
  "skills":     { "enabled": ["scenespark-default", "fs-notes"] },
  "studio":     { "default": "scenespark", "command": "scenespark" }
}
```

### 7.3 Secrets

- API keys read from `.env` (project first, then global).
- `medianode config set-key <provider>` writes to the global `.env`.
- No keychain integration in v1 (called out in non-goals).

## 8. Providers

### 8.1 Initial provider list

| Provider     | Streaming | Native tools | Notes                          |
| ------------ | --------- | ------------ | ------------------------------ |
| `anthropic`  | yes       | yes          | `@anthropic-ai/sdk`            |
| `openai`     | yes       | yes          | `openai`                       |
| `google`     | yes       | yes          | `@google/generative-ai`        |
| `openrouter` | yes       | yes          | OpenAI-compatible              |
| `ollama`     | yes       | yes (newer)  | Local models                   |
| `xai`        | yes       | yes          | OpenAI-compatible              |
| `deepseek`   | yes       | yes          | OpenAI-compatible              |

The user selects providers via `--provider` flag, `/provider` slash command,
or interactive selection on first run.

### 8.2 Adapter contract

```ts
interface ProviderAdapter {
  name: string;
  listModels(): Promise<ModelInfo[]>;
  stream(req: ChatRequest): AsyncIterable<ChatEvent>;
}
```

Tool calls are translated into the provider's native schema. Internally we
keep one canonical tool description (name, JSON-schema params, description)
and translate at the adapter boundary — required so the **same skill works
across every provider**.

## 9. Skills & Tools

### 9.1 Skill format (Claude-Code style)

```
my-skill/
  SKILL.md          # required: name, description, when-to-use, instructions
  package.json      # optional: declared deps the loader installs on first use
  scripts/
    do-thing.ts     # or .js / .sh — invoked as subprocess
  tools.json        # optional: explicit tool manifest (otherwise inferred)
  assets/...
```

Supported skill-script languages: **Node** (`.ts`/`.js` via tsx) and **bash**
are guaranteed. **Python** scripts run only if `python3` is on PATH —
MediaNode does not bundle a Python interpreter. (SceneSpark itself is a
separately-installed Python CLI; it is not a runtime dependency of MediaNode.)

`SKILL.md` frontmatter:

```yaml
---
name: scenespark-default
description: Operate SceneSpark CLI for editing and generating videos.
version: 0.1.0
tools:
  - name: scenespark_run
    description: Run a SceneSpark CLI command.
    params:
      argv:  { type: array, items: { type: string } }
      cwd:   { type: string }
      stdin: { type: string }
      env:   { type: object }
---
```

### 9.2 Loader

- **In-process**: the loader itself runs inside MediaNode — no sandbox.
- **Tool execution**: scripts inside a skill are executed via `execa` (subprocess)
  because they may be in any language. "In-process" refers to skill *discovery
  and dispatch*, not script execution.
- The skill's `SKILL.md` body is injected into the system prompt when the skill
  is enabled, so the model knows when and how to call its tools.

### 9.3 Sources

- `medianode skill install <git-url>` → `git clone` into
  `<scope>/.medianode/skills/<name>`.
- `medianode skill install <path>` → symlink the folder.
- `medianode skill update <name>` → `git pull` if it's a git-sourced skill.

### 9.4 Default skills shipped with the package

- **`scenespark-default`** — wrapper around the SceneSpark CLI. See §11 for
  the concrete design.
- **`fs-notes`** — read/write Markdown notes in the working directory; this is
  the mechanism the model uses to "write down critical information" per the
  brief.
- **`shell`** — opt-in raw shell tool (disabled by default).

## 10. Chat History & Compaction

### 10.1 Storage

```
<scope>/.medianode/sessions/<session-id>/
  meta.json          # provider, model, started_at, title
  events.jsonl       # one event per line — full replay record
  transcript.md      # human-readable rolling transcript
  compactions/       # snapshots of each compaction step
```

`events.jsonl` line schema:

```jsonc
{ "ts": "...", "kind": "user|assistant|tool_call|tool_result|system|compaction",
  "content": "...", "meta": { ... } }
```

### 10.2 Compaction

- **Triggers**: turn count ≥ `compaction.turnThreshold` (default `40`), or `/compact`.
- **Model**: the user's currently selected model.
- **Strategy**: keep the last `keepRecentTurns` (default `8`) turns verbatim;
  replace earlier turns with a single summary message, prepended with a system
  note.
- The pre-compaction state is saved to `compactions/<n>.jsonl` so nothing is
  lost. `events.jsonl` is rewritten from the new state.

## 11. SceneSpark Integration

The default `scenespark-default` skill is a **passthrough wrapper plus injected
upstream SKILL.md**. SceneSpark already ships a generic-agent SKILL.md
(generated from its canonical JSON manifest) listing all 68 commands —
re-using it minimises token cost and auto-tracks CLI changes.

### 11.1 Sources

- Canonical manifest: `https://digitalshare.github.io/scenespark/cli/latest.json`
  (also `public/cli/latest.json` in the SceneSpark repo).
- Upstream skill: `public/cli/skills/generic/SKILL.md` in the SceneSpark repo.
- Executable on PATH: `scenespark` (Python; users install separately via
  `pip install scenespark` or `uv tool install scenespark`).
- Output contract: most data-returning commands print JSON to stdout. Secrets
  live in `.env` and are never echoed by status commands.
- Env vars passed through: `SCENESPARK_WORKSPACE`, `SCENESPARK_DB`.

### 11.2 Layout

```
skills-bundled/scenespark-default/
  SKILL.md              # MediaNode-side wrapper (frontmatter + tool defs)
  vendor/
    upstream-SKILL.md   # snapshot of digitalshare/scenespark skill
                        # injected verbatim into the system prompt
    latest.json         # snapshot of the canonical manifest
                        # used by manifest_refresh diffing
  scripts/
    run.ts              # thin execa wrapper for `scenespark <argv>`
    refresh-manifest.ts # fetches latest.json + SKILL.md, writes vendor/
```

### 11.3 Tools exposed to the model

Canonical schema — translated per provider at the adapter boundary.

| Tool name                      | Params                                                                     | Behavior                                                                                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scenespark_run`               | `argv: string[]`, `cwd?: string`, `stdin?: string`, `env?: Record<string,string>` | `execa('scenespark', argv, { cwd, input: stdin, env: {...process.env, ...env} })`. Returns `{ stdout, stderr, exitCode }`. The model is instructed to default to JSON-emitting subcommands. |
| `scenespark_manifest_refresh`  | (none)                                                                     | Fetches `latest.json` + `SKILL.md` from the canonical URL, writes to `vendor/`. Returns a diff summary of added / removed / changed commands.                                                       |

### 11.4 Behaviour

- **System-prompt injection**: when the skill is enabled, the loader prepends
  `vendor/upstream-SKILL.md` to the session system prompt under a delimiter
  (`### SceneSpark CLI reference`). This teaches the model the 68 commands
  without ballooning the tool list.
- **Preflight**: on first use per session, `run.ts` checks `scenespark --version`.
  If missing, the tool returns an actionable error pointing to SceneSpark's
  install docs (no auto-install — skills are trusted but separately installed).
- **Workspace / secrets passthrough**: `SCENESPARK_WORKSPACE` and
  `SCENESPARK_DB` are read from MediaNode's resolved env (project `.env` first,
  then global `.env`) and forwarded. API keys are written by the user via
  `scenespark provider set-key` — MediaNode never touches them.

### 11.5 Naming clarification (README + `/help` note)

SceneSpark also has a "skills" concept (`scenespark skill ...`) for in-TUI
generation tasks. This is **distinct** from MediaNode skills. Document this
once so users don't conflate the two layers.

## 12. Project Layout

```
medianode/
  package.json                       # name: @digitalshare/medianode
  tsconfig.json
  tsconfig.build.json
  biome.json
  vitest.config.ts
  install.sh                         # served via raw.githubusercontent.com
  scripts/
    run.sh                           # contributor entrypoint
  src/
    cli/
      index.ts                       # commander entrypoint
      repl.tsx                       # Ink REPL
      slash/                         # one file per slash command
    core/
      agent.ts                       # main loop: model ↔ tools
      router.ts
      session.ts
    providers/
      anthropic.ts
      openai.ts
      google.ts
      openrouter.ts
      ollama.ts
      xai.ts
      deepseek.ts
      index.ts
    skills/
      registry.ts
      loader.ts                      # injects vendor/upstream-SKILL.md when enabled
      installer.ts
      tools.ts
    history/
      jsonl.ts
      markdown.ts
      compactor.ts
    config/
      paths.ts                       # .medianode/ walk-up + ~/.medianode resolution
      schema.ts
      env.ts
    studio/
      scenespark.ts                  # convenience wrappers (optional)
  skills-bundled/
    scenespark-default/
      SKILL.md
      vendor/
        upstream-SKILL.md
        latest.json
      scripts/
        run.ts
        refresh-manifest.ts
    fs-notes/
    shell/
  test/
  .github/workflows/
    ci.yml                           # CI on PR
    release.yml                      # npm publish on tag push
  PLAN.md                            # this file
  README.md
```

## 13. Build & Distribution

Build:

- `tsc -p tsconfig.build.json` emits ESM JS + `.d.ts` into `dist/`.
- `package.json#name = "@digitalshare/medianode"`, `bin.medianode = "dist/cli/index.js"`
  (with `#!/usr/bin/env node` shebang).
- Bundled skills under `skills-bundled/` are shipped as package assets via the
  `files` field.

The tool is delivered through three channels — all three resolve to the same
codebase at `https://github.com/digitalshare/medianode`:

### 13.1 npm

```bash
npm i -g @digitalshare/medianode
medianode
```

Published from CI on tag push to the npm public registry as a public scoped
package. `engines.node = ">=20"` enforces the runtime.

### 13.2 Bash one-liner

```bash
curl -fsSL https://raw.githubusercontent.com/digitalshare/medianode/main/install.sh | bash
```

The script:
1. Verifies Node ≥ 20 is on PATH (prints install hint via `nvm` / `fnm` /
   system package manager if not).
2. Runs `npm i -g @digitalshare/medianode` (or `pnpm add -g` /
   `yarn global add` if those are the user's chosen manager — detected from
   `$PATH`).
3. Verifies `medianode --version` succeeds.

`install.sh` lives at the repo root so users can read it before piping to
`bash`. No custom domain in v1.

### 13.3 Cloned repo

```bash
git clone https://github.com/digitalshare/medianode.git
cd medianode
./scripts/run.sh           # installs deps, builds, runs
# or:
pnpm i && pnpm start
```

`scripts/run.sh` is a thin wrapper that runs `pnpm i --frozen-lockfile`,
`pnpm build`, then `node dist/cli/index.js "$@"`. This path is for
contributors and for users who want to pin to a specific commit.

## 14. Milestones

| # | Milestone           | Scope                                                                                                |
| - | ------------------- | ---------------------------------------------------------------------------------------------------- |
| 0 | Repo bootstrap      | Create empty repo at `digitalshare/medianode`, push initial commit with this plan, set up CI scaffolding (`ci.yml`, `release.yml`). |
| 1 | Skeleton            | Repo scaffolding, TS + `tsc` build, `medianode --version` runs from `dist/`.                         |
| 2 | Provider core       | Anthropic + OpenAI adapters, streaming, native tool calls, one-shot mode.                            |
| 3 | REPL                | Ink TUI, slash commands `/help /provider /model /clear /quit`, session storage (JSONL + markdown).   |
| 4 | Config & secrets    | Global + project config layering, `.env` resolution, `medianode config` subcommand.                  |
| 5 | Skill system        | Loader, registry, install from git/path, bundled `fs-notes`, tool exposure to models.                |
| 6 | More providers      | Google, OpenRouter, Ollama, xAI, DeepSeek.                                                           |
| 7 | Compaction          | Turn-threshold + `/compact`, summarized via current model, snapshot retention.                       |
| 8 | SceneSpark default  | `scenespark-default` skill with `scenespark_run` + `scenespark_manifest_refresh`, vendored SKILL.md. |
| 9 | Polish & release    | npm publish workflow, `install.sh`, `scripts/run.sh`, README, examples, basic vitest coverage.       |

## 15. Verification

End-to-end checks once milestone 8 lands:

1. **Install paths**
   - `npm i -g @digitalshare/medianode && medianode --version` succeeds on macOS + Linux.
   - `curl -fsSL https://raw.githubusercontent.com/digitalshare/medianode/main/install.sh | bash`
     succeeds and ends with a working `medianode --version`.
   - `git clone … && ./scripts/run.sh --version` succeeds.

2. **Provider loop** (no SceneSpark needed)
   - `medianode "say hi" --provider anthropic --model claude-opus-4-7` streams a reply.
   - `/provider openai` then `/model gpt-5` switches mid-session, history preserved.

3. **Skills**
   - `medianode skill list` shows `scenespark-default`, `fs-notes`, `shell` (last disabled).
   - `medianode skill install https://github.com/<example>/some-skill` clones into `~/.medianode/skills/`.

4. **SceneSpark integration** (requires `scenespark` on PATH)
   - `scenespark init` once.
   - `medianode "create a SceneSpark project titled 'Demo' in movie mode and add an opening scene"`
     — model should call `scenespark_run` with `["project","create","--title","Demo","--mode","movie"]`
     then `scenespark_run` with `["scene","create",...]`. Verify via `scenespark project list`.
   - `medianode "search the script for 'station'"` → `scenespark_run` with
     `["search","script","station"]`, JSON parsed into the assistant turn.
   - `medianode skill update scenespark-default` (or the
     `scenespark_manifest_refresh` tool) refreshes `vendor/latest.json` and
     reports a diff.

5. **History & compaction**
   - After 40 turns, automatic compaction fires; `events.jsonl` is rewritten
     and `compactions/0001.jsonl` exists.
   - `/compact` triggers manually, summary written using the currently-selected
     model.

6. **Tests** — `vitest` covers config layering, the `.medianode/` walk-up,
   history rewrite during compaction, the provider-adapter tool-translation
   boundary, and the SceneSpark passthrough wrapper (mocked `execa`).
