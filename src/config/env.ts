import { existsSync, readFileSync } from 'node:fs';
import { parse as parseDotenv } from 'dotenv';
import type { ResolvedPaths } from './paths.js';

export interface EnvLayer {
  source: 'project' | 'global' | 'process';
  values: Record<string, string>;
}

export function loadEnvLayers(paths: ResolvedPaths): EnvLayer[] {
  const layers: EnvLayer[] = [];
  if (paths.scope === 'project' && existsSync(paths.envFile)) {
    layers.push({ source: 'project', values: parseDotenv(readFileSync(paths.envFile)) });
  }
  if (existsSync(paths.globalEnvFile)) {
    layers.push({ source: 'global', values: parseDotenv(readFileSync(paths.globalEnvFile)) });
  }
  layers.push({ source: 'process', values: { ...process.env } as Record<string, string> });
  return layers;
}

export function resolveEnv(paths: ResolvedPaths): Record<string, string> {
  const layers = loadEnvLayers(paths);
  const merged: Record<string, string> = {};
  // last layer wins (process env first to seed, then layers reverse-order project highest priority)
  // To make project win, walk layers in reverse-priority order: process → global → project.
  const ordered = [...layers].reverse();
  for (const layer of ordered) {
    for (const [k, v] of Object.entries(layer.values)) {
      if (v !== undefined) merged[k] = v;
    }
  }
  return merged;
}

export function getApiKey(paths: ResolvedPaths, envKey: string | undefined): string | undefined {
  if (!envKey) return undefined;
  const env = resolveEnv(paths);
  return env[envKey];
}
