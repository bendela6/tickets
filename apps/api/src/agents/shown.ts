import type { AgentRole, AgentState } from './reports';

// What the screens show for an agent's last word now (TK-84.2): the task
// viewer's rules (tasks/viewer.html, agentView), worked out once, here.

const MINUTE = 60_000;
// The planner and the builder beat while they listen: listening while their
// last word is under a minute old.
export const BEAT_MS = MINUTE;
// Working while the last word is under half an hour old; a worker quiet for
// longer may have been abandoned.
export const QUIET_MS = 30 * MINUTE;
// A finished or stopped worker stays this long after its last word.
export const SHOWN_MS = 15 * MINUTE;

export type ShownState =
  // the planner and the builder
  | 'listening'
  | 'working'
  | 'not-running'
  // a worker (working too)
  | 'quiet' // working, with no word for half an hour: the viewer's "abandoned?"
  | 'finished'
  | 'failed'
  | 'abandoned'
  | 'stopped';

export type Shown = {
  state: ShownState;
  // Whether a screen offers to dismiss it (DELETE /api/agents/:name), as the
  // viewer offers its ×.
  dismissible: boolean;
};

// An agent's last word as the rules read it. `itemDone` says its item is a
// tickets item in a done status; an item no tickets item has (a plans id) is
// never done.
export type Word = { role: AgentRole; state: AgentState; at: Date; itemDone: boolean };

// What a screen shows for the word now, or null when it shows it no more.
export function shownOf(word: Word, now: Date): Shown | null {
  const age = now.getTime() - word.at.getTime();
  if (word.role === 'planner' || word.role === 'builder') {
    if (word.state === 'working' && age < QUIET_MS) return { state: 'working', dismissible: false };
    if (word.state === 'listening' && age < BEAT_MS) return { state: 'listening', dismissible: false };
    return { state: 'not-running', dismissible: false };
  }
  switch (word.state) {
    case 'working':
    case 'listening':
      // its item done, it finished, whatever it last said
      if (word.itemDone) return age < SHOWN_MS ? { state: 'finished', dismissible: false } : null;
      if (age < QUIET_MS) return { state: 'working', dismissible: false };
      return { state: 'quiet', dismissible: true };
    case 'failed':
    case 'abandoned':
      // it stays until its item is done or it is dismissed
      return word.itemDone ? null : { state: word.state, dismissible: true };
    case 'done':
    case 'stopped':
      if (age >= SHOWN_MS) return null;
      return { state: word.state === 'done' ? 'finished' : 'stopped', dismissible: true };
  }
}
