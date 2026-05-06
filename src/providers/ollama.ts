import { fetch } from 'undici';
import type {
  ChatEvent,
  ChatMessage,
  ChatRequest,
  ModelInfo,
  ProviderAdapter,
} from '../core/types.js';

export interface OllamaAdapterOptions {
  baseUrl?: string;
}

export class OllamaAdapter implements ProviderAdapter {
  readonly name = 'ollama';
  private baseUrl: string;

  constructor(opts: OllamaAdapterOptions = {}) {
    this.baseUrl = opts.baseUrl ?? 'http://localhost:11434';
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      const data = (await res.json()) as { models?: { name: string }[] };
      return (data.models ?? []).map((m) => ({ id: m.name }));
    } catch {
      return [{ id: 'llama3.1' }, { id: 'qwen2.5' }];
    }
  }

  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatEvent> {
    const body = {
      model: req.model,
      stream: true,
      messages: toOllamaMessages(req),
      ...(req.tools?.length
        ? {
            tools: req.tools.map((t) => ({
              type: 'function',
              function: {
                name: t.name,
                description: t.description,
                parameters: { type: 'object', ...(t.parameters as object) },
              },
            })),
          }
        : {}),
      ...(req.temperature !== undefined ? { options: { temperature: req.temperature } } : {}),
    };
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.body) {
      yield { kind: 'error', error: `ollama: empty response (${res.status})` };
      return;
    }
    const decoder = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let evt: any;
        try {
          evt = JSON.parse(line);
        } catch {
          continue;
        }
        const msg = evt.message;
        if (msg?.content) yield { kind: 'text', delta: msg.content };
        if (Array.isArray(msg?.tool_calls)) {
          for (const tc of msg.tool_calls) {
            yield {
              kind: 'tool_call',
              call: {
                id: tc.id ?? `${tc.function?.name}-${Date.now()}`,
                name: tc.function?.name,
                input:
                  typeof tc.function?.arguments === 'string'
                    ? safeJson(tc.function.arguments)
                    : tc.function?.arguments ?? {},
              },
            };
          }
        }
        if (evt.done) yield { kind: 'stop', reason: evt.done_reason ?? 'stop' };
      }
    }
  }
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return { _raw: s };
  }
}

function toOllamaMessages(req: ChatRequest): any[] {
  const out: any[] = [];
  if (req.system) out.push({ role: 'system', content: req.system });
  for (const m of req.messages) out.push(toOllamaMessage(m));
  return out;
}

function toOllamaMessage(m: ChatMessage): any {
  if (m.role === 'tool' && m.toolResult) {
    return { role: 'tool', content: m.toolResult.output };
  }
  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: m.content,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        function: { name: tc.name, arguments: tc.input },
      })),
    };
  }
  return { role: m.role, content: m.content };
}
