import { describe, expect, it, beforeEach } from 'vitest';
import { renderErd } from './erd-engine';
import type { SchemaGraph } from './erd-types';

const graph: SchemaGraph = {
  groups: [
    { key: 'records', label: 'Ticket data', color: 'orange', tables: ['comments', 'comment_reactions'] },
  ],
  tables: [
    {
      name: 'comments',
      schema: null,
      group: 'records',
      primaryKey: ['id'],
      uniques: [],
      columns: [
        { name: 'id', type: 'serial', notNull: true, pk: true, fk: null },
        { name: 'parent_id', type: 'integer', notNull: false, pk: false, fk: { schema: null, table: 'comments', column: 'id' } },
      ],
    },
    {
      name: 'comment_reactions',
      schema: null,
      group: 'records',
      primaryKey: ['id'],
      uniques: [{ name: 'comment_reactions_comment_user_emoji', columns: ['comment_id', 'user_id', 'emoji'] }],
      columns: [
        { name: 'id', type: 'serial', notNull: true, pk: true, fk: null },
        { name: 'comment_id', type: 'integer', notNull: true, pk: false, fk: { schema: null, table: 'comments', column: 'id' } },
      ],
    },
  ],
};

// The real schema's shape, minimised: ONE bare table name (`sessions`) owned by
// two different schemas, in two different groups, each with its own fk to a
// shared core table. This is `terminal.sessions` vs `agent.sessions` — two
// independent subsystems that happen to share a word. Keyed by bare name, the
// renderer resolved both to whichever one its map kept: it drew agent.sessions
// twice, never drew terminal.sessions, and doubled the fk edges.
const splitGraph: SchemaGraph = {
  groups: [
    { key: 'core', label: 'Workdirs', color: 'green', tables: ['core.workdirs'] },
    { key: 'terminal', label: 'Terminal sessions', color: 'cyan', tables: ['terminal.sessions'] },
    { key: 'agent', label: 'Agent sessions', color: 'purple', tables: ['agent.sessions'] },
  ],
  tables: [
    {
      name: 'workdirs',
      schema: 'core',
      group: 'core',
      primaryKey: ['id'],
      uniques: [],
      columns: [{ name: 'id', type: 'serial', notNull: true, pk: true, fk: null }],
    },
    {
      name: 'sessions',
      schema: 'terminal',
      group: 'terminal',
      primaryKey: ['id'],
      uniques: [],
      columns: [
        { name: 'id', type: 'serial', notNull: true, pk: true, fk: null },
        { name: 'workdir_id', type: 'integer', notNull: true, pk: false, fk: { schema: 'core', table: 'workdirs', column: 'id' } },
        { name: 'exit_code', type: 'integer', notNull: false, pk: false, fk: null },
      ],
    },
    {
      name: 'sessions',
      schema: 'agent',
      group: 'agent',
      primaryKey: ['id'],
      uniques: [],
      columns: [
        { name: 'id', type: 'serial', notNull: true, pk: true, fk: null },
        { name: 'workdir_id', type: 'integer', notNull: true, pk: false, fk: { schema: 'core', table: 'workdirs', column: 'id' } },
        { name: 'cost_usd', type: 'numeric', notNull: false, pk: false, fk: null },
      ],
    },
  ],
};

describe('renderErd', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders one card per table', () => {
    renderErd(container, graph);
    expect(container.querySelectorAll('.erd-card')).toHaveLength(2);
  });

  it('renders a group box with its label', () => {
    renderErd(container, graph);
    const label = container.querySelector('.erd-g-label');
    expect(label?.textContent).toBe('Ticket data');
  });

  it('marks FK rows and nullability', () => {
    renderErd(container, graph);
    const row = container.querySelector('[data-row="comments.parent_id"]');
    expect(row?.classList.contains('erd-fk')).toBe(true);
    expect(row?.classList.contains('erd-nul')).toBe(true);
  });

  it('cleanup empties the container', () => {
    const cleanup = renderErd(container, graph);
    cleanup();
    expect(container.querySelectorAll('.erd-card')).toHaveLength(0);
  });
});

describe('renderErd — same table name in two schemas', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    renderErd(container, splitGraph);
  });

  it('renders both same-named tables, one per schema', () => {
    const titles = [...container.querySelectorAll('.erd-card-title')].map((n) => n.textContent);
    expect(titles).toEqual(['core.workdirs', 'terminal.sessions', 'agent.sessions']);
  });

  it('gives each same-named table its own card, in its own group column', () => {
    const cols = [...container.querySelectorAll('.erd-col')];
    const tablesIn = (i: number) =>
      [...cols[i]!.querySelectorAll<HTMLElement>('[data-table]')].map((n) => n.dataset.table);
    expect(tablesIn(1)).toEqual(['terminal.sessions']);
    expect(tablesIn(2)).toEqual(['agent.sessions']);
  });

  it('keeps each table\'s columns on its own card', () => {
    // Proof the two cards are really the two DIFFERENT tables and not one
    // table drawn twice: only the terminal one has exit_code, only the agent
    // one has cost_usd.
    const rowsOf = (table: string) =>
      [...container.querySelectorAll<HTMLElement>(`[data-table="${table}"] .erd-name`)].map((n) => n.textContent);
    expect(rowsOf('terminal.sessions')).toEqual(['id', 'workdir_id', 'exit_code']);
    expect(rowsOf('agent.sessions')).toEqual(['id', 'workdir_id', 'cost_usd']);
  });

  it('keys rows by the qualified table name, so neither overwrites the other', () => {
    expect(container.querySelector('[data-row="terminal.sessions.exit_code"]')).not.toBeNull();
    expect(container.querySelector('[data-row="agent.sessions.cost_usd"]')).not.toBeNull();
  });

  it('draws one fk edge per table, not two from the same one', () => {
    // Both fks point at core.workdirs. Bare-keyed, both resolved to the same
    // source card and the edges duplicated.
    expect(container.querySelectorAll('.erd-edge')).toHaveLength(2);
    const titles = [...container.querySelectorAll<HTMLElement>('[data-row$=".workdir_id"]')].map((n) => n.title);
    expect(titles).toEqual([
      'terminal.sessions.workdir_id → core.workdirs.id',
      'agent.sessions.workdir_id → core.workdirs.id',
    ]);
  });
});
