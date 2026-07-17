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

// Windows path -> WSL mount path: C:\a\b -> /mnt/c/a/b
export function toMntPath(winPath: string): string {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(winPath);
  if (!m) return winPath.replace(/\\/g, '/');
  return `/mnt/${m[1]!.toLowerCase()}/${m[2]!.replace(/\\/g, '/')}`;
}

// Shared bash rcfile: source ~/.bashrc, then PS0 emits C, PROMPT_COMMAND emits
// D with the exit code ($? captured first). Verified: no echo, real exit codes.
function writeBashRc(): string {
  const rc = join(tmpdir(), 'ti-shellint.sh');
  writeFileSync(
    rc,
    `[ -f ~/.bashrc ] && . ~/.bashrc\n` +
      `PS0=$'${ESC}]133;C${ESC}\\\\'\n` +
      `PROMPT_COMMAND='__ec=$?; printf "${ESC}]133;D;%s${ESC}\\\\" "$__ec";'"\${PROMPT_COMMAND:-}"\n`,
  );
  return rc;
}

const bash: ShellIntegration = {
  id: 'bash',
  precise: true,
  matches: (c) => ['bash', 'sh'].includes(basename(c)),
  apply: (spec) => ({ command: spec.command, args: ['--rcfile', writeBashRc(), '-i'], env: spec.env ?? {} }),
};

// WSL: same bash rcfile, referenced by its /mnt path; keep any distro args
// (e.g. -d Ubuntu) the caller passed, then `-- bash --rcfile <mnt> -i`.
const wsl: ShellIntegration = {
  id: 'wsl',
  precise: true,
  matches: (c) => basename(c) === 'wsl',
  apply: (spec) => ({
    command: spec.command,
    args: [...(spec.args ?? []), '--', 'bash', '--rcfile', toMntPath(writeBashRc()), '-i'],
    env: spec.env ?? {},
  }),
};

// pwsh: prompt emits D;<$LASTEXITCODE> + A; the Enter handler emits C with the
// typed command (from the PSReadLine buffer). Injected via -NoExit -Command.
const PWSH_INIT =
  `function prompt { $e=[char]27; $ec=if($LASTEXITCODE -ne $null){$LASTEXITCODE}elseif($?){0}else{1}; ` +
  `"$e]133;D;$ec$e\\$e]133;A$e\\PS $($executionContext.SessionState.Path.CurrentLocation)> " }; ` +
  `Set-PSReadLineKeyHandler -Chord Enter -ScriptBlock { ` +
  `$c=$null;[Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$c,[ref]$null); ` +
  `[Console]::Write([char]27+']133;C;'+$c+[char]27+'\\'); ` +
  `[Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine() }`;

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

// Extensible: add zsh (ZDOTDIR), cmd (coarse /K prompt), more distros, … here.
const REGISTRY: ShellIntegration[] = [pwsh, bash, wsl];

export function integrationFor(command: string): ShellIntegration | null {
  return REGISTRY.find((i) => i.matches(command)) ?? null;
}
