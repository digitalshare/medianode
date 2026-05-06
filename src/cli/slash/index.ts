import type { Interface } from 'node:readline';
import type { Agent } from '../../core/agent.js';
import type { Config } from '../../config/schema.js';
import type { ResolvedPaths } from '../../config/paths.js';
import type { SkillRegistry } from '../../skills/registry.js';
import type { Session } from '../../history/session.js';

export interface SlashContext {
  agent: Agent;
  rl: Interface;
  config: Config;
  setConfig: (next: Config) => void;
  paths: ResolvedPaths;
  registry: SkillRegistry;
  rebuildRegistry: () => void;
  switchProvider: (name: string, model?: string) => void;
  switchModel: (model: string) => void;
  workingDir: string;
  setWorkingDir: (dir: string) => void;
  session: Session;
  newSession: (title?: string) => void;
  loadSessionById: (id: string) => void;
  listSessionIds: () => string[];
  mergeConfigUpdate: (patch: Partial<Config>) => void;
  currentProvider: () => string;
  currentModel: () => string;
}

export interface SlashResult {
  message?: string;
  exit?: boolean;
}

export type SlashHandler = (args: string[], ctx: SlashContext) => SlashResult | Promise<SlashResult>;

import { helpCommand } from './help.js';
import { providerCommand, providersCommand, modelCommand, modelsCommand } from './provider.js';
import { skillCommand } from './skill.js';
import { toolsCommand } from './tools.js';
import { compactCommand } from './compact.js';
import { clearCommand, saveCommand, loadCommand, historyCommand } from './session.js';
import { systemCommand, cwdCommand } from './session.js';

export const COMMANDS: Record<string, SlashHandler> = {
  help: helpCommand,
  provider: providerCommand,
  providers: providersCommand,
  model: modelCommand,
  models: modelsCommand,
  skill: skillCommand,
  tools: toolsCommand,
  compact: compactCommand,
  clear: clearCommand,
  save: saveCommand,
  load: loadCommand,
  history: historyCommand,
  system: systemCommand,
  cwd: cwdCommand,
  quit: () => ({ exit: true }),
  exit: () => ({ exit: true }),
};

export async function handleSlash(line: string, ctx: SlashContext): Promise<SlashResult> {
  const tokens = line.slice(1).split(/\s+/).filter(Boolean);
  const cmd = tokens.shift();
  if (!cmd) return { message: 'Empty command. Type /help.' };
  const handler = COMMANDS[cmd];
  if (!handler) return { message: `Unknown command: /${cmd}. Type /help.` };
  try {
    return await handler(tokens, ctx);
  } catch (err) {
    return { message: `error: ${(err as Error).message}` };
  }
}
