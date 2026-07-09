import type { CommandContext, CommandResult } from '../types';

export const basicCommands = {
  clear(_ctx: CommandContext): CommandResult {
    return { output: [], clear: true };
  },

  echo(ctx: CommandContext): CommandResult {
    const { args, session } = ctx;
    // Handle -e flag for escape sequences (basic)
    const escape = args[0] === '-e';
    const text = escape ? args.slice(1).join(' ') : args.join(' ');

    // Variable substitution
    const expanded = text.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, name) => session.env[name] ?? '');

    return { output: [{ type: 'stdout', content: expanded }] };
  },

  history(ctx: CommandContext): CommandResult {
    const { session } = ctx;
    if (session.history.length === 0) {
      return { output: [{ type: 'info', content: 'No commands in history.' }] };
    }
    const lines = session.history.map((cmd, i) => ({
      type: 'stdout' as const,
      content: `  ${String(i + 1).padStart(4)}  ${cmd}`,
    }));
    return { output: lines };
  },

  help(_ctx: CommandContext): CommandResult {
    const helpText = `
\x1b[hdr]NovaOS Developer Terminal — Available Commands\x1b[/]

\x1b[sec]Filesystem:\x1b[/]
  ls [-la] [path]           List directory contents
  cd [path]                 Change directory  (~ = home, / = root)
  pwd                       Print working directory
  mkdir [-p] <dir>          Create directory
  touch <file>              Create file or update timestamp
  rm [-r] <path>            Remove file or directory
  mv <src> <dest>           Move or rename
  cp [-r] <src> <dest>      Copy file or directory
  cat <file>                Display file contents
  tree [-L n] [path]        Directory tree view
  find [path] [-name] [-type]  Find files

\x1b[sec]Basic:\x1b[/]
  echo <text>               Print text (supports $VAR substitution)
  clear                     Clear terminal output
  history                   Show command history
  date                      Current date/time
  whoami                    Current user info
  uname [-a]                System information

\x1b[sec]Development:\x1b[/]
  npm <init|install|run|list|...>   npm simulation
  git <init|status|add|commit|log|branch|checkout|diff|...>  git simulation
  node [-e] [script]        Run JavaScript in node simulation
  node repl                 Start interactive REPL

\x1b[sec]Environment:\x1b[/]
  env                       List all environment variables
  export KEY=VALUE          Set environment variable
  unset KEY                 Remove environment variable
  printenv [KEY]            Print specific or all variables

\x1b[sec]Keyboard shortcuts:\x1b[/]
  ↑ / ↓                     Navigate command history
  Tab                       Auto-complete paths and commands
  Ctrl+C                    Cancel current input / interrupt
  Ctrl+L                    Clear terminal
  Ctrl+R                    Search history
  Ctrl+A / Ctrl+E           Jump to start / end of line
  Ctrl+U                    Clear line
  Ctrl+K                    Kill to end of line

\x1b[sec]Terminal:\x1b[/]
  Use the toolbar to open new tabs, split panes, and change themes.
`;
    return {
      output: helpText
        .split('\n')
        .map((line) => ({ type: 'info' as const, content: line })),
    };
  },

  date(_ctx: CommandContext): CommandResult {
    return {
      output: [{ type: 'stdout', content: new Date().toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }) }],
    };
  },

  whoami(_ctx: CommandContext): CommandResult {
    return { output: [{ type: 'stdout', content: 'nova-user' }] };
  },

  uname(ctx: CommandContext): CommandResult {
    const all = ctx.args.includes('-a');
    if (all) {
      return { output: [{ type: 'stdout', content: 'NovaOS 4.0.0 #1 SMP PREEMPT x86_64 GNU/Linux' }] };
    }
    return { output: [{ type: 'stdout', content: 'NovaOS' }] };
  },
};
