import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type EventKind =
  | 'user'
  | 'assistant'
  | 'tool_call'
  | 'tool_result'
  | 'system'
  | 'compaction';

export interface HistoryEvent {
  ts: string;
  kind: EventKind;
  content: string;
  meta?: Record<string, unknown>;
}

export function appendEvent(path: string, ev: HistoryEvent): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(ev) + '\n');
}

export function readEvents(path: string): HistoryEvent[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as HistoryEvent);
}

export function rewriteEvents(path: string, events: HistoryEvent[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''));
}

export function nowIso(): string {
  return new Date().toISOString();
}
