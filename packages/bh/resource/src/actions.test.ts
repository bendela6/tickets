import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ActionInput, ActionMeta, ActionResult, Job, JobStatus } from './actions';
import type { ErrorBody, ErrorCode } from './errors';
import type { ResourceMeta } from './meta';
import type { Row } from './values';

// A stack's deploy: on one row, long, taking the image tag to deploy.
const deploy: ActionMeta = {
  name: 'deploy',
  label: 'Deploy',
  on: 'row',
  input: [
    {
      key: 'tag',
      label: 'Image tag',
      type: { kind: 'text' },
      query: { filter: [], sort: false, group: false, search: false },
      write: { create: true, update: false, required: false, default: 'latest' },
    },
  ],
  long: true,
};

// A torrent's pause: on one row, at once, taking nothing.
const pause: ActionMeta = { name: 'pause', label: 'Pause', on: 'row', input: [], long: false };

// A crawler's re-run: on the whole resource, long.
const recrawl: ActionMeta = {
  name: 'recrawl',
  label: 'Re-run the crawl',
  on: 'resource',
  input: [],
  long: true,
};

describe('an action’s metadata', () => {
  it('lists a resource’s actions beside its fields', () => {
    expectTypeOf<ResourceMeta['actions']>().toEqualTypeOf<ActionMeta[]>();
    expect([deploy, pause, recrawl].map((action) => action.name)).toEqual([
      'deploy',
      'pause',
      'recrawl',
    ]);
  });

  it('says what it acts on, what it takes and whether it runs long', () => {
    expectTypeOf<ActionMeta['on']>().toEqualTypeOf<'row' | 'resource'>();
    expectTypeOf<ActionMeta['long']>().toEqualTypeOf<boolean>();
    // @ts-expect-error an action acts on a row or on the whole resource
    const onMany: ActionMeta = { ...pause, on: 'rows' };
    // @ts-expect-error an action says whether it runs long
    const unsaid: ActionMeta = { name: 'pause', label: 'Pause', on: 'row', input: [] };
    expect([onMany, unsaid]).toHaveLength(2);
  });
});

describe('an action’s request and answer', () => {
  it('takes its input’s values by field key, as a create does', () => {
    const tagged: ActionInput = { values: { tag: 'v2.3.0' } };
    const bare: ActionInput = { values: {} };
    // @ts-expect-error the values sit under `values`
    const flat: ActionInput = { tag: 'v2.3.0' };
    expect([tagged, bare, flat]).toHaveLength(3);
  });

  it('answers the row at once, or a job to follow', () => {
    const paused: ActionResult = { id: 7, name: 'ubuntu.iso', state: 'paused' };
    const queued: ActionResult = { job: { id: 'j-41', status: 'queued' } };
    expectTypeOf<Row>().toExtend<ActionResult>();
    expectTypeOf<{ job: Job }>().toExtend<ActionResult>();
    expect([paused, queued]).toHaveLength(2);
  });
});

describe('a job', () => {
  it('is queued, running, done or failed', () => {
    expectTypeOf<JobStatus>().toEqualTypeOf<'queued' | 'running' | 'done' | 'failed'>();
  });

  it('carries the row when done, and the error when failed, nothing else', () => {
    const done: Job = {
      id: 'j-41',
      status: 'done',
      row: { id: 3, name: 'web', tag: 'v2.3.0' },
    };
    const failed: Job = {
      id: 'j-42',
      status: 'failed',
      error: { code: 'internal', message: 'the deploy stopped: the image was not found' },
    };
    expectTypeOf<Extract<Job, { status: 'failed' }>['error']>().toEqualTypeOf<ErrorBody['error']>();
    // @ts-expect-error a failed job says why
    const silent: Job = { id: 'j-43', status: 'failed' };
    // @ts-expect-error a running job has no row yet
    const early: Job = { id: 'j-44', status: 'running', row: {} };
    // @ts-expect-error a job that is done carries no error
    const both: Job = { ...done, error: failed.error };
    expect([silent, early, both]).toHaveLength(3);
  });

  it('tells what it carries by its status', () => {
    const outcome = (job: Job) => {
      switch (job.status) {
        case 'done':
          return job.row ?? 'done';
        case 'failed':
          return job.error.code;
        default:
          return job.status;
      }
    };
    expect(outcome({ id: 'j-1', status: 'running' })).toBe('running');
    expect(outcome({ id: 'j-2', status: 'done' })).toBe('done');
    expect(
      outcome({ id: 'j-3', status: 'failed', error: { code: 'conflict', message: 'x' } }),
    ).toBe('conflict');
  });

  it('fails with an app’s own codes once typed in', () => {
    const denied: Job<ErrorCode | 'unauthorized'> = {
      id: 'j-5',
      status: 'failed',
      error: { code: 'unauthorized', message: 'the registry refused the token' },
    };
    expect(denied.status).toBe('failed');
  });
});
