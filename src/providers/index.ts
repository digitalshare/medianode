import type { Config } from '../config/schema.js';
import type { ResolvedPaths } from '../config/paths.js';
import { getApiKey } from '../config/env.js';
import type { ProviderAdapter } from '../core/types.js';
import { AnthropicAdapter } from './anthropic.js';
import { OpenAIAdapter } from './openai.js';
import { GoogleAdapter } from './google.js';
import { OllamaAdapter } from './ollama.js';
import { OpenRouterAdapter } from './openrouter.js';
import { XAIAdapter } from './xai.js';
import { DeepSeekAdapter } from './deepseek.js';

export const PROVIDER_ORDER = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'ollama',
  'xai',
  'deepseek',
] as const;
export type ProviderName = (typeof PROVIDER_ORDER)[number];

export class ProviderUnavailableError extends Error {
  constructor(public providerName: string, message: string) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

export function buildProvider(
  name: string,
  cfg: Config,
  paths: ResolvedPaths,
): ProviderAdapter {
  const pcfg = cfg.providers[name];
  if (!pcfg) throw new ProviderUnavailableError(name, `Unknown provider: ${name}`);

  const ensureKey = (envKey: string | undefined): string => {
    const key = getApiKey(paths, envKey);
    if (!key) {
      throw new ProviderUnavailableError(
        name,
        `Missing API key for ${name}. Set ${envKey} in ~/.medianode/.env or run \`medianode config set-key ${name} <value>\`.`,
      );
    }
    return key;
  };

  switch (name) {
    case 'anthropic':
      return new AnthropicAdapter({ apiKey: ensureKey(pcfg.envKey), baseUrl: pcfg.baseUrl });
    case 'openai':
      return new OpenAIAdapter({ apiKey: ensureKey(pcfg.envKey), baseUrl: pcfg.baseUrl });
    case 'google':
      return new GoogleAdapter({ apiKey: ensureKey(pcfg.envKey) });
    case 'openrouter':
      return new OpenRouterAdapter({ apiKey: ensureKey(pcfg.envKey) });
    case 'ollama':
      return new OllamaAdapter({ baseUrl: pcfg.baseUrl });
    case 'xai':
      return new XAIAdapter({ apiKey: ensureKey(pcfg.envKey) });
    case 'deepseek':
      return new DeepSeekAdapter({ apiKey: ensureKey(pcfg.envKey) });
    default:
      throw new ProviderUnavailableError(name, `No adapter wired for provider: ${name}`);
  }
}

export function defaultModelFor(name: string, cfg: Config): string {
  return cfg.providers[name]?.defaultModel ?? cfg.defaultModel;
}
