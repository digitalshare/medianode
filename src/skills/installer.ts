import { existsSync, mkdirSync, rmSync, symlinkSync, lstatSync } from 'node:fs';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { simpleGit } from 'simple-git';
import type { ResolvedPaths } from '../config/paths.js';
import { loadSkillFromDir } from './loader.js';
import { userSkillsRoot } from './registry.js';

export interface InstallResult {
  name: string;
  dir: string;
  source: 'git' | 'path';
  sourceRef: string;
}

function isGitUrl(s: string): boolean {
  return (
    /^https?:\/\//i.test(s) ||
    /^git@/i.test(s) ||
    /^git:\/\//i.test(s) ||
    /^ssh:\/\//i.test(s) ||
    s.endsWith('.git')
  );
}

export async function installSkill(source: string, paths: ResolvedPaths): Promise<InstallResult> {
  const root = userSkillsRoot(paths);
  mkdirSync(root, { recursive: true });

  if (isGitUrl(source)) {
    const name = basename(source).replace(/\.git$/, '');
    const target = join(root, name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    await simpleGit().clone(source, target, ['--depth', '1']);
    const sk = loadSkillFromDir(target);
    if (!sk) throw new Error(`Cloned ${source} but no SKILL.md found at ${target}`);
    return { name: sk.manifest.name, dir: target, source: 'git', sourceRef: source };
  }

  const abs = isAbsolute(source) ? source : resolve(process.cwd(), source);
  if (!existsSync(abs)) throw new Error(`Path not found: ${source}`);
  const sk = loadSkillFromDir(abs);
  if (!sk) throw new Error(`No SKILL.md found at ${abs}`);
  const target = join(root, sk.manifest.name);
  if (existsSync(target)) {
    if (lstatSync(target).isSymbolicLink()) rmSync(target);
    else rmSync(target, { recursive: true, force: true });
  }
  symlinkSync(abs, target, 'dir');
  return { name: sk.manifest.name, dir: target, source: 'path', sourceRef: abs };
}

export async function updateSkill(name: string, paths: ResolvedPaths): Promise<{ updated: boolean; dir: string }> {
  const dir = join(userSkillsRoot(paths), name);
  if (!existsSync(dir)) throw new Error(`Skill not installed: ${name}`);
  if (existsSync(join(dir, '.git'))) {
    const git = simpleGit(dir);
    await git.pull();
    return { updated: true, dir };
  }
  return { updated: false, dir };
}

export function removeSkill(name: string, paths: ResolvedPaths): boolean {
  const dir = join(userSkillsRoot(paths), name);
  if (!existsSync(dir)) return false;
  if (lstatSync(dir).isSymbolicLink()) rmSync(dir);
  else rmSync(dir, { recursive: true, force: true });
  return true;
}
