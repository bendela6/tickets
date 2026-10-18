import { baseKinds } from '@bh/resource';
import { describe, expect, it } from 'vitest';
import { baseFormats } from './format/base-formats';
import type { TemplateField } from './part';
import { fieldAt, partValues, shownOf, textOf, type ShowContext } from './shown';

const STATUS: TemplateField = {
  key: 'status',
  label: 'Status',
  type: {
    kind: 'option',
    settings: {
      options: [
        { value: 'open', label: 'Open', color: 'green', order: 0, attributes: { group: 'live' } },
        { value: 'shut', label: 'Shut', order: 1, attributes: { group: 'past' } },
      ],
      attributes: [
        {
          key: 'group',
          label: 'Group',
          kind: 'option',
          options: [
            { value: 'live', label: 'Live', color: 'blue', order: 0 },
            { value: 'past', label: 'Past', order: 1 },
          ],
        },
      ],
    },
  },
};

const FIELDS: TemplateField[] = [
  { key: 'title', label: 'Title', type: { kind: 'text' } },
  { key: 'size', label: 'Size', type: { kind: 'number' }, format: 'bytes' },
  { key: 'count', label: 'Count', type: { kind: 'number' } },
  { key: 'owner', label: 'Owner', type: { kind: 'ref', settings: { of: 'users' } } },
  { key: 'labels', label: 'Labels', type: { kind: 'text', many: true } },
  STATUS,
];

const context: ShowContext = {
  fields: FIELDS,
  formats: baseFormats,
  kinds: baseKinds,
  refOf: (_field, id) => (id === 7 ? { title: 'Ana Lee', image: '/a.png' } : undefined),
};

const RECORD = {
  title: 'Repaint the hall',
  size: 13_002_342,
  count: 1234.5,
  owner: 7,
  labels: ['paint', '', 'hall'],
  status: 'open',
};

describe('shownOf', () => {
  it('shows an option by its label, in its color', () => {
    expect(shownOf('open', STATUS, undefined, context)).toEqual([
      { value: 'open', text: 'Open', tone: 'green' },
    ]);
    expect(shownOf('gone', STATUS, undefined, context)).toEqual([{ value: 'gone', text: 'gone' }]);
  });

  it("shows a ref by its row's title and picture, else its id", () => {
    const owner = fieldAt('owner', FIELDS);
    expect(shownOf(7, owner, undefined, context)).toEqual([
      { value: 7, text: 'Ana Lee', image: '/a.png' },
    ]);
    expect(shownOf(8, owner, undefined, context)).toEqual([{ value: 8, text: '8' }]);
  });

  it('writes a value in its format', () => {
    expect(shownOf(13_002_342, fieldAt('size', FIELDS), 'bytes', context)).toEqual([
      { value: 13_002_342, text: '12.4 MiB' },
    ]);
  });

  it("shows a many field's entries one by one, leaving out the empty, and none for nothing", () => {
    expect(shownOf(RECORD.labels, fieldAt('labels', FIELDS), 'plain', context)).toEqual([
      { value: 'paint', text: 'paint' },
      { value: 'hall', text: 'hall' },
    ]);
    for (const empty of [null, undefined, '', []]) {
      expect(shownOf(empty, fieldAt('title', FIELDS), 'plain', context)).toEqual([]);
    }
  });
});

describe('fieldAt', () => {
  it("reads an option's attribute as a field of its own, with its options", () => {
    expect(fieldAt('status.group', FIELDS)).toMatchObject({
      key: 'status.group',
      label: 'Group',
      type: { kind: 'option' },
    });
    expect(fieldAt('status.nothing', FIELDS)).toBeUndefined();
    expect(fieldAt('missing', FIELDS)).toBeUndefined();
  });
});

describe('partValues', () => {
  const part = <P extends object>(p: P) => ({ renderer: 'text', ...p });

  it("shows a field's values in the part's format, an attribute by its own label", () => {
    expect(partValues(part({ field: 'size', format: 'bytes' }), RECORD, context)).toEqual([
      { value: 13_002_342, text: '12.4 MiB' },
    ]);
    expect(partValues(part({ field: 'status.group' }), RECORD, context)).toEqual([
      { value: 'live', text: 'Live', tone: 'blue' },
    ]);
  });

  it('shows a constant, in its format when it names one', () => {
    expect(partValues(part({ value: 0.427, format: 'percent' }), RECORD, context)).toEqual([
      { value: 0.427, text: '43%' },
    ]);
  });

  it('fills a text template, each field in its own format, and shows none when nothing is left', () => {
    expect(partValues(part({ text: '{status}: {size}' }), RECORD, context)).toEqual([
      { value: 'Open: 12.4 MiB', text: 'Open: 12.4 MiB' },
    ]);
    expect(partValues(part({ text: '{missing}' }), RECORD, context)).toEqual([]);
  });
});

describe('textOf', () => {
  it("joins a many field's values, and shows a malformed template as written", () => {
    expect(textOf('{labels}', RECORD, context)).toBe('paint, hall');
    expect(textOf('{count} items', RECORD, context)).toBe('1,234.5 items');
    expect(textOf('{title', RECORD, context)).toBe('{title');
  });
});
