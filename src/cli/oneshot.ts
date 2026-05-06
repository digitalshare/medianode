import { Agent } from '../core/agent.js';
import type { Config } from '../config/schema.js';
import type { ResolvedPaths } from '../config/paths.js';
import { buildProvider, defaultModelFor, type ProviderName } from '../providers/index.js';
import { buildRegistry } from '../skills/registry.js';
import { createSession } from '../history/session.js';
import { ensureScopeDirs } from '../config/index.js';

export interface OneShotOptions {
  prompt: string;
  config: Config;
  paths: ResolvedPaths;
  provider?: string;
  model?: string;
  cwd: string;
}

export async function runOneShot(opts: OneShotOptions): Promise<number> {
  ensureScopeDirs(opts.paths);
  const providerName = (opts.provider ?? opts.config.defaultProvider) as ProviderName;
  const provider = buildProvider(providerName, opts.config, opts.paths);
  const model = opts.model ?? defaultModelFor(providerName, opts.config);
  const registry = buildRegistry(opts.config, opts.paths);
  const session = createSession(opts.paths.sessionsDir, {
    provider: provider.name,
    model,
    cwd: opts.cwd,
  });

  const agent = new Agent({
    provider,
    model,
    registry,
    config: opts.config,
    paths: opts.paths,
    session,
    workingDir: opts.cwd,
  });

  let exit = 0;
  await agent.run(opts.prompt, {
    onAssistantText: (delta) => process.stdout.write(delta),
    onToolCall: (call) => {
      process.stderr.write(`\n[tool ${call.name}] ${JSON.stringify(call.input)}\n`);
    },
    onToolResult: (call, output, isError) => {
      const tag = isError ? 'tool-error' : 'tool-result';
      process.stderr.write(`[${tag} ${call.name}] ${truncate(output, 4000)}\n`);
      if (isError) exit = 1;
    },
    onError: (msg) => {
      process.stderr.write(`\n[error] ${msg}\n`);
      exit = 1;
    },
    onTurnComplete: () => {
      process.stdout.write('\n');
    },
  });
  return exit;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… [+${s.length - max} chars]`;
}
