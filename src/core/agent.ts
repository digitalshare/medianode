import type {
  ChatEvent,
  ChatMessage,
  ChatRequest,
  ProviderAdapter,
  ToolCall,
} from './types.js';
import type { SkillRegistry } from '../skills/registry.js';
import { ToolDispatcher } from '../skills/dispatcher.js';
import { type Session, recordEvent } from '../history/session.js';
import { nowIso } from '../history/jsonl.js';
import type { Config } from '../config/schema.js';
import type { ResolvedPaths } from '../config/paths.js';
import { resolveEnv } from '../config/env.js';
import { compactSession } from '../history/compactor.js';

export interface AgentDeps {
  provider: ProviderAdapter;
  model: string;
  registry: SkillRegistry;
  config: Config;
  paths: ResolvedPaths;
  session: Session;
  workingDir: string;
  /** Optional system prompt prefix supplied via `/system`. */
  systemPrefix?: string;
}

export interface AgentEventSink {
  onAssistantText?: (delta: string) => void;
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (call: ToolCall, output: string, isError: boolean) => void;
  onTurnComplete?: () => void;
  onError?: (msg: string) => void;
}

const MAX_TOOL_LOOPS = 10;

export class Agent {
  private dispatcher: ToolDispatcher;
  private messages: ChatMessage[];

  constructor(private deps: AgentDeps, history: ChatMessage[] = []) {
    this.dispatcher = new ToolDispatcher(deps.registry.tools);
    this.messages = [...history];
  }

  setProvider(provider: ProviderAdapter, model: string): void {
    this.deps.provider = provider;
    this.deps.model = model;
    this.deps.session.meta.provider = provider.name;
    this.deps.session.meta.model = model;
  }

  setRegistry(registry: SkillRegistry): void {
    this.deps.registry = registry;
    this.dispatcher = new ToolDispatcher(registry.tools);
  }

  setSystemPrefix(s: string | undefined): void {
    this.deps.systemPrefix = s;
  }

  setWorkingDir(dir: string): void {
    this.deps.workingDir = dir;
  }

  buildSystemPrompt(): string {
    const base = [
      'You are MediaNode, a CLI agent specialized for media-production workflows.',
      `Working directory: ${this.deps.workingDir}`,
      'Use the tools exposed by enabled skills to operate local media-studio CLIs.',
      'Prefer JSON-emitting subcommands when available; parse output before responding.',
      'Be concise. Show plans before destructive operations.',
    ].join('\n');
    const skillBlocks = this.deps.registry.systemPromptBlocks.join('\n\n');
    const prefix = this.deps.systemPrefix ? `${this.deps.systemPrefix}\n\n` : '';
    return [prefix + base, skillBlocks].filter(Boolean).join('\n\n');
  }

  async run(userInput: string, sink: AgentEventSink = {}): Promise<void> {
    const userMsg: ChatMessage = { role: 'user', content: userInput };
    this.messages.push(userMsg);
    recordEvent(this.deps.session, { ts: nowIso(), kind: 'user', content: userInput });

    let loops = 0;
    while (loops < MAX_TOOL_LOOPS) {
      loops += 1;
      const request: ChatRequest = {
        model: this.deps.model,
        system: this.buildSystemPrompt(),
        messages: this.messages,
        tools: this.deps.registry.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
          skill: t.skill,
        })),
      };

      let assistantText = '';
      const toolCalls: ToolCall[] = [];
      let errored = false;

      try {
        for await (const ev of this.deps.provider.stream(request)) {
          this.handleEvent(ev, sink, (delta) => {
            assistantText += delta;
          }, (call) => {
            toolCalls.push(call);
          }, () => {
            errored = true;
          });
        }
      } catch (err) {
        sink.onError?.(`provider error: ${(err as Error).message}`);
        return;
      }
      if (errored) return;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: assistantText,
        toolCalls: toolCalls.length ? toolCalls : undefined,
      };
      this.messages.push(assistantMsg);
      recordEvent(this.deps.session, {
        ts: nowIso(),
        kind: 'assistant',
        content: assistantText,
        meta: toolCalls.length ? { toolCalls } : undefined,
      });

      if (!toolCalls.length) break;

      const env = resolveEnv(this.deps.paths);
      for (const call of toolCalls) {
        recordEvent(this.deps.session, {
          ts: nowIso(),
          kind: 'tool_call',
          content: JSON.stringify(call.input ?? {}),
          meta: { name: call.name, id: call.id },
        });
        const result = await this.dispatcher.dispatch(call, {
          cwd: this.deps.workingDir,
          env,
        });
        sink.onToolResult?.(call, result.output, result.isError ?? false);
        recordEvent(this.deps.session, {
          ts: nowIso(),
          kind: 'tool_result',
          content: result.output,
          meta: { name: call.name, toolCallId: call.id, isError: result.isError ?? false },
        });
        this.messages.push({
          role: 'tool',
          content: result.output,
          toolResult: result,
        });
      }
    }

    sink.onTurnComplete?.();
    await this.maybeCompact();
  }

  private handleEvent(
    ev: ChatEvent,
    sink: AgentEventSink,
    onText: (delta: string) => void,
    onToolCall: (call: ToolCall) => void,
    onError: () => void,
  ): void {
    switch (ev.kind) {
      case 'text':
        onText(ev.delta);
        sink.onAssistantText?.(ev.delta);
        break;
      case 'tool_call':
        onToolCall(ev.call);
        sink.onToolCall?.(ev.call);
        break;
      case 'error':
        sink.onError?.(ev.error);
        onError();
        break;
      case 'usage':
      case 'stop':
        break;
    }
  }

  async compactNow(): Promise<{ summary: string; eventsBefore: number; eventsAfter: number } | null> {
    const result = await compactSession(this.deps.session, {
      keepRecentTurns: this.deps.config.compaction.keepRecentTurns,
      provider: this.deps.provider,
      model: this.deps.model,
    });
    if (result) {
      // refresh in-memory messages from disk
      const { loadMessages } = await import('../history/session.js');
      this.messages = loadMessages(this.deps.session);
    }
    return result;
  }

  private async maybeCompact(): Promise<void> {
    const turns = this.messages.filter((m) => m.role === 'assistant').length;
    if (turns >= this.deps.config.compaction.turnThreshold) {
      await this.compactNow();
    }
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }
}
