import { describe, expect, it } from 'vitest';
import { integrationFor } from './shell-integration';

describe('integrationFor', () => {
  it('matches bash by basename (full path, .exe, case)', () => {
    expect(integrationFor('C:/Program Files/Git/bin/bash.exe')?.id).toBe('bash');
    expect(integrationFor('/usr/bin/bash')?.id).toBe('bash');
  });
  it('matches powershell/pwsh', () => {
    expect(integrationFor('powershell.exe')?.id).toBe('pwsh');
    expect(integrationFor('pwsh')?.id).toBe('pwsh');
  });
  it('returns null for cmd and unknown shells (fallback to output pulse)', () => {
    expect(integrationFor('C:/WINDOWS/system32/cmd.exe')).toBeNull();
    expect(integrationFor('zsh')).toBeNull();
  });
  it('bash.apply injects markers via --rcfile without touching the command', () => {
    const bash = integrationFor('/usr/bin/bash')!;
    const out = bash.apply({ id: 7, command: '/usr/bin/bash' });
    expect(out.command).toBe('/usr/bin/bash');
    expect(out.args).toContain('--rcfile');
    expect(out.args).toContain('-i');
    expect(bash.precise).toBe(true);
  });
  it('pwsh.apply appends -NoExit -Command with the marker setup', () => {
    const pwsh = integrationFor('powershell.exe')!;
    const out = pwsh.apply({ id: 8, command: 'powershell.exe', args: ['-NoLogo'] });
    expect(out.args).toEqual(expect.arrayContaining(['-NoLogo', '-NoExit', '-Command']));
    const cmdArg = out.args[out.args.indexOf('-Command') + 1]!;
    expect(cmdArg).toMatch(/133;C/);
    expect(cmdArg).toMatch(/PSReadLineKeyHandler/);
  });
});
