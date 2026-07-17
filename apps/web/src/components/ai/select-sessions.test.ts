import { describe, expect, it } from 'vitest';
import type { AiSession } from '../../api/types';
import { agentsOf, terminalsOf } from './select-sessions';

const s = (id: number, kind: AiSession['kind']): AiSession =>
  ({ id, kind, title: `s${id}`, status: 'idle' } as AiSession);

describe('select-sessions', () => {
  const rows = [s(1, 'terminal'), s(2, 'agent'), s(3, 'terminal')];
  it('terminalsOf keeps only terminal sessions', () => {
    expect(terminalsOf(rows).map((r) => r.id)).toEqual([1, 3]);
  });
  it('agentsOf keeps only agent sessions', () => {
    expect(agentsOf(rows).map((r) => r.id)).toEqual([2]);
  });
});
