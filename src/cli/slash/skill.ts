import type { SlashHandler } from './index.js';
import { installSkill, removeSkill, updateSkill } from '../../skills/installer.js';
import { mergeConfig } from '../../config/schema.js';

export const skillCommand: SlashHandler = async (args, ctx) => {
  const sub = args.shift();
  switch (sub) {
    case undefined:
    case 'list': {
      const enabled = new Set(ctx.config.skills.enabled);
      const lines = ctx.registry.all.map((s) => {
        const flag = enabled.has(s.manifest.name) ? '✓' : ' ';
        const tools = s.manifest.tools.length
          ? ` — tools: ${s.manifest.tools.map((t) => t.name).join(', ')}`
          : '';
        return `  [${flag}] ${s.manifest.name}${s.manifest.version ? ` v${s.manifest.version}` : ''}${tools}`;
      });
      return { message: ['skills:', ...lines].join('\n') };
    }
    case 'install': {
      const src = args[0];
      if (!src) return { message: 'usage: /skill install <git-url|path>' };
      const result = await installSkill(src, ctx.paths);
      ctx.rebuildRegistry();
      return { message: `installed ${result.name} from ${result.source} ${result.sourceRef}` };
    }
    case 'remove': {
      const name = args[0];
      if (!name) return { message: 'usage: /skill remove <name>' };
      const ok = removeSkill(name, ctx.paths);
      ctx.rebuildRegistry();
      return { message: ok ? `removed ${name}` : `not installed: ${name}` };
    }
    case 'update': {
      const name = args[0];
      if (name) {
        const r = await updateSkill(name, ctx.paths);
        ctx.rebuildRegistry();
        return { message: r.updated ? `updated ${name}` : `${name} is not git-sourced` };
      }
      const updated: string[] = [];
      for (const s of ctx.registry.all) {
        try {
          const r = await updateSkill(s.manifest.name, ctx.paths);
          if (r.updated) updated.push(s.manifest.name);
        } catch {
          // skip non-installed
        }
      }
      ctx.rebuildRegistry();
      return { message: updated.length ? `updated: ${updated.join(', ')}` : 'no git-sourced skills updated' };
    }
    case 'enable': {
      const name = args[0];
      if (!name) return { message: 'usage: /skill enable <name>' };
      const enabled = new Set(ctx.config.skills.enabled);
      enabled.add(name);
      const next = mergeConfig(ctx.config, { skills: { enabled: [...enabled] } });
      ctx.setConfig(next);
      ctx.rebuildRegistry();
      return { message: `enabled ${name}` };
    }
    case 'disable': {
      const name = args[0];
      if (!name) return { message: 'usage: /skill disable <name>' };
      const enabled = ctx.config.skills.enabled.filter((n) => n !== name);
      const next = mergeConfig(ctx.config, { skills: { enabled } });
      ctx.setConfig(next);
      ctx.rebuildRegistry();
      return { message: `disabled ${name}` };
    }
    default:
      return { message: `unknown subcommand: ${sub}. try /skill list|install|remove|update|enable|disable` };
  }
};
