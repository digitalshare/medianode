#!/usr/bin/env -S npx --yes tsx
import { fetch } from 'undici';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_URL = 'https://digitalshare.github.io/scenespark/cli/latest.json';
const SKILL_URL = 'https://digitalshare.github.io/scenespark/cli/skills/generic/SKILL.md';

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const vendor = join(here, '..', 'vendor');
  mkdirSync(vendor, { recursive: true });

  const manifestPath = join(vendor, 'latest.json');
  const skillPath = join(vendor, 'upstream-SKILL.md');

  const before = existsSync(manifestPath)
    ? safeJson(readFileSync(manifestPath, 'utf8'))
    : { commands: [] as { name: string }[] };

  const [manifestRes, skillRes] = await Promise.all([fetch(MANIFEST_URL), fetch(SKILL_URL)]);
  if (!manifestRes.ok) {
    process.stderr.write(`failed to fetch manifest: ${manifestRes.status}`);
    process.exit(1);
  }
  if (!skillRes.ok) {
    process.stderr.write(`failed to fetch skill: ${skillRes.status}`);
    process.exit(1);
  }
  const manifest = await manifestRes.json();
  const skill = await skillRes.text();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  writeFileSync(skillPath, skill);

  const beforeNames = new Set(((before as any).commands ?? []).map((c: any) => c.name));
  const afterNames = new Set(((manifest as any).commands ?? []).map((c: any) => c.name));
  const added = [...afterNames].filter((n) => !beforeNames.has(n));
  const removed = [...beforeNames].filter((n) => !afterNames.has(n));
  process.stdout.write(
    JSON.stringify({
      ok: true,
      manifestPath,
      skillPath,
      added,
      removed,
      total: afterNames.size,
    }),
  );
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

main().catch((err) => {
  process.stderr.write(`refresh failed: ${(err as Error).message}`);
  process.exit(1);
});
