# MediaNode

> A CLI agent that drives mainstream LLMs and uses them to operate local
> media-studio CLIs. Default target: **SceneSpark CLI**
> (`digitalshare/scenespark`). Extend with skills.

## Install

```bash
# bash one-liner
curl -fsSL https://raw.githubusercontent.com/digitalshare/medianode/main/install.sh | bash

# npm
npm i -g @digitalshare/medianode

# from source
git clone https://github.com/digitalshare/medianode.git
cd medianode
./scripts/run.sh
```

Requires Node ≥ 20.

## Quick start

```bash
# REPL
medianode

# one-shot
medianode "create a SceneSpark project titled 'Demo' in movie mode"

# pick provider/model explicitly
medianode --provider anthropic --model claude-opus-4-7 "..."
```

API keys live in `~/.medianode/.env`. Set them with:

```bash
medianode config init
medianode config set-key anthropic sk-ant-...
medianode config set-key openai   sk-...
```

## Providers

`anthropic`, `openai`, `google`, `openrouter`, `ollama`, `xai`, `deepseek`.
The first one with a working API key (in declaration order) is selected
on first run. Use `/provider <name>` to switch mid-session.

## Skills

```bash
medianode skill list
medianode skill install https://github.com/<example>/some-skill
medianode skill update [name]
medianode skill remove <name>
```

Bundled skills: **scenespark-default**, **fs-notes**, **shell** (opt-in).

The default `scenespark-default` skill wraps the SceneSpark CLI. Make
sure `scenespark` is on PATH:

```bash
pip install scenespark   # or: uv tool install scenespark
scenespark init
```

> **Naming clarification:** SceneSpark *also* has a "skills" concept
> (`scenespark skill ...`) for in-TUI generation tasks. That is distinct
> from MediaNode skills, which expose the SceneSpark CLI to the LLM.

## Slash commands (REPL)

`/help`, `/provider`, `/providers`, `/model`, `/models`, `/skill {list,install,remove,update,enable,disable}`,
`/tools`, `/compact`, `/clear`, `/save`, `/load`, `/history`, `/system`,
`/cwd`, `/quit`.

## Configuration

`config.json` and `.env` are looked up under `<cwd-or-ancestor>/.medianode/`
(if present) and merged on top of `~/.medianode/`. Project values override
global. `package.json` and `.git` are **not** project markers — only an
explicit `.medianode/` directory counts.

## History & compaction

Sessions are stored at `<scope>/.medianode/sessions/<id>/`:

- `events.jsonl` — full replay record.
- `transcript.md` — human-readable transcript.
- `compactions/<n>.jsonl` — pre-compaction snapshots.

When the assistant turn count crosses `compaction.turnThreshold` (default
40) or you call `/compact`, the older turns are summarised by the
currently-selected model and replaced with a single message.

## Layout

See `PLAN.md` for the architectural plan.

## Licence

MIT.
