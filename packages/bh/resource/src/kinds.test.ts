import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { baseKinds } from './kinds';
import { baseOperators } from './operators';
import type { BaseKind, KindSettings, KindSpec, KindValue } from './types';
import type { Json, Scalar } from './values';

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
  markdown: { many: true, sort: false, group: false, search: true },
  richtext: { many: true, sort: false, group: false, search: true },
  url: { many: true, sort: true, group: false, search: true },
  email: { many: true, sort: true, group: false, search: true },
  phone: { many: true, sort: true, group: false, search: true },
  number: { many: true, sort: true, group: false, search: false, format: 'number' },
  boolean: { many: true, sort: true, group: true, search: false },
  date: { many: true, sort: true, group: false, search: false, format: 'date' },
  time: { many: true, sort: true, group: false, search: false },
  datetime: { many: true, sort: true, group: false, search: false, format: 'datetime' },
  option: { many: true, sort: true, group: true, search: false },
  ref: { many: true, sort: true, group: true, search: false },
  file: { many: true, sort: false, group: false, search: false },
  json: { many: true, sort: false, group: false, search: false },
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
  markdown: ['contains', ...EMPTY],
  richtext: [...EMPTY],
  url: [...EQUALS, ...IN, ...TEXT, ...EMPTY],
  email: [...EQUALS, ...IN, ...TEXT, ...EMPTY],
  phone: [...EQUALS, ...IN, ...TEXT, ...EMPTY],
  date: [...EQUALS, ...IN, ...RANGE, ...LAST, ...EMPTY],
  time: [...EQUALS, ...IN, ...RANGE, ...EMPTY],
  datetime: [...RANGE, ...LAST, ...EMPTY],
  option: [...EQUALS, ...IN, ...EMPTY],
  number: [...EQUALS, ...IN, ...RANGE, ...EMPTY],
  boolean: ['equals', ...IN, ...EMPTY],
  ref: [...EQUALS, ...IN, ...EMPTY, 'isMe'],
  file: [...EMPTY],
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
  it('are the fifteen of KindValue, each once, in the table’s order', () => {
    const names: (keyof KindValue)[] = Object.keys(TABLE) as BaseKind[];
    expect(baseKinds.map((spec) => spec.name)).toEqual(names);
  });

  it('each may hold a list', () => {
    expect(baseKinds.filter((spec) => !spec.many)).toEqual([]);
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

  it('let every field be found empty or not, and rich text, a file and json nothing more', () => {
    for (const spec of baseKinds) {
      expect(spec.operators).toEqual(expect.arrayContaining(['empty', 'notEmpty']));
    }
    for (const name of ['richtext', 'file', 'json'] as const) {
      expect(kind(name).operators, name).toEqual(['empty', 'notEmpty']);
    }
  });

  it('look into text only where a kind is text, and compare by range only where it orders by value', () => {
    const allowing = (operator: string) => {
      return baseKinds.filter((spec) => spec.operators.includes(operator)).map((spec) => spec.name);
    };
    expect(allowing('contains')).toEqual(['text', 'markdown', 'url', 'email', 'phone']);
    expect(allowing('startsWith')).toEqual(['text', 'url', 'email', 'phone']);
    expect(allowing('lt')).toEqual(['number', 'date', 'time', 'datetime']);
    expect(allowing('inLast')).toEqual(['date', 'datetime']);
  });

  it('give settings to text, number, option and ref, text’s and number’s none needed', () => {
    expect(baseKinds.filter((spec) => spec.settings).map((spec) => spec.name)).toEqual([
      'text',
      'number',
      'option',
      'ref',
    ]);
    expect(settles('text', undefined)).toBe(true);
    expect(settles('number', undefined)).toBe(true);
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
    markdown: { takes: ['# Fix\n\nThe **login**', ''], refuses: [7, null, { type: 'doc' }] },
    richtext: {
      takes: ['{"type":"doc","content":[]}', '{"type":"doc"}'],
      refuses: ['', 'plain words', '{"type":"paragraph"}', '[]', '{', { type: 'doc' }, null],
    },
    email: {
      takes: ['ada@example.com', 'a.b+tag@mail.example.co'],
      refuses: ['ada', 'ada@', '@example.com', 'mailto:ada@example.com', '', null],
    },
    phone: {
      takes: ['+995555123456', '+14155550123'],
      refuses: ['555123456', '+0555', '+995 555 12 34 56', '+1234567890123456', '', 995, null],
    },
    time: {
      takes: ['09:30', '00:00', '23:59'],
      refuses: ['9:30', '24:00', '09:60', '09:30:00', '09:30Z', 930, null],
    },
    file: {
      takes: [
        { url: '/api/files/7', name: 'report.pdf', size: 1536, type: 'application/pdf' },
        { url: 'https://cdn.example.com/a.png', name: 'a.png', size: 0, type: 'image/png' },
      ],
      refuses: [
        '/api/files/7',
        { url: '/api/files/7', name: 'report.pdf' },
        { url: 'files/7', name: 'report.pdf', size: 1, type: 'application/pdf' },
        { url: '/api/files/7', name: '', size: 1, type: 'application/pdf' },
        { url: '/api/files/7', name: 'a', size: 1.5, type: 'application/pdf' },
        { url: '/api/files/7', name: 'a', size: 1, type: 'pdf' },
        { url: '/api/files/7', name: 'a', size: 1, type: 'image/png', extra: true },
        null,
      ],
    },
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

describe('how each kind orders, where bh holds the rows itself', () => {
  const order = (name: BaseKind, a: Scalar, b: Scalar, settings?: Record<string, Json>) => {
    const compare = kind(name).compare;
    if (!compare) {
      throw new Error(`the kind "${name}" orders nothing alone`);
    }
    return Math.sign(compare(a, b, settings));
  };

  it('orders text case ignored, a number by value, false before true', () => {
    expect(order('text', 'apple', 'Banana')).toBe(-1);
    expect(order('email', 'B@example.com', 'a@example.com')).toBe(1);
    expect(order('url', '/a', '/A')).toBe(0);
    expect(order('number', 2, 10)).toBe(-1);
    expect(order('boolean', true, false)).toBe(1);
  });

  it('orders a day, a time and an instant by value, whatever an instant’s fraction', () => {
    expect(order('date', '2026-10-12', '2026-10-13')).toBe(-1);
    expect(order('time', '09:30', '14:00')).toBe(-1);
    expect(order('datetime', '2026-10-12T09:30:00Z', '2026-10-12T09:30:00.000Z')).toBe(0);
    expect(order('datetime', '2026-10-12T09:30:00.5Z', '2026-10-12T09:30:00.123Z')).toBe(1);
  });

  it('orders an option by its order, never its label, one the field lacks last', () => {
    const settings = STATUS as unknown as Record<string, Json>;
    expect(order('option', 'done', 'todo', settings)).toBe(1);
    expect(order('option', 'in-progress', 'done', settings)).toBe(-1);
    expect(order('option', 'gone', 'wontfix', settings)).toBe(1);
  });

  it('gives every kind that sorts an order, but a ref, which its source orders by title', () => {
    const unordered = baseKinds.filter((spec) => spec.sort && !spec.compare);
    expect(unordered.map((spec) => spec.name)).toEqual(['ref']);
  });

  it('searches a rich text by its words, never its JSON', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Fix the' },
            { type: 'text', text: 'login' },
          ],
        },
      ],
    });
    expect(kind('richtext').searchText?.(doc)).toBe('Fix the login');
    expect(kind('richtext').searchText?.('{')).toBe('');
  });
});

describe('a number field’s settings', () => {
  it('take a min, a max and integer, and hold its values to them', () => {
    expect(settles('number', { min: 1, max: 5, integer: true })).toBe(true);
    expect(settles('number', {})).toBe(true);
    expect(settles('number', { min: 5, max: 1 })).toBe(false);
    expect(settles('number', { integer: false })).toBe(false);
    expect(settles('number', { step: 1 })).toBe(false);
    const rating = { min: 1, max: 5, integer: true };
    expect(takes('number', 3, rating)).toBe(true);
    expect(takes('number', 0, rating)).toBe(false);
    expect(takes('number', 6, rating)).toBe(false);
    expect(takes('number', 2.5, rating)).toBe(false);
    expect(takes('number', 2.5, { min: 0 })).toBe(true);
  });
});

describe('a text field’s settings', () => {
  it('take a most length, by code point, and a pattern the whole value matches', () => {
    expect(settles('text', { maxLength: 280, pattern: '[A-Z]{2,5}' })).toBe(true);
    expect(settles('text', { maxLength: 0 })).toBe(false);
    expect(settles('text', { pattern: '(' })).toBe(false);
    expect(settles('text', { pattern: '' })).toBe(false);
    expect(takes('text', '😀😀', { maxLength: 2 })).toBe(true);
    expect(takes('text', 'abc', { maxLength: 2 })).toBe(false);
    expect(takes('text', 'TIX', { pattern: '[A-Z]{2,5}' })).toBe(true);
    expect(takes('text', 'TIX-12', { pattern: '[A-Z]{2,5}' })).toBe(false);
    expect(takes('text', 'xTIX', { pattern: '[A-Z]{2,5}' })).toBe(false);
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
