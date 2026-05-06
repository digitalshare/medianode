import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import type { LoadedSkill, SkillManifest } from './types.js';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export function loadSkillFromDir(dir: string): LoadedSkill | null {
  const skillFile = join(dir, 'SKILL.md');
  if (!existsSync(skillFile)) return null;
  const raw = readFileSync(skillFile, 'utf8');
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return null;
  const fmRaw = m[1] ?? '';
  let fm: any = {};
  try {
    fm = YAML.parse(fmRaw) ?? {};
  } catch (err) {
    throw new Error(`Failed to parse SKILL.md frontmatter in ${dir}: ${(err as Error).message}`);
  }
  const body = raw.slice(m[0].length).trim();
  const manifest: SkillManifest = {
    name: String(fm.name ?? ''),
    description: String(fm.description ?? ''),
    version: fm.version ? String(fm.version) : undefined,
    whenToUse: fm.whenToUse ?? fm['when-to-use'],
    instructions: fm.instructions,
    tools: Array.isArray(fm.tools) ? fm.tools.map(normalizeTool) : [],
    source: fm.source,
    sourceRef: fm.sourceRef,
  };
  if (!manifest.name) return null;

  const vendorBlocks = readVendorBlocks(dir);
  return { manifest, dir, body, vendorBlocks };
}

function normalizeTool(t: any) {
  return {
    name: String(t.name),
    description: String(t.description ?? ''),
    params: typeof t.params === 'object' && t.params ? t.params : {},
    required: Array.isArray(t.required) ? t.required : [],
    script: t.script ? String(t.script) : undefined,
    command: Array.isArray(t.command) ? t.command : undefined,
  };
}

function readVendorBlocks(dir: string): { title: string; body: string }[] {
  const vendorDir = join(dir, 'vendor');
  if (!existsSync(vendorDir) || !statSync(vendorDir).isDirectory()) return [];
  const blocks: { title: string; body: string }[] = [];
  for (const name of readdirSync(vendorDir)) {
    if (!name.endsWith('.md')) continue;
    blocks.push({
      title: name.replace(/\.md$/, ''),
      body: readFileSync(join(vendorDir, name), 'utf8'),
    });
  }
  return blocks;
}

export function discoverSkills(roots: string[]): LoadedSkill[] {
  const out: LoadedSkill[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      const dir = join(root, entry);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      const sk = loadSkillFromDir(dir);
      if (sk && !seen.has(sk.manifest.name)) {
        seen.add(sk.manifest.name);
        out.push(sk);
      }
    }
  }
  return out;
}
