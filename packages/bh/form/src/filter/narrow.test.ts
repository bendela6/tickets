import { describe, expect, it } from 'vitest';
import type { FormConfig } from '../types/form-config';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { narrowOf, narrowSpec } from './narrow';

type Config = FormConfig<InputRegistry, LayoutComponentRegistry>;

const search = { kind: 'field', name: 'search', type: 'search', config: {} } as const;
const status = { kind: 'field', name: 'status', type: 'chips', config: {}, filter: { op: 'in' } };
const type = { kind: 'field', name: 'type', type: 'select', config: {}, filter: { op: 'equals' } };
const rules = { kind: 'field', name: 'rules', type: 'rules', config: {}, filter: { rules: true } };
const count = { kind: 'slot', name: 'count' } as const;
const clear = { kind: 'action', action: 'reset', label: 'Clear', to: 'start' } as const;
const apply = { kind: 'action', action: 'submit', label: 'Apply' } as const;

function bar(children: unknown[]): Config {
  return {
    commit: 'change',
    nodes: [
      {
        kind: 'inline',
        props: { narrow: { below: 640, keep: ['search', 'status'] } },
        children,
      },
    ] as Config['nodes'],
  };
}

describe('narrowOf', () => {
  it('keeps the kept fields and the rest in the bar, the sheet’s slot where the first moved field was', () => {
    const { bar: kept } = narrowOf(bar([search, type, status, rules, count, clear]), [
      'search',
      'status',
    ]);
    expect(kept.commit).toBe('change');
    expect((kept.nodes[0] as { children: unknown[] }).children).toEqual([
      search,
      { kind: 'slot', name: 'sheet' },
      status,
      count,
      clear,
    ]);
  });

  it('moves the other fields to the sheet, out of their layouts, with the reset and a Show submit', () => {
    const { sheet } = narrowOf(bar([search, type, status, rules, count, clear]), [
      'search',
      'status',
    ]);
    expect(sheet.nodes).toEqual([
      type,
      rules,
      clear,
      { kind: 'action', action: 'submit', label: 'Show {count} items' },
    ]);
  });

  it('gives the sheet the config’s own submit, and takes it from the bar, which applies at once', () => {
    const { bar: kept, sheet } = narrowOf(bar([search, type, clear, apply]), ['search']);
    expect(sheet.nodes.at(-1)).toEqual(apply);
    expect((kept.nodes[0] as { children: unknown[] }).children).toEqual([
      search,
      { kind: 'slot', name: 'sheet' },
      clear,
    ]);
  });
});

describe('narrowSpec', () => {
  it('reads the first layout’s narrow', () => {
    expect(narrowSpec(bar([search]).nodes)).toEqual({ below: 640, keep: ['search', 'status'] });
    expect(narrowSpec([search])).toBeUndefined();
  });
});
