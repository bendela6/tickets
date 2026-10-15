import { describe, expect, it } from 'vitest';
import type { FormConfig } from '../types/form-config';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { countAsks } from './counts';

type Config = FormConfig<InputRegistry, LayoutComponentRegistry>;

const presets = [
  { value: 'mine', label: 'Mine', filter: { field: 'assignee', op: 'isMe' } },
  { value: 'recent', label: 'Recent', filter: { field: 'updatedAt', op: 'inLast', value: 7 } },
];

const form: Config = {
  nodes: [
    { kind: 'field', name: 'search', type: 'search', config: {} },
    {
      kind: 'field',
      name: 'status',
      type: 'chips',
      config: { counts: true },
      filter: { op: 'in' },
    },
    {
      kind: 'field',
      name: 'presets',
      type: 'chips',
      config: { counts: true },
      filter: { presets },
    },
    { kind: 'field', name: 'pinned', type: 'check', config: {}, filter: { op: 'equals' } },
  ],
};

describe('countAsks', () => {
  it('asks for each option’s count with the field’s own condition left out', () => {
    const asks = countAsks(form.nodes, {
      search: 'crash',
      filter: {
        all: [
          { field: 'status', op: 'in', value: ['open', 'review'] },
          { field: 'pinned', op: 'equals', value: true },
        ],
      },
    });
    expect(asks[0]).toEqual({
      name: 'status',
      path: 'status',
      query: { search: 'crash', filter: { all: [{ field: 'pinned', op: 'equals', value: true }] } },
    });
  });

  it('asks for each preset’s count with the field’s conditions swapped for the preset’s', () => {
    const asks = countAsks(form.nodes, {
      filter: {
        all: [
          { field: 'assignee', op: 'isMe' },
          { field: 'status', op: 'in', value: ['open'] },
        ],
      },
    });
    const status = { field: 'status', op: 'in', value: ['open'] };
    expect(asks[1]).toEqual({
      name: 'presets',
      presets: [
        { value: 'mine', query: { filter: { all: [status, { field: 'assignee', op: 'isMe' }] } } },
        {
          value: 'recent',
          query: { filter: { all: [status, { field: 'updatedAt', op: 'inLast', value: 7 }] } },
        },
      ],
    });
  });

  it('asks nothing for a field whose config doesn’t ask for counts', () => {
    const asks = countAsks(form.nodes, {});
    expect(asks.map((ask) => ask.name)).toEqual(['status', 'presets']);
    expect(countAsks([form.nodes[3] as Config['nodes'][number]], {})).toEqual([]);
  });
});
