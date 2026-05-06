import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import type {
  ChatEvent,
  ChatRequest,
  ModelInfo,
  ProviderAdapter,
} from '../core/types.js';

export interface GoogleAdapterOptions {
  apiKey: string;
}

export class GoogleAdapter implements ProviderAdapter {
  readonly name = 'google';
  private client: GoogleGenerativeAI;

  constructor(opts: GoogleAdapterOptions) {
    this.client = new GoogleGenerativeAI(opts.apiKey);
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'gemini-2.0-flash' },
      { id: 'gemini-1.5-pro' },
      { id: 'gemini-1.5-flash' },
    ];
  }

  async *stream(req: ChatRequest, _signal?: AbortSignal): AsyncIterable<ChatEvent> {
    const tools = req.tools?.length
      ? [
          {
            functionDeclarations: req.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: { type: 'object', ...(t.parameters as object) },
            })),
          },
        ]
      : undefined;
    const model = this.client.getGenerativeModel({
      model: req.model,
      ...(req.system ? { systemInstruction: req.system } : {}),
      ...(tools ? { tools: tools as any } : {}),
    });

    const contents = req.messages.map(toGoogleContent).filter(Boolean) as any[];

    const resp = await model.generateContentStream({ contents });

    for await (const chunk of resp.stream) {
      const text = chunk.text?.();
      if (text) yield { kind: 'text', delta: text };
      const calls = chunk.functionCalls?.();
      if (calls) {
        for (const call of calls) {
          yield {
            kind: 'tool_call',
            call: {
              id: `${call.name}-${Date.now()}`,
              name: call.name,
              input: (call.args ?? {}) as Record<string, unknown>,
            },
          };
        }
      }
    }
    yield { kind: 'stop', reason: 'stop' };
  }
}

function toGoogleContent(m: import('../core/types.js').ChatMessage): { role: string; parts: Part[] } | null {
  if (m.role === 'system') return null;
  if (m.role === 'tool' && m.toolResult) {
    return {
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: m.toolResult.name,
            response: { content: m.toolResult.output },
          },
        } as Part,
      ],
    };
  }
  if (m.role === 'assistant') {
    const parts: Part[] = [];
    if (m.content) parts.push({ text: m.content } as Part);
    for (const tc of m.toolCalls ?? []) {
      parts.push({ functionCall: { name: tc.name, args: tc.input } } as unknown as Part);
    }
    return { role: 'model', parts: parts.length ? parts : [{ text: '' } as Part] };
  }
  return { role: 'user', parts: [{ text: m.content } as Part] };
}
