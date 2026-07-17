import { describe, expect, it } from 'vitest';
import { createActivityScanner } from './activity-scanner';

const C = (cmd = '') => `\x1b]133;C${cmd ? `;${cmd}` : ''}\x1b\\`;
const D = (code = '') => `\x1b]133;D${code !== '' ? `;${code}` : ''}\x1b\\`;

describe('activity-scanner', () => {
  it('passes plain output through untouched', () => {
    expect(createActivityScanner().push('hello')).toEqual({ clean: 'hello' });
  });
  it('C → busy true (+command), D → busy false (+exitCode), markers stripped', () => {
    const s = createActivityScanner();
    expect(s.push(`x${C('npm test')}y`)).toEqual({ clean: 'xy', event: { busy: true, command: 'npm test' } });
    expect(s.push(`a${D('1')}b`)).toEqual({ clean: 'ab', event: { busy: false, exitCode: 1 } });
  });
  it('bare C/D carry no command/exit', () => {
    const s = createActivityScanner();
    expect(s.push(C())).toEqual({ clean: '', event: { busy: true } });
    expect(s.push(D())).toEqual({ clean: '', event: { busy: false } });
  });
  it('A (prompt) → busy false', () => {
    expect(createActivityScanner().push('\x1b]133;A\x1b\\$ ')).toEqual({ clean: '$ ', event: { busy: false } });
  });
  it('detects a marker split across chunks', () => {
    const s = createActivityScanner();
    expect(s.push('out\x1b]133;C;np').clean).toBe('out'); // held back
    expect(s.push('m\x1b\\done')).toEqual({ clean: 'done', event: { busy: true, command: 'npm' } });
  });
  it('keeps the exit code when D and A arrive together (pwsh prompt)', () => {
    const s = createActivityScanner();
    expect(s.push('\x1b]133;D;3\x1b\\\x1b]133;A\x1b\\PS> ')).toEqual({ clean: 'PS> ', event: { busy: false, exitCode: 3 } });
  });
  it('holds back a long command split across chunks without leaking bytes (past the old 64 cap)', () => {
    const s = createActivityScanner();
    // 90 chars — the held-back tail (ESC]133;C; + 80) exceeds the old 64-char cap.
    const long = 'npm run some:very-long-script -- --with --many --args --and --more /paths/here/too extra';
    expect(long.length).toBeGreaterThan(80);
    expect(s.push('out\x1b]133;C;' + long.slice(0, 80)).clean).toBe('out'); // partial held, not leaked
    expect(s.push(long.slice(80) + '\x1b\\done')).toEqual({ clean: 'done', event: { busy: true, command: long } });
  });
});
