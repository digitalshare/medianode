import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SlashHandler } from './index.js';

export const clearCommand: SlashHandler = (_args, ctx) => {
  ctx.newSession();
  return { message: `started new session ${ctx.session.meta.id}` };
};

export const saveCommand: SlashHandler = (args, ctx) => {
  const title = args.join(' ').trim();
  if (title) {
    ctx.session.meta.title = title;
    // persist meta
    import('../../history/session.js').then((m) => m.saveMeta(ctx.session));
  }
  return { message: `session ${ctx.session.meta.id}${title ? ` — "${title}"` : ''}` };
};

export const loadCommand: SlashHandler = (args, ctx) => {
  const id = args[0];
  if (!id) {
    const ids = ctx.listSessionIds().slice(0, 20);
    return { message: ['recent sessions:', ...ids.map((i) => `  ${i}`)].join('\n') };
  }
  ctx.loadSessionById(id);
  return { message: `loaded ${id}` };
};

export const historyCommand: SlashHandler = (_args, ctx) => ({
  message: ctx.session.transcriptFile,
});

export const systemCommand: SlashHandler = (args, ctx) => {
  const text = args.join(' ').trim();
  ctx.agent.setSystemPrefix(text || undefined);
  return { message: text ? 'system prompt prefix updated' : 'system prompt prefix cleared' };
};

export const cwdCommand: SlashHandler = (args, ctx) => {
  if (!args.length) return { message: ctx.workingDir };
  const candidate = resolve(ctx.workingDir, args[0]!);
  if (!existsSync(candidate) || !statSync(candidate).isDirectory()) {
    return { message: `not a directory: ${candidate}` };
  }
  ctx.setWorkingDir(candidate);
  return { message: `cwd: ${candidate}` };
};
