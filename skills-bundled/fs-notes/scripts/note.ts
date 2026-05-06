#!/usr/bin/env -S npx --yes tsx
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

interface Args {
  action?: string;
  path?: string;
  content?: string;
}

const NOTES_REL = '.medianode/notes';

async function main() {
  const args = (await readJson()) as Args;
  const action = args.action ?? '';
  const cwd = process.cwd();
  const root = join(cwd, NOTES_REL);
  if (!existsSync(root)) mkdirSync(root, { recursive: true });

  if (action === 'list') {
    const files = walk(root).map((p) => relative(root, p));
    process.stdout.write(JSON.stringify({ ok: true, root, files }));
    return;
  }

  if (!args.path) fail('path is required');
  if (isAbsolute(args.path!)) fail('path must be relative');
  const target = resolve(root, normalize(args.path!));
  if (!target.startsWith(root)) fail('path escapes notes root');

  switch (action) {
    case 'write': {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, args.content ?? '');
      process.stdout.write(JSON.stringify({ ok: true, path: target, bytes: (args.content ?? '').length }));
      break;
    }
    case 'append': {
      mkdirSync(dirname(target), { recursive: true });
      appendFileSync(target, args.content ?? '');
      process.stdout.write(JSON.stringify({ ok: true, path: target, appended: (args.content ?? '').length }));
      break;
    }
    case 'read': {
      if (!existsSync(target)) fail(`not found: ${args.path}`);
      const body = readFileSync(target, 'utf8');
      process.stdout.write(JSON.stringify({ ok: true, path: target, content: body }));
      break;
    }
    default:
      fail(`unknown action: ${action}`);
  }
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

async function readJson(): Promise<unknown> {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  if (!data.trim()) return {};
  return JSON.parse(data);
}

function fail(msg: string): never {
  process.stderr.write(msg);
  process.exit(2);
}

main().catch((err) => {
  process.stderr.write((err as Error).message);
  process.exit(1);
});
