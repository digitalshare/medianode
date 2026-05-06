import type { SlashHandler } from './index.js';

export const toolsCommand: SlashHandler = (_args, ctx) => {
  const tools = ctx.registry.tools;
  if (!tools.length) return { message: 'no tools exposed (no skills enabled)' };
  const lines = tools.map(
    (t) => `  ${t.name.padEnd(28)} [${t.skill}] — ${t.description}`,
  );
  return { message: ['tools:', ...lines].join('\n') };
};
