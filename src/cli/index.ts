#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureScopeDirs, loadConfig, setApiKey, writeConfigInit } from '../config/index.js';
import { runOneShot } from './oneshot.js';
import { runRepl } from './repl.js';
import { installSkill, removeSkill, updateSkill } from '../skills/installer.js';
import { buildRegistry } from '../skills/registry.js';
import { PROVIDER_ORDER } from '../providers/index.js';

function getVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();
program
  .name('medianode')
  .description('CLI agent for media production workflows.')
  .version(getVersion(), '-v, --version')
  .argument('[prompt...]', 'one-shot prompt; omit for REPL')
  .option('-p, --provider <name>', 'provider to use')
  .option('-m, --model <name>', 'model to use')
  .option('--cwd <path>', 'working directory passed to skill subprocesses')
  .action(async (promptParts: string[], opts) => {
    const cwd = opts.cwd ?? process.cwd();
    const { config, paths } = loadConfig(cwd);
    ensureScopeDirs(paths);
    const text = (promptParts ?? []).join(' ').trim();
    if (!text) {
      await runRepl({ config, paths, cwd, provider: opts.provider, model: opts.model });
      return;
    }
    const code = await runOneShot({
      prompt: text,
      config,
      paths,
      provider: opts.provider,
      model: opts.model,
      cwd,
    });
    process.exit(code);
  });

const skill = program.command('skill').description('Manage skills');
skill
  .command('list')
  .description('List installed skills')
  .action(() => {
    const { config, paths } = loadConfig();
    const reg = buildRegistry(config, paths);
    const enabled = new Set(config.skills.enabled);
    for (const s of reg.all) {
      const flag = enabled.has(s.manifest.name) ? '✓' : ' ';
      console.log(`[${flag}] ${s.manifest.name}${s.manifest.version ? ` v${s.manifest.version}` : ''}  ${s.manifest.description}`);
    }
  });
skill
  .command('install <source>')
  .description('Install a skill from git URL or filesystem path')
  .action(async (source: string) => {
    const { paths } = loadConfig();
    const r = await installSkill(source, paths);
    console.log(`installed ${r.name} (${r.source}) → ${r.dir}`);
  });
skill
  .command('remove <name>')
  .description('Uninstall a skill by name')
  .action((name: string) => {
    const { paths } = loadConfig();
    const ok = removeSkill(name, paths);
    console.log(ok ? `removed ${name}` : `not installed: ${name}`);
  });
skill
  .command('update [name]')
  .description('git pull a skill (or all git-sourced skills)')
  .action(async (name?: string) => {
    const { config, paths } = loadConfig();
    const reg = buildRegistry(config, paths);
    const targets = name ? [name] : reg.all.map((s) => s.manifest.name);
    for (const n of targets) {
      try {
        const r = await updateSkill(n, paths);
        console.log(r.updated ? `updated ${n}` : `${n}: not git-sourced`);
      } catch (err) {
        console.log(`${n}: ${(err as Error).message}`);
      }
    }
  });

const config = program.command('config').description('Manage configuration');
config
  .command('init')
  .description('Write default config and .env templates to current scope')
  .action(() => {
    const { paths } = loadConfig();
    writeConfigInit(paths);
    console.log(`config initialised at ${paths.effectiveRoot}`);
  });
config
  .command('show')
  .description('Print resolved config')
  .action(() => {
    const { config, paths } = loadConfig();
    console.log(JSON.stringify({ scope: paths.scope, paths, config }, null, 2));
  });
config
  .command('set-key <provider> <value>')
  .description('Write an API key into the global ~/.medianode/.env')
  .action((provider: string, value: string) => {
    const { config, paths } = loadConfig();
    if (!PROVIDER_ORDER.includes(provider as any)) {
      console.error(`unknown provider: ${provider}. known: ${PROVIDER_ORDER.join(', ')}`);
      process.exit(2);
    }
    const envKey = config.providers[provider]?.envKey;
    if (!envKey) {
      console.error(`provider ${provider} has no envKey (it likely uses a baseUrl instead)`);
      process.exit(2);
    }
    setApiKey(paths, envKey, value);
    console.log(`wrote ${envKey} to ${paths.globalEnvFile}`);
  });

program.parseAsync().catch((err) => {
  if (err && typeof err === 'object' && (err as any).name === 'ProviderUnavailableError') {
    console.error((err as Error).message);
    process.exit(2);
  }
  console.error(err?.stack ?? err?.message ?? String(err));
  process.exit(1);
});
