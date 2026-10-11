import type { Example } from '../../registry';

const fence = (lines: string[]) => ['```lifecycle', ...lines, '```'].join('\n');

/** The least a machine needs, one that branches and comes back, one that loops, and one with notes. */
export const lifecycleExamples: Example[] = [
  {
    heading: 'The smallest useful machine',
    note: 'Two states and one event. A terminal state is an empty map: it declares no events, so nothing leaves it.',
    source: fence([
      'initial: draft',
      'final: [published]',
      'states:',
      '  draft:     { publish: published }',
      '  published: {}',
    ]),
  },
  {
    heading: 'Branching, with a way back',
    note: '`paused` can resume to `running` or give up to `failed`, so the graph is not a line. Every target has to be a declared state.',
    source: fence([
      'title: Job states',
      'initial: queued',
      'final: [done, failed]',
      'states:',
      '  queued:  { dispatch: running }',
      '  running: { pause: paused, complete: done, error: failed }',
      '  paused:  { resume: running, cancel: failed }',
      '  done:    {}',
      '  failed:  {}',
    ]),
  },
  {
    heading: 'An event that stays put',
    note: 'An event may lead back to the state it left: `retry` is drawn as a loop under `importing`.',
    source: fence([
      'title: Import states',
      'initial: waiting',
      'final: [imported]',
      'states:',
      '  waiting:   { start: importing }',
      '  importing: { retry: importing, finish: imported }',
      '  imported:  {}',
    ]),
  },
  {
    heading: 'A note under the diagram',
    note: '`notes` is markdown, for the consequence a diagram cannot draw: here, what the `busy` state costs while it is held.',
    source: fence([
      'title: Worker capacity',
      'initial: idle',
      'final: [drained]',
      'states:',
      '  idle:    { claim: busy }',
      '  busy:    { release: idle, drain: drained }',
      '  drained: {}',
      'notes: A `busy` worker **holds its slot** until it is released, so one long job starves the queue.',
    ]),
  },
];
