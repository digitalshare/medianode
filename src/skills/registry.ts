import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import type { ResolvedPaths } from '../config/paths.js';
import type { Config } from '../config/schema.js';
import { discoverSkills, loadSkillFromDir } from './loader.js';
import type { LoadedSkill, SkillTool } from './types.js';

/** Where bundled skills live relative to the built CLI entrypoint. */
function bundledSkillsRoot(): string {
  // src/skills/registry.ts → at runtime: dist/skills/registry.js
  // Bundled skills are at <pkg>/skills-bundled.
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/skills → ../.. → package root
  return resolve(here, '..', '..', 'skills-bundled');
}

export interface SkillRegistry {
  all: LoadedSkill[];
  enabled: LoadedSkill[];
  tools: SkillTool[];
  systemPromptBlocks: string[];
}

export function buildRegistry(cfg: Config, paths: ResolvedPaths): SkillRegistry {
  const roots: string[] = [];
  // Bundled skills first
  roots.push(bundledSkillsRoot());
  // Project-scope skills (highest project priority)
  for (const dir of paths.skillsDirs) roots.push(dir);

  const all = discoverSkills(roots);
  const enabledNames = new Set(cfg.skills.enabled);
  const enabled = all.filter((s) => enabledNames.has(s.manifest.name));

  const tools: SkillTool[] = [];
  for (const sk of enabled) {
    for (const spec of sk.manifest.tools) {
      const params = spec.params ?? {};
      const required = spec.required ?? [];
      tools.push({
        name: spec.name,
        description: spec.description,
        parameters: { properties: params, ...(required.length ? { required } : {}) },
        skill: sk.manifest.name,
        spec,
        dir: sk.dir,
      });
    }
  }

  const systemPromptBlocks: string[] = [];
  for (const sk of enabled) {
    const header = `### Skill: ${sk.manifest.name}`;
    const body = [
      sk.manifest.description ? `**${sk.manifest.description}**` : '',
      sk.manifest.whenToUse ? `\n_When to use:_ ${sk.manifest.whenToUse}` : '',
      sk.manifest.instructions ? `\n${sk.manifest.instructions}` : '',
      sk.body ? `\n${sk.body}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    systemPromptBlocks.push(`${header}\n\n${body}`);
    for (const v of sk.vendorBlocks) {
      systemPromptBlocks.push(`### ${sk.manifest.name} reference: ${v.title}\n\n${v.body}`);
    }
  }

  return { all, enabled, tools, systemPromptBlocks };
}

export function reloadSkillFromDisk(dir: string): LoadedSkill | null {
  return loadSkillFromDir(dir);
}

export function bundledRoot(): string {
  return bundledSkillsRoot();
}

export function userSkillsRoot(paths: ResolvedPaths): string {
  return paths.skillsDirs[0] ?? join(paths.effectiveRoot, 'skills');
}
