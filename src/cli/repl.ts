import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { Agent } from '../core/agent.js';
import type { Config } from '../config/schema.js';
import type { ResolvedPaths } from '../config/paths.js';
import { buildProvider, defaultModelFor, PROVIDER_ORDER } from '../providers/index.js';
import { buildRegistry, type SkillRegistry } from '../skills/registry.js';
import { createSession, listSessions, loadMessages, loadSession } from '../history/session.js';
import { ensureScopeDirs, mergeConfig } from '../config/index.js';
import { handleSlash, type SlashContext } from './slash/index.js';
import { renderMarkdown } from './markdown.js';

export interface ReplOptions {
  config: Config;
  paths: ResolvedPaths;
  cwd: string;
  provider?: string;
  model?: string;
}

const ANSI = {
  dim: (s: string) => `\x1b[2m${s}\x1b[22m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[39m`,
  green: (s: string) => `\x1b[32m${s}\x1b[39m`,
  red: (s: string) => `\x1b[31m${s}\x1b[39m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[22m`,
};

export async function runRepl(opts: ReplOptions): Promise<void> {
  ensureScopeDirs(opts.paths);
  let config = opts.config;

  // Pick a provider that has a key available, falling back to the configured default.
  const providerName = await resolveProvider(opts.provider ?? config.defaultProvider, config, opts.paths);
  let provider: ReturnType<typeof buildProvider>;
  try {
    provider = buildProvider(providerName, config, opts.paths);
  } catch (err) {
    console.error(ANSI.red(`Cannot start: ${(err as Error).message}`));
    console.error('Run `medianode config init` and add API keys to ~/.medianode/.env, or use `medianode config set-key <provider> <key>`.');
    process.exit(2);
  }
  let model = opts.model ?? defaultModelFor(providerName, config);
  let registry: SkillRegistry = buildRegistry(config, opts.paths);
  let workingDir = opts.cwd;
  let session = createSession(opts.paths.sessionsDir, {
    provider: provider.name,
    model,
    cwd: workingDir,
  });

  const agent = new Agent({
    provider,
    model,
    registry,
    config,
    paths: opts.paths,
    session,
    workingDir,
  });

  printBanner({ provider: provider.name, model, scope: opts.paths.scope, sessionId: session.meta.id });

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  rl.setPrompt(prompt(provider.name, model));

  let busy = false;
  rl.prompt();
  rl.on('line', async (raw) => {
    const line = raw.trim();
    if (!line) {
      rl.prompt();
      return;
    }
    if (busy) {
      console.log(ANSI.yellow('… still working on previous turn'));
      return;
    }

    if (line.startsWith('/')) {
      const ctx: SlashContext = {
        agent,
        rl,
        get config() {
          return config;
        },
        setConfig: (next) => {
          config = next;
        },
        paths: opts.paths,
        get registry() {
          return registry;
        },
        rebuildRegistry: () => {
          registry = buildRegistry(config, opts.paths);
          agent.setRegistry(registry);
        },
        switchProvider: (name, newModel) => {
          const next = buildProvider(name, config, opts.paths);
          const m = newModel ?? defaultModelFor(name, config);
          agent.setProvider(next, m);
          model = m;
          provider = next;
          rl.setPrompt(prompt(next.name, m));
        },
        switchModel: (newModel) => {
          agent.setProvider(provider, newModel);
          model = newModel;
          rl.setPrompt(prompt(provider.name, newModel));
        },
        get workingDir() {
          return workingDir;
        },
        setWorkingDir: (dir) => {
          workingDir = dir;
          agent.setWorkingDir(dir);
        },
        get session() {
          return session;
        },
        newSession: (title) => {
          session = createSession(opts.paths.sessionsDir, {
            provider: provider.name,
            model,
            cwd: workingDir,
            title,
          });
          (agent as any).deps.session = session;
          (agent as any).messages = [];
        },
        loadSessionById: (id) => {
          const loaded = loadSession(opts.paths.sessionsDir, id);
          session = loaded;
          (agent as any).deps.session = loaded;
          (agent as any).messages = loadMessages(loaded);
        },
        listSessionIds: () => listSessions(opts.paths.sessionsDir).map((m) => m.id),
        mergeConfigUpdate: (patch) => {
          config = mergeConfig(config, patch);
        },
        currentProvider: () => provider.name,
        currentModel: () => model,
      };
      const result = await handleSlash(line, ctx);
      if (result.exit) {
        rl.close();
        return;
      }
      if (result.message) console.log(result.message);
      rl.prompt();
      return;
    }

    busy = true;
    console.log();
    let buffered = '';
    await agent.run(line, {
      onAssistantText: (delta) => {
        buffered += delta;
        process.stdout.write(delta);
      },
      onToolCall: (call) => {
        if (buffered) {
          process.stdout.write('\n');
          buffered = '';
        }
        console.log(ANSI.cyan(`↳ tool: ${call.name}`));
        const inp = JSON.stringify(call.input);
        if (inp.length > 0) console.log(ANSI.dim(`  ${truncate(inp, 200)}`));
      },
      onToolResult: (call, output, isError) => {
        const head = isError ? ANSI.red(`✗ ${call.name}`) : ANSI.green(`✓ ${call.name}`);
        console.log(head);
        console.log(ANSI.dim(indent(truncate(output, 800))));
      },
      onError: (msg) => {
        console.log(ANSI.red(`error: ${msg}`));
      },
      onTurnComplete: () => {
        if (buffered.length) {
          process.stdout.write('\n');
        }
        // Render assistant text as markdown to a separate block (best-effort) below.
      },
    });
    busy = false;
    console.log();
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(ANSI.dim(`\nsession saved at ${session.transcriptFile}`));
    process.exit(0);
  });
}

async function resolveProvider(
  preferred: string,
  config: Config,
  paths: ResolvedPaths,
): Promise<string> {
  // try preferred first
  try {
    buildProvider(preferred, config, paths);
    return preferred;
  } catch {
    // fall through
  }
  for (const candidate of PROVIDER_ORDER) {
    if (candidate === preferred) continue;
    try {
      buildProvider(candidate, config, paths);
      return candidate;
    } catch {}
  }
  return preferred; // will error in caller with a useful message
}

function prompt(provider: string, model: string): string {
  return ANSI.cyan(`${provider}/${model}`) + ANSI.dim(' ❯ ');
}

function printBanner(info: { provider: string; model: string; scope: string; sessionId: string }) {
  console.log(ANSI.bold('MediaNode') + ANSI.dim(' — CLI agent for media production'));
  console.log(
    ANSI.dim(
      `provider=${info.provider} model=${info.model} scope=${info.scope} session=${info.sessionId}`,
    ),
  );
  console.log(ANSI.dim('Type /help for commands, /quit to exit.'));
  console.log();
  // markdown rendering touch test (no-op if unsupported)
  try { renderMarkdown(''); } catch {}
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… [+${s.length - max} chars]`;
}

function indent(s: string): string {
  return s.split('\n').map((l) => `  ${l}`).join('\n');
}
