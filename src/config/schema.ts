import { z } from 'zod';

export const ProviderConfigSchema = z.object({
  envKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string().optional(),
});

export const ConfigSchema = z.object({
  defaultProvider: z.string().default('anthropic'),
  defaultModel: z.string().default('claude-opus-4-7'),
  providers: z
    .record(z.string(), ProviderConfigSchema)
    .default(() => ({
      anthropic: { envKey: 'ANTHROPIC_API_KEY', defaultModel: 'claude-opus-4-7' },
      openai: { envKey: 'OPENAI_API_KEY', defaultModel: 'gpt-5' },
      google: { envKey: 'GOOGLE_API_KEY', defaultModel: 'gemini-2.0-flash' },
      openrouter: { envKey: 'OPENROUTER_API_KEY', defaultModel: 'anthropic/claude-opus-4' },
      ollama: { baseUrl: 'http://localhost:11434', defaultModel: 'llama3.1' },
      xai: { envKey: 'XAI_API_KEY', defaultModel: 'grok-2' },
      deepseek: { envKey: 'DEEPSEEK_API_KEY', defaultModel: 'deepseek-chat' },
    })),
  compaction: z
    .object({
      turnThreshold: z.number().int().positive().default(40),
      keepRecentTurns: z.number().int().positive().default(8),
    })
    .default({ turnThreshold: 40, keepRecentTurns: 8 }),
  skills: z
    .object({
      enabled: z.array(z.string()).default(['scenespark-default', 'fs-notes']),
    })
    .default({ enabled: ['scenespark-default', 'fs-notes'] }),
  studio: z
    .object({
      default: z.string().default('scenespark'),
      command: z.string().default('scenespark'),
    })
    .default({ default: 'scenespark', command: 'scenespark' }),
  ui: z
    .object({
      theme: z.enum(['dark', 'light', 'auto']).default('auto'),
    })
    .default({ theme: 'auto' }),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export function defaultConfig(): Config {
  return ConfigSchema.parse({});
}

export function mergeConfig(base: Config, overlay: Partial<Config>): Config {
  return ConfigSchema.parse({
    ...base,
    ...overlay,
    providers: { ...base.providers, ...(overlay.providers ?? {}) },
    compaction: { ...base.compaction, ...(overlay.compaction ?? {}) },
    skills: { ...base.skills, ...(overlay.skills ?? {}) },
    studio: { ...base.studio, ...(overlay.studio ?? {}) },
    ui: { ...base.ui, ...(overlay.ui ?? {}) },
  });
}
