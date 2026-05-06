import type { SlashHandler } from './index.js';
import { buildProvider, defaultModelFor, PROVIDER_ORDER } from '../../providers/index.js';

export const providerCommand: SlashHandler = (args, ctx) => {
  if (!args.length) {
    return { message: `provider: ${ctx.currentProvider()} (model: ${ctx.currentModel()})` };
  }
  const name = args[0]!;
  if (!PROVIDER_ORDER.includes(name as any)) {
    return { message: `unknown provider: ${name}. known: ${PROVIDER_ORDER.join(', ')}` };
  }
  ctx.switchProvider(name);
  return { message: `→ provider=${name} model=${ctx.currentModel()}` };
};

export const providersCommand: SlashHandler = (_args, ctx) => {
  const lines = PROVIDER_ORDER.map((name) => {
    let status = 'unconfigured';
    try {
      buildProvider(name, ctx.config, ctx.paths);
      status = 'ready';
    } catch (err) {
      status = (err as Error).message.replace(/\n/g, ' ');
    }
    return `  ${name.padEnd(12)} ${status}`;
  });
  return { message: ['providers:', ...lines].join('\n') };
};

export const modelCommand: SlashHandler = (args, ctx) => {
  if (!args.length) return { message: `model: ${ctx.currentModel()}` };
  ctx.switchModel(args[0]!);
  return { message: `→ model=${args[0]}` };
};

export const modelsCommand: SlashHandler = async (_args, ctx) => {
  const provider = buildProvider(ctx.currentProvider(), ctx.config, ctx.paths);
  const models = await provider.listModels();
  const def = defaultModelFor(ctx.currentProvider(), ctx.config);
  const lines = models.map((m) => `  ${m.id}${m.id === def ? ' (default)' : ''}`);
  return { message: [`models for ${ctx.currentProvider()}:`, ...lines].join('\n') };
};
