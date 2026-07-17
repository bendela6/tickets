import { describe, expect, it } from 'vitest';
import { integrationFor, toMntPath } from './shell-integration';

describe('toMntPath', () => {
  it('converts a Windows temp path to a WSL /mnt path', () => {
    expect(toMntPath('C:\\Users\\me\\AppData\\Local\\Temp\\x.sh')).toBe('/mnt/c/Users/me/AppData/Local/Temp/x.sh');
    expect(toMntPath('D:/tmp/y.sh')).toBe('/mnt/d/tmp/y.sh');
  });
});

describe('integrationFor', () => {
  it('matches by basename (path, .exe, case)', () => {
    expect(integrationFor('C:/Program Files/Git/bin/bash.exe')?.id).toBe('bash');
    expect(integrationFor('/usr/bin/bash')?.id).toBe('bash');
    expect(integrationFor('powershell.exe')?.id).toBe('pwsh');
    expect(integrationFor('C:/Program Files/PowerShell/7/pwsh.exe')?.id).toBe('pwsh');
    expect(integrationFor('C:/Windows/System32/wsl.exe')?.id).toBe('wsl');
  });
  it('returns null for cmd and unknown (output-pulse fallback)', () => {
    expect(integrationFor('cmd.exe')).toBeNull();
    expect(integrationFor('zsh')).toBeNull();
  });
  it('all three integrations are precise', () => {
    for (const c of ['bash', 'pwsh', 'wsl.exe']) expect(integrationFor(c)!.precise).toBe(true);
  });
  it('pwsh.apply emits C with the command buffer and D with $LASTEXITCODE', () => {
    const out = integrationFor('pwsh')!.apply({ id: 1, command: 'pwsh' });
    const cmdArg = out.args[out.args.indexOf('-Command') + 1]!;
    expect(out.args).toContain('-NoExit');
    expect(cmdArg).toMatch(/133;C/);
    expect(cmdArg).toMatch(/GetBufferState/);          // captures the command text
    expect(cmdArg).toMatch(/LASTEXITCODE/);            // exit code on D
  });
  it('bash.apply injects a --rcfile and emits D with $?', () => {
    const out = integrationFor('/usr/bin/bash')!.apply({ id: 2, command: '/usr/bin/bash' });
    expect(out.args).toEqual(['--rcfile', expect.stringContaining('ti-shellint.sh'), '-i']);
  });
  it('wsl.apply runs bash with the rcfile via its /mnt path, keeping any distro args', () => {
    const out = integrationFor('wsl.exe')!.apply({ id: 3, command: 'wsl.exe', args: ['-d', 'Ubuntu'] });
    expect(out.command).toBe('wsl.exe');
    expect(out.args.slice(0, 2)).toEqual(['-d', 'Ubuntu']);
    expect(out.args).toEqual(expect.arrayContaining(['--', 'bash', '--rcfile', '-i']));
    const rc = out.args[out.args.indexOf('--rcfile') + 1]!;
    expect(rc.startsWith('/mnt/')).toBe(true);
  });
});
