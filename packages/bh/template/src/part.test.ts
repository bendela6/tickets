import * as v from 'valibot';
import { baseKinds, type FieldFormat, type FieldMeta, type KindSpec } from '@bh/resource';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  resolvePart,
  type FieldPart,
  type Part,
  type PartDefaults,
  type PartRenderer,
  type TextPart,
  type ValuePart,
} from './part';

// An app's own kind beside bh's nine, with a format of its own.
const color: KindSpec = {
  name: 'color',
  value: () => v.string(),
  many: false,
  operators: ['equals'],
  sort: false,
  group: true,
  search: false,
  format: 'swatch',
};

// The default renderer of each kind, as the renderer registry (TK-79.3) will
// give them; json has none here.
const RENDERERS: Record<string, string> = {
  text: 'text',
  url: 'link',
  number: 'number',
  boolean: 'check',
  date: 'date',
  datetime: 'date',
  option: 'pill',
  ref: 'user',
  color: 'swatch',
};

const defaults: PartDefaults = {
  renderer: (kind) => RENDERERS[kind],
  kinds: baseKinds.register({ color }),
};

/** A field's metadata, as much of it as a part takes defaults from. */
function fieldOf(kind: string, format?: FieldFormat): Pick<FieldMeta, 'type' | 'format'> {
  return { type: { kind }, ...(format === undefined ? {} : { format }) };
}

describe('a part', () => {
  it('shows a field, a constant or a text template, one of the three', () => {
    const id: Part = { field: 'id' };
    const separator: Part = { value: '·' };
    const key: Part = { text: '{project}-{number}' };
    // @ts-expect-error a part shows one thing
    const both: Part = { field: 'title', text: '{title}' };
    // @ts-expect-error a constant is never empty
    const nothing: Part = { value: null };
    // @ts-expect-error a part shows something
    const blank: Part = { options: { mono: true } };
    expectTypeOf<Part>().toEqualTypeOf<FieldPart | ValuePart | TextPart>();
    expect([id, separator, key, both, nothing, blank]).toHaveLength(6);
  });

  it('names its renderer and its format by name, or with their options', () => {
    const link: Part = {
      field: 'id',
      renderer: { name: 'link', options: { to: '/p/{project}/t/{number}' } },
      format: 'plain',
    };
    const money: Part = {
      field: 'price',
      renderer: 'number',
      format: { name: 'money', options: { currency: 'EUR' } },
    };
    expectTypeOf<Part['format']>().toEqualTypeOf<FieldFormat | undefined>();
    expectTypeOf<Part['renderer']>().toEqualTypeOf<PartRenderer | undefined>();
    // @ts-expect-error a renderer's options are JSON, never code
    const code: Part = { field: 'id', renderer: { name: 'link', options: { to: () => '/' } } };
    expect([link, money, code]).toHaveLength(3);
  });

  it('takes the options bh’s renderers share', () => {
    const description: Part = { field: 'description', options: { clamp: 2, tone: 'gray' } };
    const version: Part = { field: 'version', options: { prefix: 'v', mono: true, weight: 600 } };
    const assignee: Part = { field: 'assignee', options: { empty: 'Unassigned' } };
    // @ts-expect-error a weight is 400, 500 or 600
    const bold: Part = { field: 'title', options: { weight: 700 } };
    // @ts-expect-error the part's options are bh's; a renderer's own go with it
    const target: Part = { field: 'id', options: { to: '/' } };
    expect([description, version, assignee, bold, target]).toHaveLength(5);
  });
});

describe('resolvePart', () => {
  it('gives a part naming neither its field’s kind’s renderer and its field’s format', () => {
    const estimate = fieldOf('number', { name: 'duration', options: { unit: 'hours' } });
    expect(resolvePart({ field: 'estimate' }, estimate, defaults)).toEqual({
      field: 'estimate',
      renderer: 'number',
      format: { name: 'duration', options: { unit: 'hours' } },
    });
  });

  it('gives a field without a format its kind’s, and none where its kind has none', () => {
    expect(resolvePart({ field: 'title' }, fieldOf('text'), defaults)).toEqual({
      field: 'title',
      renderer: 'text',
      format: 'plain',
    });
    expect(resolvePart({ field: 'updatedAt' }, fieldOf('datetime'), defaults)).toEqual({
      field: 'updatedAt',
      renderer: 'date',
      format: 'datetime',
    });
    expect(resolvePart({ field: 'status' }, fieldOf('option'), defaults)).toEqual({
      field: 'status',
      renderer: 'pill',
    });
    expect(resolvePart({ field: 'tint' }, fieldOf('color'), defaults)).toEqual({
      field: 'tint',
      renderer: 'swatch',
      format: 'swatch',
    });
  });

  it('keeps what the part names', () => {
    const id: Part = {
      field: 'id',
      renderer: { name: 'link', options: { to: '/items/{id}' } },
      format: 'number',
      options: { tone: 'blue', mono: true },
    };
    expect(resolvePart(id, fieldOf('number', 'bytes'), defaults)).toEqual(id);
    expect(
      resolvePart({ field: 'updatedAt', format: 'relative' }, fieldOf('datetime'), defaults),
    ).toEqual({ field: 'updatedAt', renderer: 'date', format: 'relative' });
  });

  it('draws a constant and a text template as text, taking no format they don’t name', () => {
    expect(resolvePart({ value: '·' }, undefined, defaults)).toEqual({
      value: '·',
      renderer: 'text',
    });
    expect(resolvePart({ text: '{project}-{number}' }, undefined, defaults)).toEqual({
      text: '{project}-{number}',
      renderer: 'text',
    });
    expect(resolvePart({ value: 'clock', renderer: 'icon' }, undefined, defaults)).toEqual({
      value: 'clock',
      renderer: 'icon',
    });
    // A field's metadata passed for a constant is no field of the part's.
    expect(resolvePart({ value: 3 }, fieldOf('number', 'bytes'), defaults)).toEqual({
      value: 3,
      renderer: 'text',
    });
  });

  it('draws a field of a kind without a default renderer, or one not known, as text', () => {
    expect(resolvePart({ field: 'settings' }, fieldOf('json'), defaults)).toEqual({
      field: 'settings',
      renderer: 'text',
    });
    expect(resolvePart({ field: 'gone' }, undefined, defaults)).toEqual({
      field: 'gone',
      renderer: 'text',
    });
    expect(resolvePart({ field: 'odd' }, fieldOf('unregistered'), defaults)).toEqual({
      field: 'odd',
      renderer: 'text',
    });
  });

  it('leaves the part it’s given as it was, and keeps its own type', () => {
    const part: FieldPart = { field: 'title', options: { clamp: 1 } };
    const resolved = resolvePart(part, fieldOf('text'), defaults);
    expect(part).toEqual({ field: 'title', options: { clamp: 1 } });
    expectTypeOf(resolved).toExtend<FieldPart & { renderer: PartRenderer }>();
    // Its renderer is always there.
    expectTypeOf(resolved.renderer).toExtend<PartRenderer>();
  });
});
