import type { Example } from '../../registry';

const fence = (lines: string[]) => ['```erd', ...lines, '```'].join('\n');

/**
 * One table, a relation, enough tables to need arranging, a table that
 * references itself, and the least a diagram takes: every column flag and
 * both shapes of wire along the way.
 */
export const erdExamples: Example[] = [
  {
    heading: 'A single table, placed automatically',
    note: 'Every table is laid out for you, which is the right starting point until a diagram has enough tables to need arranging by hand.',
    source: fence([
      'title: Users',
      'tables:',
      '  users:',
      '    columns:',
      '      id:    { type: uuid, pk: true }',
      '      email: { type: text, unique: true }',
      '      name:  { type: text }',
    ]),
  },
  {
    heading: 'Two tables and the relation between them',
    note: 'A `ref` of `table.column` is what draws the wire; nothing else declares the relationship.',
    source: fence([
      'title: Core schema',
      'tables:',
      '  users:',
      '    columns:',
      '      id: { type: uuid, pk: true }',
      '  orders:',
      '    columns:',
      '      id:      { type: uuid, pk: true }',
      '      user_id: { type: uuid, ref: users.id }',
      '      total:   { type: numeric }',
    ]),
  },
  {
    heading: 'Enough tables to need arranging',
    note: 'Three tables and two relations. Each is placed right of what it references, and any of them can be dragged by its name or moved with the arrow keys.',
    source: fence([
      'title: Queue schema',
      'tables:',
      '  jobs:',
      '    columns:',
      '      id:         { type: uuid, pk: true }',
      '      state:      { type: text }',
      '      created_at: { type: timestamptz }',
      '  runs:',
      '    columns:',
      '      id:      { type: uuid, pk: true }',
      '      job_id:  { type: uuid, ref: jobs.id }',
      '      worker:  { type: text }',
      '      minutes: { type: int }',
      '  leases:',
      '    columns:',
      '      run_id:     { type: uuid, ref: runs.id }',
      '      holder:     { type: text, unique: true }',
      '      expires_at: { type: timestamptz }',
    ]),
  },
  {
    heading: 'A table that references itself',
    note: 'A `ref` to its own table draws a wire that bows out past the right edge and comes back.',
    source: fence([
      'title: Category tree',
      'tables:',
      '  categories:',
      '    columns:',
      '      id:        { type: uuid, pk: true }',
      '      parent_id: { type: uuid, ref: categories.id }',
      '      slug:      { type: text, unique: true }',
    ]),
  },
  {
    heading: 'Untitled, so nothing is kept',
    note: 'Without a `title` the diagram draws and drags the same, but a host has nothing to keep the arrangement under, so it is laid out afresh each time.',
    source: fence([
      'tables:',
      '  notes:',
      '    columns:',
      '      id:   { type: int, pk: true }',
      '      body: { type: text }',
    ]),
  },
];
