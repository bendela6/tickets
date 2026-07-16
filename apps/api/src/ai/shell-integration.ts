import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ESC = '\x1b';

export interface IntegrationSpec {
  id: number;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface ShellIntegration {
  id: string;
  precise: boolean;
  matches(command: string): boolean;
  apply(spec: IntegrationSpec): { command: string; args: string[]; env: Record<string, string> };
}

function basename(command: string): string {
  const last = command.replace(/\\/g, '/').split('/').pop() ?? command;
  return last.toLowerCase().replace(/\.exe$/, '');
}

// bash/sh: a temp rcfile sources the user's ~/.bashrc, then sets PS0 (emit C
// before each command) and PROMPT_COMMAND (emit D at each prompt). Verified: no
// setup text echoes; silent commands are bracketed C→D.
const bash: ShellIntegration = {
  id: 'bash',
  precise: true,
  matches: (c) => ['bash', 'sh'].includes(basename(c)),
  apply: (spec) => {
    const rc = join(tmpdir(), `ti-shellint-${spec.id}.sh`);
    writeFileSync(
      rc,
      `[ -f ~/.bashrc ] && . ~/.bashrc\n` +
        `PS0=$'${ESC}]133;C${ESC}\\\\'\n` +
        `PROMPT_COMMAND='printf "${ESC}]133;D${ESC}\\\\";'"\${PROMPT_COMMAND:-}"\n`,
    );
    return { command: spec.command, args: ['--rcfile', rc, '-i'], env: spec.env ?? {} };
  },
};

// pwsh: prompt fn emits D+A; a PSReadLine Enter handler emits C before accepting
// the line. Injected via -NoExit -Command so nothing echoes.
const PWSH_INIT =
  `function prompt { $e=[char]27; "$e]133;D$e\\$e]133;A$e\\PS $($executionContext.SessionState.Path.CurrentLocation)> " }; ` +
  `Set-PSReadLineKeyHandler -Chord Enter -ScriptBlock { [Console]::Write([char]27+']133;C'+[char]27+'\\'); [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine() }`;

const pwsh: ShellIntegration = {
  id: 'pwsh',
  precise: true,
  matches: (c) => ['powershell', 'pwsh'].includes(basename(c)),
  apply: (spec) => ({
    command: spec.command,
    args: [...(spec.args ?? []), '-NoExit', '-Command', PWSH_INIT],
    env: spec.env ?? {},
  }),
};

// Extensible: add zsh (precise, ZDOTDIR), cmd (coarse, /K prompt), WSL, … here.
const REGISTRY: ShellIntegration[] = [bash, pwsh];

export function integrationFor(command: string): ShellIntegration | null {
  return REGISTRY.find((i) => i.matches(command)) ?? null;
}
