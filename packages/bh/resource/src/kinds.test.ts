import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { baseKinds } from './kinds';
import { baseOperators } from './operators';
import type { BaseKind, KindSettings, KindSpec, KindValue } from './types';
import type { Json } from './values';

function kind(name: BaseKind): KindSpec {
  const spec = baseKinds.find((each) => each.name === name);
  if (!spec) {
    throw new Error(`bh registers no kind "${name}"`);
  }
  return spec;
}

/** Whether the kind's value schema, given these settings, takes the value. */
function takes(name: BaseKind, value: unknown, settings?: Record<string, Json>): boolean {
  return v.safeParse(kind(name).value(settings), value).success;
}

/** Whether the kind's settings schema takes these settings. */
function settles(name: BaseKind, settings: unknown): boolean {
  const schema = kind(name).settings;
  if (!schema) {
    throw new Error(`the kind "${name}" takes no settings`);
  }
  return v.safeParse(schema, settings).success;
}

// The table above BaseKind: what each of bh's kinds allows.
const TABLE: Record<BaseKind, Pick<KindSpec, 'many' | 'sort' | 'group' | 'search' | 'format'>> = {
  text: { many: true, sort: true, group: false, search: true, format: 'plain' },
  url: { many: true, sort: true, group: false, search: true },
  number: { many: false, sort: true, group: false, search: false, format: 'number' },
  boolean: { many: false, sort: true, group: true, search: false },
  date: { many: false, sort: true, group: false, search: false, format: 'date' },
  datetime: { many: false, sort: true, group: false, search: false, format: 'datetime' },
  option: { many: true, sort: true, group: true, search: false },
  ref: { many: true, sort: true, group: true, search: false },
  json: { many: false, sort: false, group: false, search: false },
};

// The operators each of bh's kinds names in its entry, as the query's
// operators ticket lists them.
const EQUALS = ['equals', 'notEquals'];
const IN = ['in', 'notIn'];
const TEXT = ['contains', 'startsWith'];
const RANGE = ['lt', 'lte', 'gt', 'gte'];
const LAST = ['inLast', 'notInLast'];
const EMPTY = ['empty', 'notEmpty'];
const ALLOWS: Record<BaseKind, string[]> = {
  text: [...EQUALS, ...IN, ...TEXT, ...EMPTY],
  url: [...EQUALS, ...IN, ...TEXT, ...EMPTY],
  number: [...EQUALS, ...IN, ...RANGE, ...EMPTY],
  date: [...EQUALS, ...RANGE, ...LAST, ...EMPTY],
  datetime: [...RANGE, ...LAST, ...EMPTY],
  boolean: ['equals', ...EMPTY],
  option: [...EQUALS, ...IN, ...EMPTY],
  ref: [...EQUALS, ...IN, ...EMPTY, 'isMe'],
  json: [...EMPTY],
};

// A status field's settings, as tickets keeps them: options carrying their group.
const STATUS: KindSettings['option'] = {
  options: [
    { value: 'todo', label: 'To do', color: 'gray', order: 0, attributes: { kind: 'todo' } },
    {
      value: 'in-progress',
      label: 'In progress',
      color: 'blue',
      order: 1,
      attributes: { kind: 'active' },
    },
    { value: 'done', label: 'Done', order: 2, attributes: { kind: 'done' } },
    { value: 'wontfix', label: "Won't fix", order: 3, archived: true, attributes: { kind: null } },
  ],
  attributes: [
    {
      key: 'kind',
      label: 'Group',
      kind: 'option',
      options: [
        { value: 'todo', label: 'To do', order: 0 },
        { value: 'active', label: 'Active', order: 1 },
        { value: 'done', label: 'Done', order: 2 },
      ],
    },
  ],
};

describe('bh’s kinds', () => {
  it('are the nine of KindValue, each once', () => {
    const names: (keyof KindValue)[] = Object.keys(TABLE) as BaseKind[];
    expect(baseKinds.map((spec) => spec.name).sort()).toEqual([...names].sort());
  });

  it.each(Object.entries(TABLE))('registers %s with the table’s flags', (name, flags) => {
    const { many, sort, group, search, format } = kind(name as BaseKind);
    expect({ many, sort, group, search, format }).toEqual(flags);
  });

  it.each(Object.entries(ALLOWS))('names %s’s operators in its own entry', (name, operators) => {
    expect(kind(name as BaseKind).operators).toEqual(operators);
  });

  it('name only operators bh registers', () => {
    const registered = baseOperators.map((spec) => spec.name);
    for (const spec of baseKinds) {
      expect(registered, spec.name).toEqual(expect.arrayContaining(spec.operators));
    }
  });

  it('let every field be found empty or not, and json nothing more', () => {
    for (const spec of baseKinds) {
      expect(spec.operators).toEqual(expect.arrayContaining(['empty', 'notEmpty']));
    }
    expect(kind('json').operators).toEqual(['empty', 'notEmpty']);
  });

  it('look into text only where a kind is text, and compare by range only where it orders by value', () => {
    const allowing = (operator: string) => {
      return baseKinds.filter((spec) => spec.operators.includes(operator)).map((spec) => spec.name);
    };
    expect(allowing('contains')).toEqual(['text', 'url']);
    expect(allowing('startsWith')).toEqual(['text', 'url']);
    expect(allowing('lt')).toEqual(['number', 'date', 'datetime']);
  });

  it('give settings to option and ref alone', () => {
    expect(baseKinds.filter((spec) => spec.settings).map((spec) => spec.name)).toEqual([
      'option',
      'ref',
    ]);
  });

  it('are frozen: an app adds its own beside them, never changes them', () => {
    expect(() => (baseKinds as KindSpec[]).push(kind('text'))).toThrow(TypeError);
    expect(() => {
      kind('text').many = false;
    }).toThrow(TypeError);
    expect(() => kind('text').operators.push('like')).toThrow(TypeError);
  });
});

describe('each kind’s value', () => {
  const cases: Record<BaseKind, { takes: unknown[]; refuses: unknown[] }> = {
    text: { takes: ['Fix the login', ''], refuses: [7, true, null, ['a'], undefined] },
    url: {
      takes: ['https://example.com/a?b=1', 'mailto:me@example.com', '/api/users/7/avatar'],
      refuses: ['//example.com/x', 'x/y', 'example.com', '', 7, null],
    },
    number: { takes: [0, -1.5, 1536], refuses: ['7', Number.NaN, Infinity, null, true] },
    boolean: { takes: [true, false], refuses: ['true', 0, 1, null] },
    date: {
      takes: ['2026-10-12', '2024-02-29', '0099-01-01'],
      refuses: [
        '2026-02-29',
        '2026-04-31',
        '2026-13-01',
        '2026-10-12T09:30:00.000Z',
        '12/10/2026',
        '2026-1-2',
        20261012,
        null,
      ],
    },
    datetime: {
      takes: ['2026-10-12T09:30:00.000Z', '2026-10-12T09:30:00Z', '2026-10-12T23:59:59.123456Z'],
      refuses: [
        '2026-10-12T09:30:00+02:00',
        '2026-10-12T09:30:00.000',
        '2026-10-12T09:30Z',
        '2026-10-12T24:00:00Z',
        '2026-02-30T00:00:00Z',
        '2026-10-12',
        1_760_261_400_000,
        null,
      ],
    },
    option: { takes: ['todo', 'in-progress'], refuses: ['doing', 'active', '', 1, null] },
    ref: { takes: [7, 'a1b2c3', '7'], refuses: [1.5, '', true, null, [7]] },
    json: {
      takes: [null, 'x', 1, false, [], {}, { a: [1, 'b', { c: true }] }],
      refuses: [undefined, Number.NaN, Infinity, { a: undefined }, () => 1],
    },
  };

  it.each(Object.entries(cases))(
    '%s takes its KindValue and refuses the wrong kind',
    (name, { takes: good, refuses }) => {
      const settings = name === 'option' ? (STATUS as unknown as Record<string, Json>) : undefined;
      for (const value of good) {
        expect(takes(name as BaseKind, value, settings), JSON.stringify(value)).toBe(true);
      }
      for (const value of refuses) {
        expect(takes(name as BaseKind, value, settings), String(value)).toBe(false);
      }
    },
  );

  describe('of a url field', () => {
    it('is an absolute address, with its scheme', () => {
      expect(takes('url', 'https://example.com/avatars/7.png')).toBe(true);
      expect(takes('url', 'http://localhost:4600/api/users/7/avatar')).toBe(true);
    });

    it('or a path from the root, as a picture the API serves itself is', () => {
      expect(takes('url', '/api/users/7/avatar')).toBe(true);
      expect(takes('url', '/api/users/7/avatar?size=64#top')).toBe(true);
      expect(takes('url', '/')).toBe(true);
    });

    it('but never a path naming another host, however a browser would read it', () => {
      expect(takes('url', '//example.com/x')).toBe(false);
      expect(takes('url', '/\\example.com/x')).toBe(false);
      expect(takes('url', '/\t/example.com/x')).toBe(false);
      expect(takes('url', '/\n/example.com/x')).toBe(false);
    });

    it('nor a relative path', () => {
      expect(takes('url', 'x/y')).toBe(false);
      expect(takes('url', './x')).toBe(false);
      expect(takes('url', '../x')).toBe(false);
      const result = v.safeParse(kind('url').value(), 'x/y');
      expect(result.issues?.[0]?.message).toBe(
        'a url is absolute, with its scheme, or a path from the root',
      );
    });
  });

  it('of an option field is one of that field’s options, archived ones too', () => {
    const settings = STATUS as unknown as Record<string, Json>;
    expect(takes('option', 'wontfix', settings)).toBe(true);
    expect(takes('option', 'todo', { options: [{ value: 'open', label: 'Open', order: 0 }] })).toBe(
      false,
    );
    const result = v.safeParse(kind('option').value(settings), 'doing');
    expect(result.issues?.[0]?.message).toBe('no option "doing"');
  });

  it('of an option field without valid settings is none', () => {
    expect(takes('option', 'todo')).toBe(false);
    expect(takes('option', 'todo', { options: 'todo' })).toBe(false);
  });
});

describe('an option field’s settings', () => {
  it('take tickets’ statuses with their group', () => {
    expect(settles('option', STATUS)).toBe(true);
    expect(settles('option', { options: [] })).toBe(true);
  });

  it('need their options', () => {
    expect(settles('option', {})).toBe(false);
    expect(settles('option', { attributes: [] })).toBe(false);
  });

  it('spell an option’s color color, and take no key besides', () => {
    expect(
      settles('option', { options: [{ value: 'a', label: 'A', order: 0, colour: 'red' }] }),
    ).toBe(false);
    expect(settles('option', { options: [], of: 'users' })).toBe(false);
  });

  it('hold each value once, at the second one’s path', () => {
    const twice = {
      ...STATUS,
      options: [STATUS.options[0], { ...STATUS.options[1], value: 'todo' }],
    };
    const result = v.safeParse(kind('option').settings ?? v.never(), twice);
    expect(result.success).toBe(false);
    expect(result.issues?.map((issue) => [v.getDotPath(issue), issue.message])).toEqual([
      ['options.1.value', 'two options are "todo"'],
    ]);
  });

  it('give an option only the attributes declared, each null or of its attribute’s kind', () => {
    const withAttributes = (attributes: Record<string, string | number | boolean | null>) => {
      return {
        ...STATUS,
        options: [{ value: 'a', label: 'A', order: 0, attributes }],
      };
    };
    expect(settles('option', withAttributes({ kind: 'done' }))).toBe(true);
    expect(settles('option', withAttributes({ kind: null }))).toBe(true);
    expect(settles('option', withAttributes({ kind: 'finished' }))).toBe(false);
    expect(settles('option', withAttributes({ weight: 3 }))).toBe(false);

    const weighted = {
      options: [{ value: 'a', label: 'A', order: 0, attributes: { weight: 'heavy' } }],
      attributes: [{ key: 'weight', label: 'Weight', kind: 'number' }],
    };
    expect(settles('option', weighted)).toBe(false);
    expect(
      settles('option', {
        ...weighted,
        options: [{ ...weighted.options[0], attributes: { weight: 3 } }],
      }),
    ).toBe(true);
  });

  it('name an attribute without a dot, once', () => {
    const attribute = { key: 'kind', label: 'Group', kind: 'text' };
    expect(settles('option', { options: [], attributes: [{ ...attribute, key: 'a.b' }] })).toBe(
      false,
    );
    expect(settles('option', { options: [], attributes: [attribute, attribute] })).toBe(false);
  });

  it('give options of their own to an option attribute alone', () => {
    const attribute = { key: 'kind', label: 'Group', kind: 'text', options: [] };
    expect(settles('option', { options: [], attributes: [attribute] })).toBe(false);
    expect(
      settles('option', {
        options: [],
        attributes: [{ key: 'kind', label: 'Group', kind: 'option' }],
      }),
    ).toBe(false);
  });
});

describe('a ref field’s settings', () => {
  it('take `of`, the resource its ids are rows of', () => {
    expect(settles('ref', { of: 'users' })).toBe(true);
    expect(settles('ref', {})).toBe(false);
    expect(settles('ref', { of: '' })).toBe(false);
    expect(settles('ref', { of: 'users', many: true })).toBe(false);
  });
});
