import OpenAI from 'openai';
import type {
  ChatEvent,
  ChatMessage,
  ChatRequest,
  ModelInfo,
  ProviderAdapter,
  ToolDef,
} from '../core/types.js';

export interface OpenAIAdapterOptions {
  apiKey: string;
  baseUrl?: string;
  /** Override the canonical adapter name. Used for OpenRouter, xAI, DeepSeek. */
  name?: string;
  /** Default models to advertise via listModels. */
  defaultModels?: string[];
}

/**
 * OpenAI Chat Completions adapter, also reused for any OpenAI-compatible
 * upstream (OpenRouter, xAI, DeepSeek).
 */
export class OpenAIAdapter implements ProviderAdapter {
  readonly name: string;
  private client: OpenAI;
  private defaultModels: string[];

  constructor(opts: OpenAIAdapterOptions) {
    this.name = opts.name ?? 'openai';
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseUrl });
    this.defaultModels = opts.defaultModels ?? ['gpt-5', 'gpt-5-mini', 'gpt-4o', 'gpt-4o-mini'];
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const list = await this.client.models.list();
      return list.data.map((m) => ({ id: m.id }));
    } catch {
      return this.defaultModels.map((id) => ({ id }));
    }
  }

  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatEvent> {
    const tools = (req.tools ?? []).map(toOpenAITool);
    const messages = toOpenAIMessages(req);

    const stream = await this.client.chat.completions.create(
      {
        model: req.model,
        messages,
        stream: true,
        ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
      },
      { signal },
    );

    const toolFragments = new Map<
      number,
      { id?: string; name?: string; arguments: string }
    >();

    for await (const part of stream) {
      const choice = part.choices?.[0];
      if (!choice) continue;
      const delta: any = choice.delta;
      if (delta?.content) yield { kind: 'text', delta: delta.content };
      if (Array.isArray(delta?.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const existing = toolFragments.get(idx) ?? { arguments: '' };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          toolFragments.set(idx, existing);
        }
      }
      if (choice.finish_reason) {
        for (const frag of toolFragments.values()) {
          if (!frag.id || !frag.name) continue;
          let input: Record<string, unknown> = {};
          try {
            input = frag.arguments ? JSON.parse(frag.arguments) : {};
          } catch {
            input = { _raw: frag.arguments };
          }
          yield { kind: 'tool_call', call: { id: frag.id, name: frag.name, input } };
        }
        yield { kind: 'stop', reason: choice.finish_reason };
      }
    }
  }
}

function toOpenAITool(t: ToolDef) {
  return {
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: { type: 'object', ...(t.parameters as object) },
    },
  };
}

function toOpenAIMessages(req: ChatRequest): any[] {
  const out: any[] = [];
  if (req.system) out.push({ role: 'system', content: req.system });
  for (const m of req.messages) {
    out.push(toOpenAIMessage(m));
  }
  return out;
}

function toOpenAIMessage(m: ChatMessage): any {
  if (m.role === 'tool' && m.toolResult) {
    return {
      role: 'tool',
      tool_call_id: m.toolResult.toolCallId,
      content: m.toolResult.output,
    };
  }
  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: m.content || null,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.input) },
      })),
    };
  }
  if (m.role === 'system') return { role: 'system', content: m.content };
  return { role: m.role, content: m.content };
}
