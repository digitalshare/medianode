import { OpenAIAdapter } from './openai.js';

export class XAIAdapter extends OpenAIAdapter {
  constructor(opts: { apiKey: string }) {
    super({
      apiKey: opts.apiKey,
      baseUrl: 'https://api.x.ai/v1',
      name: 'xai',
      defaultModels: ['grok-2', 'grok-2-mini'],
    });
  }
}
