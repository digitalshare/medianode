import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatEvent,
  ChatRequest,
  ModelInfo,
  ProviderAdapter,
  ToolDef,
} from '../core/types.js';

export interface AnthropicAdapterOptions {
  apiKey: string;
  baseUrl?: string;
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(opts: AnthropicAdapterOptions) {
    this.client = new Anthropic({ apiKey: opts.apiKey, baseURL: opts.baseUrl });
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-opus-4-7' },
      { id: 'claude-sonnet-4-6' },
      { id: 'claude-haiku-4-5-20251001' },
    ];
  }

  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatEvent> {
    const tools = (req.tools ?? []).map(toAnthropicTool);
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map(toAnthropicMessage);

    const stream = this.client.messages.stream(
      {
        model: req.model,
        max_tokens: req.maxTokens ?? 4096,
        ...(req.system ? { system: req.system } : {}),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        messages,
        ...(tools.length ? { tools: tools as any } : {}),
      } as any,
      { signal },
    );

    const toolBlocks = new Map<number, { id: string; name: string; input: string }>();

    for await (const ev of stream) {
      if (ev.type === 'content_block_start') {
        const block: any = ev.content_block;
        if (block.type === 'tool_use') {
          toolBlocks.set(ev.index, { id: block.id, name: block.name, input: '' });
        }
      } else if (ev.type === 'content_block_delta') {
        const delta: any = ev.delta;
        if (delta.type === 'text_delta') {
          yield { kind: 'text', delta: delta.text };
        } else if (delta.type === 'input_json_delta') {
          const tb = toolBlocks.get(ev.index);
          if (tb) tb.input += delta.partial_json ?? '';
        }
      } else if (ev.type === 'content_block_stop') {
        const tb = toolBlocks.get(ev.index);
        if (tb) {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = tb.input ? JSON.parse(tb.input) : {};
          } catch {
            parsed = { _raw: tb.input };
          }
          yield { kind: 'tool_call', call: { id: tb.id, name: tb.name, input: parsed } };
        }
      } else if (ev.type === 'message_stop') {
        yield { kind: 'stop', reason: 'stop' };
      } else if (ev.type === 'message_delta') {
        const usage: any = (ev as any).usage;
        if (usage)
          yield {
            kind: 'usage',
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
          };
      }
    }
  }
}

function toAnthropicTool(t: ToolDef) {
  return {
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object',
      ...(t.parameters as object),
    },
  };
}

function toAnthropicMessage(m: import('../core/types.js').ChatMessage): any {
  if (m.role === 'tool' && m.toolResult) {
    return {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: m.toolResult.toolCallId,
          content: m.toolResult.output,
          ...(m.toolResult.isError ? { is_error: true } : {}),
        },
      ],
    };
  }
  if (m.role === 'assistant') {
    const blocks: any[] = [];
    if (m.content) blocks.push({ type: 'text', text: m.content });
    for (const tc of m.toolCalls ?? []) {
      blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    }
    return { role: 'assistant', content: blocks.length ? blocks : [{ type: 'text', text: '' }] };
  }
  return { role: m.role === 'system' ? 'user' : m.role, content: m.content };
}
