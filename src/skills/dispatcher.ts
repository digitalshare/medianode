import { execa } from 'execa';
import { extname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { ToolCall, ToolResult } from '../core/types.js';
import type { SkillTool } from './types.js';

export interface DispatchOptions {
  cwd: string;
  env: Record<string, string>;
  /** Wall-clock timeout in ms. */
  timeoutMs?: number;
}

export class ToolDispatcher {
  constructor(private tools: SkillTool[]) {}

  has(name: string): boolean {
    return this.tools.some((t) => t.name === name);
  }

  async dispatch(call: ToolCall, opts: DispatchOptions): Promise<ToolResult> {
    const tool = this.tools.find((t) => t.name === call.name);
    if (!tool) {
      return {
        toolCallId: call.id,
        name: call.name,
        output: `Unknown tool: ${call.name}`,
        isError: true,
      };
    }
    const argv = await buildArgv(tool);
    if (!argv) {
      return {
        toolCallId: call.id,
        name: call.name,
        output: `Tool '${tool.name}' has no script or command in skill '${tool.skill}'.`,
        isError: true,
      };
    }
    try {
      const merged = { ...opts.env, MEDIANODE_TOOL: tool.name, MEDIANODE_SKILL: tool.skill };
      const child = await execa(argv[0]!, argv.slice(1), {
        cwd: opts.cwd,
        env: merged,
        input: JSON.stringify(call.input ?? {}),
        timeout: opts.timeoutMs ?? 5 * 60_000,
        reject: false,
      });
      const stdout = child.stdout ?? '';
      const stderr = child.stderr ?? '';
      const isError = (child.exitCode ?? 0) !== 0;
      return {
        toolCallId: call.id,
        name: call.name,
        output: isError
          ? `[exit ${child.exitCode}] ${stderr || stdout}`
          : stdout || stderr || '(no output)',
        isError,
      };
    } catch (err) {
      return {
        toolCallId: call.id,
        name: call.name,
        output: `Tool execution failed: ${(err as Error).message}`,
        isError: true,
      };
    }
  }
}

async function buildArgv(tool: SkillTool): Promise<string[] | null> {
  if (tool.spec.command?.length) {
    return tool.spec.command.map((arg) => arg.replace('${SKILL_DIR}', tool.dir));
  }
  if (!tool.spec.script) return null;
  const path = resolve(tool.dir, tool.spec.script);
  if (!existsSync(path)) {
    throw new Error(`Tool script not found: ${path}`);
  }
  const ext = extname(path).toLowerCase();
  if (ext === '.ts' || ext === '.tsx') {
    return ['npx', '--yes', 'tsx', path];
  }
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    return [process.execPath, path];
  }
  if (ext === '.sh') {
    return ['bash', path];
  }
  if (ext === '.py') {
    return ['python3', path];
  }
  // assume executable
  return [path];
}

export type { SkillTool } from './types.js';
export { join };
