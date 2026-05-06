import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { type Config, ConfigSchema, defaultConfig, mergeConfig } from './schema.js';
import { type ResolvedPaths, resolvePaths } from './paths.js';

export interface LoadedConfig {
  config: Config;
  paths: ResolvedPaths;
}

function readJsonIfExists(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse config at ${path}: ${(err as Error).message}`);
  }
}

export function loadConfig(cwd: string = process.cwd()): LoadedConfig {
  const paths = resolvePaths(cwd);
  let config = defaultConfig();

  const globalRaw = readJsonIfExists(paths.globalConfigFile);
  if (globalRaw) {
    const parsed = ConfigSchema.partial().parse(globalRaw) as Partial<Config>;
    config = mergeConfig(config, parsed);
  }
  if (paths.scope === 'project') {
    const projectRaw = readJsonIfExists(paths.configFile);
    if (projectRaw) {
      const parsed = ConfigSchema.partial().parse(projectRaw) as Partial<Config>;
      config = mergeConfig(config, parsed);
    }
  }

  return { config, paths };
}

export function ensureScopeDirs(paths: ResolvedPaths): void {
  for (const dir of [paths.effectiveRoot, paths.sessionsDir, paths.logsDir, ...paths.skillsDirs]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

export function writeConfigInit(paths: ResolvedPaths): void {
  ensureScopeDirs(paths);
  if (!existsSync(paths.configFile)) {
    const cfg = defaultConfig();
    mkdirSync(dirname(paths.configFile), { recursive: true });
    writeFileSync(paths.configFile, JSON.stringify(cfg, null, 2));
  }
  if (!existsSync(paths.envFile)) {
    writeFileSync(
      paths.envFile,
      [
        '# MediaNode environment',
        '# ANTHROPIC_API_KEY=',
        '# OPENAI_API_KEY=',
        '# GOOGLE_API_KEY=',
        '# OPENROUTER_API_KEY=',
        '# XAI_API_KEY=',
        '# DEEPSEEK_API_KEY=',
        '',
      ].join('\n'),
    );
  }
}

export function setApiKey(paths: ResolvedPaths, envKey: string, value: string): void {
  const target = paths.globalEnvFile;
  mkdirSync(dirname(target), { recursive: true });
  let lines: string[] = [];
  if (existsSync(target)) lines = readFileSync(target, 'utf8').split(/\r?\n/);
  let replaced = false;
  const re = new RegExp(`^\\s*${envKey}\\s*=`);
  lines = lines.map((line) => {
    if (re.test(line)) {
      replaced = true;
      return `${envKey}=${value}`;
    }
    return line;
  });
  if (!replaced) lines.push(`${envKey}=${value}`);
  writeFileSync(target, lines.filter((l, i, a) => !(l === '' && i === a.length - 1)).join('\n') + '\n');
}

export * from './schema.js';
export * from './paths.js';
export * from './env.js';
