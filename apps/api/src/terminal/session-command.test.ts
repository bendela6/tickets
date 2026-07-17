import { describe, expect, it } from 'vitest';
import { resolveSessionCommand } from './session-command';

describe('resolveSessionCommand', () => {
  it('execs a given command directly with no args', () => {
    expect(resolveSessionCommand('claude', 'linux', {})).toEqual({ command: 'claude', args: [] });
  });

  it('trims surrounding whitespace and ignores an all-whitespace command', () => {
    expect(resolveSessionCommand('  bash  ', 'linux', {})).toEqual({ command: 'bash', args: [] });
    expect(resolveSessionCommand('   ', 'linux', { SHELL: '/bin/zsh' })).toEqual({
      command: '/bin/zsh',
      args: [],
    });
  });

  it('falls back to the POSIX shell from $SHELL, then /bin/bash', () => {
    expect(resolveSessionCommand(undefined, 'linux', { SHELL: '/bin/zsh' })).toEqual({
      command: '/bin/zsh',
      args: [],
    });
    expect(resolveSessionCommand(undefined, 'linux', {})).toEqual({
      command: '/bin/bash',
      args: [],
    });
  });

  it('defaults to powershell.exe on Windows regardless of %ComSpec%', () => {
    expect(resolveSessionCommand(undefined, 'win32', { ComSpec: 'C:\\cmd.exe' })).toEqual({
      command: 'powershell.exe',
      args: [],
    });
    expect(resolveSessionCommand(undefined, 'win32', {})).toEqual({
      command: 'powershell.exe',
      args: [],
    });
  });
});
