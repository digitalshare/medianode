import type { SlashHandler } from './index.js';

export const helpCommand: SlashHandler = () => ({
  message: [
    'Slash commands:',
    '  /help                     Show this help',
    '  /provider [name]          Show or switch provider',
    '  /providers                List configured providers',
    '  /model [name]             Show or switch model',
    '  /models                   List models for current provider',
    '  /skill list               Installed skills',
    '  /skill install <src>      Install from git URL or path',
    '  /skill remove <name>      Uninstall',
    '  /skill update [name]      git pull for git-sourced skills',
    '  /skill enable <name>      Enable a skill for this session',
    '  /skill disable <name>     Disable a skill for this session',
    '  /tools                    Tools currently exposed to the model',
    '  /compact                  Manually summarize older turns',
    '  /clear                    Start a new session',
    '  /save [name]              Bookmark current session (alias of session id)',
    '  /load <name>              Resume a saved session',
    '  /history                  Print path to the markdown transcript',
    '  /system <text>            Set or replace the session system prompt prefix',
    '  /cwd [path]               Show or change the working directory',
    '  /quit                     Exit',
  ].join('\n'),
});
