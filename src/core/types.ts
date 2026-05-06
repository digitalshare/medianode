export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  output: string;
  isError?: boolean;
}

export interface ChatMessage {
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  toolResult?: ToolResult;
  name?: string;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Skill that owns this tool, used by the dispatcher. */
  skill: string;
}

export interface ChatRequest {
  model: string;
  system?: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
}

export type ChatEvent =
  | { kind: 'text'; delta: string }
  | { kind: 'tool_call'; call: ToolCall }
  | { kind: 'usage'; inputTokens: number; outputTokens: number }
  | { kind: 'stop'; reason: string }
  | { kind: 'error'; error: string };

export interface ModelInfo {
  id: string;
  contextWindow?: number;
  description?: string;
}

export interface ProviderAdapter {
  name: string;
  listModels(): Promise<ModelInfo[]>;
  stream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatEvent>;
}
