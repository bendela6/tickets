// Turns an optional user-supplied command into the (command, args) pair the
// supervisor spawns. With no command the session is an interactive shell in the
// workspace directory; with one it execs that program directly (E1 runs a single
// program — piping a whole command line through a shell is an E2 concern).
//
// Pure and platform-branching, so it is unit-tested without spawning anything.
export interface SessionCommand {
  command: string;
  args: string[];
}

export function resolveSessionCommand(
  command: string | undefined,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): SessionCommand {
  const trimmed = command?.trim();
  if (trimmed) {
    return { command: trimmed, args: [] };
  }
  return defaultShell(platform, env);
}

function defaultShell(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): SessionCommand {
  if (platform === 'win32') {
    return { command: env.ComSpec ?? 'powershell.exe', args: [] };
  }
  return { command: env.SHELL ?? '/bin/bash', args: [] };
}
