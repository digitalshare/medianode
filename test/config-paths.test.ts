import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findProjectRoot, resolvePaths } from '../src/config/paths.js';
import { mergeConfig, defaultConfig } from '../src/config/schema.js';

describe('config paths', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'medianode-test-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('finds the project root via .medianode/ walk-up', () => {
    const project = join(tmp, 'a', 'b', 'c');
    mkdirSync(project, { recursive: true });
    mkdirSync(join(tmp, 'a', '.medianode'));
    expect(findProjectRoot(project)).toBe(join(tmp, 'a'));
  });

  it('returns null when no .medianode/ exists', () => {
    const project = join(tmp, 'no-marker');
    mkdirSync(project, { recursive: true });
    // package.json must NOT count as a marker
    writeFileSync(join(project, 'package.json'), '{}');
    expect(findProjectRoot(project)).toBe(null);
  });

  it('selects project scope when .medianode exists', () => {
    const project = join(tmp, 'with-scope');
    mkdirSync(join(project, '.medianode'), { recursive: true });
    const paths = resolvePaths(project);
    expect(paths.scope).toBe('project');
    expect(paths.effectiveRoot).toBe(join(project, '.medianode'));
  });
});

describe('config merge', () => {
  it('overlays project values onto defaults', () => {
    const merged = mergeConfig(defaultConfig(), {
      defaultProvider: 'openai',
      defaultModel: 'gpt-5',
    });
    expect(merged.defaultProvider).toBe('openai');
    expect(merged.defaultModel).toBe('gpt-5');
    expect(merged.providers.anthropic).toBeDefined();
  });
});
