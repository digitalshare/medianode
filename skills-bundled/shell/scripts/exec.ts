#!/usr/bin/env -S npx --yes tsx
import { execa } from 'execa';

interface Args {
  argv?: unknown;
  command?: string;
  shell?: boolean;
  cwd?: string;
  env?: Record<string, string>;
}

async function main() {
  const args = (await readJson()) as Args;
  const env = { ...process.env, ...(args.env ?? {}) };
  if (args.shell) {
    if (!args.command) fail('shell mode requires `command`');
    const r = await execa('bash', ['-c', args.command!], {
      cwd: args.cwd,
      env,
      reject: false,
      timeout: 10 * 60_000,
    });
    process.stdout.write(
      JSON.stringify({ stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode }),
    );
    process.exit(r.exitCode ?? 0);
  }
  if (!Array.isArray(args.argv) || args.argv.length === 0) fail('argv is required');
  const argv = (args.argv as unknown[]).map(String);
  const r = await execa(argv[0]!, argv.slice(1), {
    cwd: args.cwd,
    env,
    reject: false,
    timeout: 10 * 60_000,
  });
  process.stdout.write(
    JSON.stringify({ stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode }),
  );
  process.exit(r.exitCode ?? 0);
}

async function readJson(): Promise<unknown> {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.trim() ? JSON.parse(data) : {};
}

function fail(msg: string): never {
  process.stderr.write(msg);
  process.exit(2);
}

main().catch((err) => {
  process.stderr.write((err as Error).message);
  process.exit(1);
});
