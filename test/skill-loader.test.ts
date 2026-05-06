import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadSkillFromDir } from '../src/skills/loader.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', 'skills-bundled');

describe('skill loader', () => {
  it('loads scenespark-default with vendor blocks', () => {
    const sk = loadSkillFromDir(resolve(ROOT, 'scenespark-default'));
    expect(sk).not.toBeNull();
    expect(sk!.manifest.name).toBe('scenespark-default');
    expect(sk!.manifest.tools.map((t) => t.name)).toContain('scenespark_run');
    expect(sk!.vendorBlocks.length).toBeGreaterThan(0);
  });

  it('loads fs-notes', () => {
    const sk = loadSkillFromDir(resolve(ROOT, 'fs-notes'));
    expect(sk).not.toBeNull();
    expect(sk!.manifest.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['note_write', 'note_append', 'note_read', 'note_list']),
    );
  });
});
