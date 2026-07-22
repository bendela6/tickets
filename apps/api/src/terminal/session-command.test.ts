import { describe, expect, it } from 'vitest';
import { resolveSessionCommand } from './session-command';

const PWSH7 = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe';

const none = () => false;
const has = (...paths: string[]) => (p: string) => paths.includes(p);

describe('resolveSessionCommand', () => {
  it('execs a given command directly with no args', () => {
    expect(resolveSessionCommand('claude', 'linux', {}, none)).toEqual({
      command: 'claude',
      args: [],
      title: 'claude',
    });
  });

  it('trims surrounding whitespace and ignores an all-whitespace command', () => {
    expect(resolveSessionCommand('  bash  ', 'linux', {}, none)).toEqual({
      command: 'bash',
      args: [],
      title: 'bash',
    });
    expect(resolveSessionCommand('   ', 'linux', { SHELL: '/bin/zsh' }, none)).toEqual({
      command: '/bin/zsh',
      args: [],
      title: 'zsh',
    });
  });

  it('falls back to the POSIX shell from $SHELL, then /bin/bash', () => {
    expect(resolveSessionCommand(undefined, 'linux', { SHELL: '/bin/zsh' }, none)).toEqual({
      command: '/bin/zsh',
      args: [],
      title: 'zsh',
    });
    expect(resolveSessionCommand(undefined, 'linux', {}, none)).toEqual({
      command: '/bin/bash',
      args: [],
      title: 'bash',
    });
  });

  it('defaults to PowerShell 7 on Windows when installed, else powershell.exe', () => {
    expect(resolveSessionCommand(undefined, 'win32', {}, has(PWSH7))).toEqual({
      command: PWSH7,
      args: [],
      title: 'pwsh',
    });
    expect(resolveSessionCommand(undefined, 'win32', { ComSpec: 'C:\\cmd.exe' }, none)).toEqual({
      command: 'powershell.exe',
      args: [],
      title: 'powershell.exe',
    });
  });

  it('resolves the pwsh alias to the installed PowerShell 7', () => {
    expect(resolveSessionCommand('pwsh', 'win32', {}, has(PWSH7))).toEqual({
      command: PWSH7,
      args: [],
      title: 'pwsh',
    });
    // not installed → pass through as typed
    expect(resolveSessionCommand('pwsh', 'win32', {}, none)).toEqual({
      command: 'pwsh',
      args: [],
      title: 'pwsh',
    });
  });

  it('resolves bash/gitbash aliases to the Git Bash exe (bare shims cannot spawn under ConPTY)', () => {
    for (const alias of ['bash', 'gitbash', 'git-bash']) {
      expect(resolveSessionCommand(alias, 'win32', {}, has(GIT_BASH))).toEqual({
        command: GIT_BASH,
        args: [],
        title: 'bash',
      });
    }
    // not installed → pass through as typed
    expect(resolveSessionCommand('bash', 'win32', {}, none)).toEqual({
      command: 'bash',
      args: [],
      title: 'bash',
    });
  });

  it('leaves non-alias Windows commands untouched', () => {
    expect(resolveSessionCommand('wsl.exe -d Ubuntu', 'win32', {}, has(PWSH7, GIT_BASH))).toEqual({
      command: 'wsl.exe -d Ubuntu',
      args: [],
      title: 'wsl.exe -d Ubuntu',
    });
  });
});
