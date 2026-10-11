import type { Example } from '../../registry';

const fence = (lines: string[]) => ['```api', ...lines, '```'].join('\n');

/**
 * The states worth showing: one plain route, several plain routes, one that
 * opens, the two mixed, and a block using every field at once.
 */
export const apiExamples: Example[] = [
  {
    heading: 'One route, with nothing to open',
    note: 'A route needs only a method and a path. With no detail on it, the row stays a row.',
    source: fence(['routes:', '  - { method: GET, path: /health }']),
  },
  {
    heading: 'A flat list of routes',
    note: 'Nothing here carries detail, so nothing opens, which is what makes an index of a resource readable at a glance.',
    source: fence([
      'resource: workers',
      'routes:',
      '  - { method: GET, path: /workers }',
      '  - { method: GET, path: /workers/:id }',
      '  - { method: DELETE, path: /workers/:id }',
    ]),
  },
  {
    heading: 'A row that opens',
    note: 'Adding `params` gives the row something to expand into, so the detail sits behind the route it belongs to.',
    source: fence([
      'routes:',
      '  - method: GET',
      '    path: /jobs/:id',
      '    summary: Fetch one job by id.',
      '    params:',
      '      - { name: id, in: path, type: uuid, required: true }',
    ]),
  },
  {
    heading: 'Plain and expandable rows together',
    note: 'The two mix freely in one list. Only the row with `responses` opens; the others stay flat beside it.',
    source: fence([
      'resource: jobs',
      'routes:',
      '  - { method: GET, path: /jobs, summary: List every job. }',
      '  - { method: GET, path: /jobs/:id }',
      '  - method: POST',
      '    path: /jobs/:id/pause',
      '    summary: Pauses a running job at its next checkpoint. Idempotent.',
      '    responses:',
      '      - { status: 409, description: The job is not running. }',
    ]),
  },
  {
    heading: 'Every field at once',
    note: 'A description, params, two responses (one with an example body) and a transcript, across two rows, so the widest case is visible in one place.',
    source: fence([
      'resource: jobs',
      'routes:',
      '  - method: POST',
      '    path: /jobs',
      '    summary: Enqueue a job.',
      '    description: Queued jobs run in the order they arrive, **one per worker**.',
      '    params:',
      '      - { name: kind, in: body, type: string, required: true, description: What to run }',
      '      - { name: dry, in: query, type: bool }',
      '    responses:',
      '      - status: 201',
      '        description: The created job.',
      '        example: |',
      '          { "id": "9f2c", "kind": "reindex", "state": "queued" }',
      '      - { status: 422, description: kind is not a known job type }',
      '  - method: DELETE',
      '    path: /jobs/:id',
      '    summary: Cancel a job and release its worker slot.',
      '    transcript: |',
      '      $ curl -X DELETE /jobs/9f2c',
      '      < 204 No Content',
    ]),
  },
];
