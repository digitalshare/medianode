import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { HistoryEvent } from './jsonl.js';

export function ensureTranscript(path: string, header: string): void {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${header}\n\n`);
}

export function appendTranscript(path: string, ev: HistoryEvent): void {
  mkdirSync(dirname(path), { recursive: true });
  let block = '';
  switch (ev.kind) {
    case 'user':
      block = `### User\n\n${ev.content}\n\n`;
      break;
    case 'assistant':
      block = `### Assistant\n\n${ev.content}\n\n`;
      break;
    case 'tool_call':
      block = `<details><summary>Tool call: ${ev.meta?.name ?? '?'}</summary>\n\n\`\`\`json\n${ev.content}\n\`\`\`\n</details>\n\n`;
      break;
    case 'tool_result':
      block = `<details><summary>Tool result: ${ev.meta?.name ?? '?'}</summary>\n\n\`\`\`\n${ev.content}\n\`\`\`\n</details>\n\n`;
      break;
    case 'system':
      block = `> _system_: ${ev.content}\n\n`;
      break;
    case 'compaction':
      block = `> **compaction** — earlier turns summarized\n\n${ev.content}\n\n`;
      break;
  }
  appendFileSync(path, block);
}

export function rewriteTranscript(path: string, header: string, events: HistoryEvent[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${header}\n\n`);
  for (const ev of events) appendTranscript(path, ev);
}
