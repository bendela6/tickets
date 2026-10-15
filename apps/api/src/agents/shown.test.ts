import { describe, expect, it } from 'vitest';
import { shownOf, type Word } from './shown';

// A fixed clock: every word below was said `ago` before NOW.
const NOW = new Date('2026-10-15T12:00:00.000Z');
const SECOND = 1000;
const MINUTE = 60 * SECOND;

const shown = (word: Omit<Word, 'at' | 'itemDone'> & { itemDone?: boolean }, ago: number) =>
  shownOf({ itemDone: false, ...word, at: new Date(NOW.getTime() - ago) }, NOW);

describe('the planner and the builder', () => {
  it.each(['planner', 'builder'] as const)('%s: listening while its last word is under a minute old', (role) => {
    expect(shown({ role, state: 'listening' }, 0)).toEqual({ state: 'listening', dismissible: false });
    expect(shown({ role, state: 'listening' }, 20 * SECOND)).toEqual({ state: 'listening', dismissible: false });
    expect(shown({ role, state: 'listening' }, MINUTE - 1)).toEqual({ state: 'listening', dismissible: false });
    expect(shown({ role, state: 'listening' }, MINUTE)).toEqual({ state: 'not-running', dismissible: false });
  });

  it.each(['planner', 'builder'] as const)('%s: working while its last word is under 30 minutes old', (role) => {
    expect(shown({ role, state: 'working' }, 5 * MINUTE)).toEqual({ state: 'working', dismissible: false });
    expect(shown({ role, state: 'working' }, 30 * MINUTE - 1)).toEqual({ state: 'working', dismissible: false });
    expect(shown({ role, state: 'working' }, 30 * MINUTE)).toEqual({ state: 'not-running', dismissible: false });
  });

  it.each(['done', 'failed', 'abandoned', 'stopped'] as const)('says %s: not running, however recent', (state) => {
    expect(shown({ role: 'builder', state }, 0)).toEqual({ state: 'not-running', dismissible: false });
  });

  it('is shown a week on, as not running', () => {
    expect(shown({ role: 'planner', state: 'listening' }, 6 * 24 * 60 * MINUTE)).toEqual({ state: 'not-running', dismissible: false });
  });

  it("is never finished by its item's being done", () => {
    expect(shown({ role: 'builder', state: 'working', itemDone: true }, 0)).toEqual({ state: 'working', dismissible: false });
  });
});

describe('a worker', () => {
  it.each(['working', 'listening'] as const)('saying %s: working while its last word is under 30 minutes old, then quiet', (state) => {
    expect(shown({ role: 'worker', state }, 0)).toEqual({ state: 'working', dismissible: false });
    expect(shown({ role: 'worker', state }, 30 * MINUTE - 1)).toEqual({ state: 'working', dismissible: false });
    expect(shown({ role: 'worker', state }, 30 * MINUTE)).toEqual({ state: 'quiet', dismissible: true });
    expect(shown({ role: 'worker', state }, 3 * 24 * 60 * MINUTE)).toEqual({ state: 'quiet', dismissible: true });
  });

  it('working on an item that is done: finished for 15 minutes, then gone', () => {
    expect(shown({ role: 'worker', state: 'working', itemDone: true }, 0)).toEqual({ state: 'finished', dismissible: false });
    expect(shown({ role: 'worker', state: 'working', itemDone: true }, 15 * MINUTE - 1)).toEqual({ state: 'finished', dismissible: false });
    expect(shown({ role: 'worker', state: 'working', itemDone: true }, 15 * MINUTE)).toBeNull();
    // quiet for longer than half an hour, its item done: gone, not quiet
    expect(shown({ role: 'worker', state: 'working', itemDone: true }, 45 * MINUTE)).toBeNull();
  });

  it('saying done: finished for 15 minutes, then gone, its item done or not', () => {
    for (const itemDone of [false, true]) {
      expect(shown({ role: 'worker', state: 'done', itemDone }, 0)).toEqual({ state: 'finished', dismissible: true });
      expect(shown({ role: 'worker', state: 'done', itemDone }, 15 * MINUTE - 1)).toEqual({ state: 'finished', dismissible: true });
      expect(shown({ role: 'worker', state: 'done', itemDone }, 15 * MINUTE)).toBeNull();
    }
  });

  it('saying stopped: stopped for 15 minutes, then gone', () => {
    expect(shown({ role: 'worker', state: 'stopped' }, 14 * MINUTE)).toEqual({ state: 'stopped', dismissible: true });
    expect(shown({ role: 'worker', state: 'stopped' }, 15 * MINUTE)).toBeNull();
  });

  it.each(['failed', 'abandoned'] as const)('saying %s: stays until its item is done', (state) => {
    expect(shown({ role: 'worker', state }, 0)).toEqual({ state, dismissible: true });
    expect(shown({ role: 'worker', state }, 6 * 24 * 60 * MINUTE)).toEqual({ state, dismissible: true });
    expect(shown({ role: 'worker', state, itemDone: true }, 0)).toBeNull();
  });
});
