import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ChatMessage } from '../core/types.js';
import { appendEvent, type HistoryEvent, nowIso, readEvents } from './jsonl.js';
import { appendTranscript, ensureTranscript, rewriteTranscript } from './markdown.js';

export interface SessionMeta {
  id: string;
  provider: string;
  model: string;
  startedAt: string;
  title?: string;
  cwd: string;
}

export interface Session {
  meta: SessionMeta;
  dir: string;
  eventsFile: string;
  transcriptFile: string;
  metaFile: string;
  compactionsDir: string;
}

export function makeSessionId(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  return `${stamp}-${randomUUID().slice(0, 8)}`;
}

export function createSession(
  sessionsDir: string,
  meta: Omit<SessionMeta, 'id' | 'startedAt'> & { id?: string; startedAt?: string },
): Session {
  const id = meta.id ?? makeSessionId();
  const fullMeta: SessionMeta = {
    id,
    provider: meta.provider,
    model: meta.model,
    cwd: meta.cwd,
    startedAt: meta.startedAt ?? nowIso(),
    title: meta.title,
  };
  const dir = join(sessionsDir, id);
  mkdirSync(dir, { recursive: true });
  const eventsFile = join(dir, 'events.jsonl');
  const transcriptFile = join(dir, 'transcript.md');
  const metaFile = join(dir, 'meta.json');
  const compactionsDir = join(dir, 'compactions');
  mkdirSync(compactionsDir, { recursive: true });
  writeFileSync(metaFile, JSON.stringify(fullMeta, null, 2));
  ensureTranscript(transcriptFile, `# MediaNode session ${id}\n\n_Started ${fullMeta.startedAt} · provider \`${fullMeta.provider}\` · model \`${fullMeta.model}\`_`);
  return { meta: fullMeta, dir, eventsFile, transcriptFile, metaFile, compactionsDir };
}

export function loadSession(sessionsDir: string, id: string): Session {
  const dir = join(sessionsDir, id);
  const metaFile = join(dir, 'meta.json');
  if (!existsSync(metaFile)) throw new Error(`Session not found: ${id}`);
  const meta = JSON.parse(readFileSync(metaFile, 'utf8')) as SessionMeta;
  return {
    meta,
    dir,
    eventsFile: join(dir, 'events.jsonl'),
    transcriptFile: join(dir, 'transcript.md'),
    metaFile,
    compactionsDir: join(dir, 'compactions'),
  };
}

export function listSessions(sessionsDir: string): SessionMeta[] {
  if (!existsSync(sessionsDir)) return [];
  const out: SessionMeta[] = [];
  for (const name of readdirSync(sessionsDir)) {
    const metaFile = join(sessionsDir, name, 'meta.json');
    if (existsSync(metaFile)) {
      try {
        out.push(JSON.parse(readFileSync(metaFile, 'utf8')) as SessionMeta);
      } catch {
        // ignore corrupt
      }
    }
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function recordEvent(session: Session, ev: HistoryEvent): void {
  appendEvent(session.eventsFile, ev);
  appendTranscript(session.transcriptFile, ev);
}

export function loadMessages(session: Session): ChatMessage[] {
  const events = readEvents(session.eventsFile);
  const messages: ChatMessage[] = [];
  for (const ev of events) {
    if (ev.kind === 'user') messages.push({ role: 'user', content: ev.content });
    else if (ev.kind === 'assistant') {
      const toolCalls = ev.meta?.toolCalls as ChatMessage['toolCalls'];
      messages.push({ role: 'assistant', content: ev.content, toolCalls });
    } else if (ev.kind === 'tool_result') {
      messages.push({
        role: 'tool',
        content: ev.content,
        toolResult: {
          toolCallId: String(ev.meta?.toolCallId ?? ''),
          name: String(ev.meta?.name ?? ''),
          output: ev.content,
          isError: Boolean(ev.meta?.isError),
        },
      });
    } else if (ev.kind === 'compaction') {
      messages.push({ role: 'system', content: ev.content });
    }
  }
  return messages;
}

export function saveMeta(session: Session): void {
  writeFileSync(session.metaFile, JSON.stringify(session.meta, null, 2));
}

export function rewriteSessionEvents(session: Session, events: HistoryEvent[]): void {
  // Rewrite both events.jsonl and transcript.md
  const { eventsFile, transcriptFile, meta } = session;
  writeFileSync(
    eventsFile,
    events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''),
  );
  rewriteTranscript(
    transcriptFile,
    `# MediaNode session ${meta.id}\n\n_Started ${meta.startedAt} · provider \`${meta.provider}\` · model \`${meta.model}\`_`,
    events,
  );
}
