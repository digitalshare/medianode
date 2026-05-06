import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProviderAdapter, ChatRequest } from '../core/types.js';
import { type HistoryEvent, nowIso, readEvents } from './jsonl.js';
import { type Session, rewriteSessionEvents } from './session.js';

export interface CompactionOptions {
  keepRecentTurns: number;
  provider: ProviderAdapter;
  model: string;
}

function countAssistantTurns(events: HistoryEvent[]): number {
  return events.filter((e) => e.kind === 'assistant').length;
}

export async function compactSession(
  session: Session,
  opts: CompactionOptions,
): Promise<{ summary: string; eventsBefore: number; eventsAfter: number } | null> {
  const events = readEvents(session.eventsFile);
  const turns = countAssistantTurns(events);
  if (turns <= opts.keepRecentTurns) return null;

  // Snapshot pre-compaction state
  const idx = countCompactions(session) + 1;
  const snapshotPath = join(
    session.compactionsDir,
    `${String(idx).padStart(4, '0')}.jsonl`,
  );
  writeFileSync(snapshotPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n');

  // Find the cutoff: keep last N assistant turns + their preceding user/tool context
  let recentAssistantSeen = 0;
  let cutoff = events.length;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]!.kind === 'assistant') {
      recentAssistantSeen += 1;
      if (recentAssistantSeen === opts.keepRecentTurns) {
        cutoff = i;
        // walk back through any preceding user/tool events that belong to this turn
        while (cutoff > 0 && events[cutoff - 1]!.kind !== 'assistant') cutoff -= 1;
        break;
      }
    }
  }

  const older = events.slice(0, cutoff);
  const recent = events.slice(cutoff);

  const summary = await summarize(older, opts);

  const compactionEvent: HistoryEvent = {
    ts: nowIso(),
    kind: 'compaction',
    content: summary,
    meta: { replacedEvents: older.length, snapshotIndex: idx },
  };

  const newEvents: HistoryEvent[] = [compactionEvent, ...recent];
  rewriteSessionEvents(session, newEvents);
  return { summary, eventsBefore: events.length, eventsAfter: newEvents.length };
}

function countCompactions(session: Session): number {
  try {
    const items = readdirSync(session.compactionsDir);
    return items.filter((n) => /^\d+\.jsonl$/.test(n)).length;
  } catch {
    return 0;
  }
}

async function summarize(older: HistoryEvent[], opts: CompactionOptions): Promise<string> {
  const transcript = older
    .map((ev) => {
      switch (ev.kind) {
        case 'user':
          return `User: ${ev.content}`;
        case 'assistant':
          return `Assistant: ${ev.content}`;
        case 'tool_call':
          return `[tool_call ${ev.meta?.name}] ${ev.content}`;
        case 'tool_result':
          return `[tool_result ${ev.meta?.name}] ${ev.content.slice(0, 800)}`;
        case 'system':
          return `[system] ${ev.content}`;
        case 'compaction':
          return `[prior summary] ${ev.content}`;
      }
    })
    .join('\n\n');

  const req: ChatRequest = {
    model: opts.model,
    system:
      'You compact a media-production agent transcript. Produce a tight bullet list capturing decisions, file paths, key user goals, ' +
      'still-open questions, and any tool outputs the model will need to recall. No filler.',
    messages: [
      {
        role: 'user',
        content: `Summarize the following transcript so the next turn can continue without it:\n\n${transcript}`,
      },
    ],
  };

  let summary = '';
  for await (const ev of opts.provider.stream(req)) {
    if (ev.kind === 'text') summary += ev.delta;
    if (ev.kind === 'error') {
      summary = `(compaction failed: ${ev.error}) — verbatim head:\n\n${transcript.slice(0, 4000)}`;
      break;
    }
  }
  return summary.trim() || '(empty summary)';
}
