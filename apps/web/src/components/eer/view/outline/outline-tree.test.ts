import { describe, expect, it } from 'vitest';

import { buildModel, pkField } from '../../test/models';
import { buildOutline } from './build-outline';
import {
  columnRowId,
  entityRowId,
  groupRowId,
  indexOutline,
  outlineToTreeNodes,
  parseRowId,
} from './outline-tree';

describe('parseRowId', () => {
  it('splits a group id on the first colon', () => {
    expect(parseRowId(groupRowId('z1'))).toEqual({ kind: 'g', rest: 'z1' });
  });

  // The real shape, not a toy one: entity ids are SCHEMA-qualified
  // (`terminal.sessions`), so a naive split on '.' — or any separator other
  // than ':' — would corrupt this. The dot must land inside `rest` untouched.
  it('keeps a schema-qualified entity id intact in `rest`', () => {
    expect(parseRowId(entityRowId('terminal.sessions'))).toEqual({
      kind: 'e',
      rest: 'terminal.sessions',
    });
  });

  // A column id carries a SECOND colon (`c:<entityId>:<column>`). Splitting on
  // the first colon only — not the last, not every colon — is what keeps the
  // entity id and column name together in `rest` for the caller (outline.tsx's
  // onSelect) to split again on the LAST colon.
  it('keeps the embedded entity-id colon intact in `rest`, for a column id', () => {
    expect(parseRowId(columnRowId('terminal.sessions', 'created_at'))).toEqual({
      kind: 'c',
      rest: 'terminal.sessions:created_at',
    });
  });
});

describe('outlineToTreeNodes', () => {
  it('populates `label` at every level — group, entity, and column', () => {
    // A schema-qualified id (dot) at the entity level, and a query that
    // surfaces a COLUMN row (not just an entity), so all three row kinds this
    // function produces are exercised at once.
    const raw = {
      groups: [{ id: 'g', label: 'Terminal', order: 0 }],
      entities: [
        {
          id: 'terminal.sessions',
          label: 'sessions',
          group: 'g',
          fields: [pkField, { name: 'created_at', type: 'timestamp' }],
        },
      ],
      relationships: [],
    };
    const nodes = buildOutline(buildModel(raw), 'created_at');
    const [tree] = outlineToTreeNodes(nodes);

    expect(tree!.label).toBe('Terminal');
    const [entity] = tree!.children!;
    expect(entity!.id).toBe('e:terminal.sessions');
    expect(entity!.label).toBe('sessions');
    const [column] = entity!.children!;
    expect(column!.id).toBe('c:terminal.sessions:created_at');
    expect(column!.label).toBe('created_at');
  });
});

describe('indexOutline', () => {
  it('resolves a column row through a schema-qualified entity id without truncating it', () => {
    const raw = {
      groups: [{ id: 'g', label: 'Terminal', order: 0 }],
      entities: [
        {
          id: 'terminal.sessions',
          label: 'sessions',
          group: 'g',
          fields: [pkField, { name: 'created_at', type: 'timestamp' }],
        },
      ],
      relationships: [],
    };
    const nodes = buildOutline(buildModel(raw), 'created_at');
    const index = indexOutline(nodes);

    const entityData = index.get('e:terminal.sessions');
    expect(entityData).toEqual({ kind: 'entity', entity: expect.objectContaining({ id: 'terminal.sessions' }) });

    const columnData = index.get('c:terminal.sessions:created_at');
    expect(columnData).toEqual({ kind: 'column', entityId: 'terminal.sessions', column: 'created_at' });
  });
});
