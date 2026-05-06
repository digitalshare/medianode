import type { ToolDef } from '../core/types.js';

export interface SkillToolSpec {
  name: string;
  description: string;
  /** JSON schema body (without the wrapping `type: object`). */
  params?: Record<string, unknown>;
  required?: string[];
  /** Script path relative to the skill directory. */
  script?: string;
  /** Optional override of the runner argv. */
  command?: string[];
}

export interface SkillManifest {
  name: string;
  description: string;
  version?: string;
  whenToUse?: string;
  instructions?: string;
  tools: SkillToolSpec[];
  /** Source kind for update tracking. */
  source?: 'bundled' | 'git' | 'path' | 'unknown';
  sourceRef?: string;
}

export interface LoadedSkill {
  manifest: SkillManifest;
  /** Filesystem directory holding the skill (after install / for bundled). */
  dir: string;
  /** Body of SKILL.md (frontmatter stripped) for system-prompt injection. */
  body: string;
  /** Vendored docs (e.g. SceneSpark upstream-SKILL.md) merged into the system prompt. */
  vendorBlocks: { title: string; body: string }[];
}

export interface SkillTool extends ToolDef {
  /** The skill that owns this tool. */
  skill: string;
  /** Underlying tool spec. */
  spec: SkillToolSpec;
  /** Skill directory. */
  dir: string;
}
