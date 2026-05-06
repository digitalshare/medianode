import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export interface ResolvedPaths {
  globalRoot: string;
  projectRoot: string | null;
  effectiveRoot: string;
  scope: 'project' | 'global';
  skillsDirs: string[];
  sessionsDir: string;
  logsDir: string;
  configFile: string;
  envFile: string;
  globalConfigFile: string;
  globalEnvFile: string;
}

export function findProjectRoot(start: string = process.cwd()): string | null {
  let current = resolve(start);
  while (true) {
    const candidate = join(current, '.medianode');
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function resolvePaths(cwd: string = process.cwd()): ResolvedPaths {
  const globalRoot = join(homedir(), '.medianode');
  const projectRoot = findProjectRoot(cwd);
  const effectiveRoot = projectRoot ? join(projectRoot, '.medianode') : globalRoot;
  const scope: 'project' | 'global' = projectRoot ? 'project' : 'global';

  const skillsDirs: string[] = [];
  if (projectRoot) skillsDirs.push(join(projectRoot, '.medianode', 'skills'));
  skillsDirs.push(join(globalRoot, 'skills'));

  return {
    globalRoot,
    projectRoot,
    effectiveRoot,
    scope,
    skillsDirs,
    sessionsDir: join(effectiveRoot, 'sessions'),
    logsDir: join(effectiveRoot, 'logs'),
    configFile: join(effectiveRoot, 'config.json'),
    envFile: join(effectiveRoot, '.env'),
    globalConfigFile: join(globalRoot, 'config.json'),
    globalEnvFile: join(globalRoot, '.env'),
  };
}
