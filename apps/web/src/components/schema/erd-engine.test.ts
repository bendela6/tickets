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
      group: 'records',
      primaryKey: ['id'],
      uniques: [],
      columns: [
        { name: 'id', type: 'serial', notNull: true, pk: true, fk: null },
        { name: 'parent_id', type: 'integer', notNull: false, pk: false, fk: { table: 'comments', column: 'id' } },
      ],
    },
    {
      name: 'comment_reactions',
      group: 'records',
      primaryKey: ['id'],
      uniques: [{ name: 'comment_reactions_comment_user_emoji', columns: ['comment_id', 'user_id', 'emoji'] }],
      columns: [
        { name: 'id', type: 'serial', notNull: true, pk: true, fk: null },
        { name: 'comment_id', type: 'integer', notNull: true, pk: false, fk: { table: 'comments', column: 'id' } },
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
