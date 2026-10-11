import type { Example } from '../../registry';

const fence = (lines: string[]) => ['```transcript', ...lines, '```'].join('\n');

/** A short session, a multi-step one, and one whose indentation must survive. */
export const transcriptExamples: Example[] = [
  {
    heading: 'One request and its response',
    source: fence(['$ curl -X POST /jobs/9f2c/pause', '< 200 OK']),
  },
  {
    heading: 'A session with several steps',
    note: 'A blank line separates steps. Nothing is reflowed, so the session reads in the order it happened.',
    source: fence([
      '$ curl -X POST /jobs -d \'{"kind":"reconcile"}\'',
      '< 201 Created',
      '{ "id": "9f2c", "state": "queued" }',
      '',
      '$ curl /jobs/9f2c',
      '< 200 OK',
      '{ "id": "9f2c", "state": "running" }',
    ]),
  },
  {
    heading: 'Indentation and markdown characters, preserved',
    note: 'The body is verbatim: the JSON keeps its four-space indent and `**exponential**` stays literal rather than turning bold.',
    source: fence([
      '$ cat policy.json',
      '{',
      '    "retries": 3,',
      '    "backoff": "**exponential**"',
      '}',
    ]),
  },
];
