import { OpenAIAdapter } from './openai.js';

export class OpenRouterAdapter extends OpenAIAdapter {
  constructor(opts: { apiKey: string }) {
    super({
      apiKey: opts.apiKey,
      baseUrl: 'https://openrouter.ai/api/v1',
      name: 'openrouter',
      defaultModels: [
        'anthropic/claude-opus-4',
        'anthropic/claude-sonnet-4.6',
        'openai/gpt-5',
        'google/gemini-2.0-flash',
      ],
    });
  }
}
