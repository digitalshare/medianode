import { OpenAIAdapter } from './openai.js';

export class DeepSeekAdapter extends OpenAIAdapter {
  constructor(opts: { apiKey: string }) {
    super({
      apiKey: opts.apiKey,
      baseUrl: 'https://api.deepseek.com/v1',
      name: 'deepseek',
      defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    });
  }
}
