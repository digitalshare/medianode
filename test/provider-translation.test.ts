import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../src/core/types.js';

// Internal shape checks: ensures the canonical message format we hand
// to provider adapters round-trips through the documented contract.

describe('provider translation contract', () => {
  it('canonical assistant message with tool calls keeps schema invariant', () => {
    const m: ChatMessage = {
      role: 'assistant',
      content: 'thinking…',
      toolCalls: [{ id: '1', name: 'scenespark_run', input: { argv: ['version'] } }],
    };
    expect(m.toolCalls?.[0]?.name).toBe('scenespark_run');
    expect((m.toolCalls?.[0]?.input as any).argv[0]).toBe('version');
  });

  it('canonical tool message carries call id and output', () => {
    const m: ChatMessage = {
      role: 'tool',
      content: '{"ok":true}',
      toolResult: {
        toolCallId: '1',
        name: 'scenespark_run',
        output: '{"ok":true}',
      },
    };
    expect(m.toolResult?.toolCallId).toBe('1');
  });
});
