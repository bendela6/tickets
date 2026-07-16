import { describe, expect, it } from 'vitest';
import { terminalDisplay } from './terminal-display';

describe('terminalDisplay', () => {
  it('shows Ready at idle and Running when busy', () => {
    expect(terminalDisplay('live', 'live', false)).toMatchObject({ label: 'Ready', pulse: false });
    expect(terminalDisplay('live', 'live', true)).toMatchObject({
      label: 'Running',
      pulse: true,
      status: 'running',
    });
  });
  it('reflects the socket connection first for a live session', () => {
    expect(terminalDisplay('connecting', 'live', false)).toMatchObject({ label: 'Connecting' });
    expect(terminalDisplay('reconnecting', 'live', true)).toMatchObject({ label: 'Reconnecting' });
  });
  it('shows terminal end states regardless of connection', () => {
    expect(terminalDisplay('connecting', 'exited', false)).toMatchObject({
      label: 'Exited',
      status: 'exited',
    });
    expect(terminalDisplay('ended', 'disconnected', false)).toMatchObject({
      label: 'Disconnected',
      status: 'disconnected',
    });
    expect(terminalDisplay('live', 'failed', false)).toMatchObject({
      label: "Couldn't start",
      status: 'failed',
    });
  });
});
