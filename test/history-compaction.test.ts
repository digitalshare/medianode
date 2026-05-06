import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSession, recordEvent } from '../src/history/session.js';
import { compactSession } from '../src/history/compactor.js';
import { nowIso } from '../src/history/jsonl.js';
import type { ChatEvent, ChatRequest, ProviderAdapter } from '../src/core/types.js';

class StubProvider implements ProviderAdapter {
  readonly name = 'stub';
  async listModels() {
    return [];
  }
  async *stream(_req: ChatRequest): AsyncIterable<ChatEvent> {
    yield { kind: 'text', delta: 'compacted summary of older turns.' };
    yield { kind: 'stop', reason: 'stop' };
  }
}

describe('history compaction', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'medianode-hist-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('rewrites events.jsonl and snapshots the prior state', async () => {
    const session = createSession(tmp, { provider: 'stub', model: 'm', cwd: tmp });
    for (let i = 0; i < 12; i++) {
      recordEvent(session, { ts: nowIso(), kind: 'user', content: `u${i}` });
      recordEvent(session, { ts: nowIso(), kind: 'assistant', content: `a${i}` });
    }
    const result = await compactSession(session, {
      keepRecentTurns: 4,
      provider: new StubProvider(),
      model: 'm',
    });
    expect(result).not.toBeNull();
    expect(result!.eventsAfter).toBeLessThan(result!.eventsBefore);

    const raw = readFileSync(session.eventsFile, 'utf8').trim().split('\n');
    const parsed = raw.map((l) => JSON.parse(l));
    expect(parsed[0].kind).toBe('compaction');

    const snaps = readdirSync(session.compactionsDir).filter((n) => n.endsWith('.jsonl'));
    expect(snaps.length).toBe(1);
    expect(existsSync(join(session.compactionsDir, snaps[0]!))).toBe(true);
  });
});
