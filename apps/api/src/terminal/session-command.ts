import { existsSync } from 'node:fs';

// Turns an optional user-supplied command into the (command, args, title)
// triple the driver spawns. With no command the session is an interactive
// shell in the workdir; with one it execs that program directly (piping a
// whole command line through a shell is out of scope here).
//
// On Windows a few well-known shells are resolved to their real exe paths:
// node-pty's ConPTY cannot spawn bare PATH shims (`bash`, `pwsh`), and the
// full path doubles as the "is it installed?" check. `title` is the friendly
// name shown in the session list, so full paths never leak into the UI.
//
// Pure and platform-branching, so it is unit-tested without spawning
// anything (`fileExists` is injectable).
export interface SessionCommand {
  command: string;
  args: string[];
  title: string;
}

const PWSH7 = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
const GIT_BASH = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
];

function posixBasename(p: string): string {
  return p.split('/').pop() ?? p;
}

export function resolveSessionCommand(
  command: string | undefined,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  fileExists: (path: string) => boolean = existsSync,
): SessionCommand {
  const trimmed = command?.trim();
  if (trimmed) {
    if (platform === 'win32') {
      const alias = resolveWindowsAlias(trimmed, fileExists);
      if (alias) return alias;
    }
    return { command: trimmed, args: [], title: trimmed };
  }
  return defaultShell(platform, env, fileExists);
}

function resolveWindowsAlias(
  trimmed: string,
  fileExists: (path: string) => boolean,
): SessionCommand | null {
  const key = trimmed.toLowerCase().replace(/\.exe$/, '');
  if (key === 'pwsh' && fileExists(PWSH7)) {
    return { command: PWSH7, args: [], title: 'pwsh' };
  }
  if (key === 'bash' || key === 'gitbash' || key === 'git-bash') {
    const found = GIT_BASH.find(fileExists);
    if (found) return { command: found, args: [], title: 'bash' };
  }
  return null;
}

function defaultShell(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  fileExists: (path: string) => boolean,
): SessionCommand {
  if (platform === 'win32') {
    // Prefer PowerShell 7: it loads PSReadLine under ConPTY (5.1 cannot), so
    // shell integration hooks cleanly and sessions start without red spew.
    if (fileExists(PWSH7)) return { command: PWSH7, args: [], title: 'pwsh' };
    return { command: 'powershell.exe', args: [], title: 'powershell.exe' };
  }
  const shell = env.SHELL ?? '/bin/bash';
  return { command: shell, args: [], title: posixBasename(shell) };
}
