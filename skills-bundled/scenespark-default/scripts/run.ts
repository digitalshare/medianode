#!/usr/bin/env -S npx --yes tsx
import { execa } from 'execa';

interface Args {
  argv?: unknown;
  cwd?: string;
  stdin?: string;
  env?: Record<string, string>;
}

async function main() {
  const raw = await readStdin();
  let args: Args = {};
  if (raw) {
    try {
      args = JSON.parse(raw);
    } catch (err) {
      printErr(`bad JSON input: ${(err as Error).message}`);
      process.exit(2);
    }
  }
  if (!Array.isArray(args.argv)) {
    printErr('argv must be an array of strings');
    process.exit(2);
  }
  const argv = (args.argv as unknown[]).map(String);
  const env = { ...process.env, ...(args.env ?? {}) };

  // Preflight: detect missing scenespark binary, returning an actionable error.
  try {
    const result = await execa('scenespark', argv, {
      cwd: args.cwd,
      input: args.stdin,
      env,
      reject: false,
      timeout: 10 * 60_000,
    });
    const out = {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.exitCode ?? 0,
    };
    if (out.exitCode === 0) {
      process.stdout.write(JSON.stringify(out));
      process.exit(0);
    } else {
      process.stdout.write(JSON.stringify(out));
      process.exit(out.exitCode);
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      printErr(
        'scenespark CLI not found on PATH. Install it with `pip install scenespark` or `uv tool install scenespark`, then retry.',
      );
      process.exit(127);
    }
    printErr(`scenespark execution failed: ${err.message}`);
    process.exit(1);
  }
}

function printErr(msg: string) {
  process.stderr.write(msg);
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

main();
