import { describe, expect, it } from 'vitest';
import { dispatchComment } from './dispatch-comment';

describe('dispatchComment', () => {
  it('summarizes a successful run with cost + session link', () => {
    expect(dispatchComment('Coder', 'exited', '0.4231', 12)).toBe(
      '🤖 Coder finished the dispatched run — exited · spend $0.42. (session #12)',
    );
  });

  it('calls out a failed run', () => {
    expect(dispatchComment('Coder', 'failed', '1.10', 12)).toBe(
      "🤖 Coder's dispatched run failed · spend $1.10. (session #12)",
    );
  });

  it('omits cost when none was recorded', () => {
    expect(dispatchComment('Coder', 'idle', null, 7)).toBe(
      '🤖 Coder finished the dispatched run — idle. (session #7)',
    );
  });
});
