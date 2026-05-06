import type { SlashHandler } from './index.js';

export const compactCommand: SlashHandler = async (_args, ctx) => {
  const result = await ctx.agent.compactNow();
  if (!result) return { message: 'nothing to compact' };
  return {
    message: `compacted: ${result.eventsBefore} → ${result.eventsAfter} events. summary stored as the first message.`,
  };
};
