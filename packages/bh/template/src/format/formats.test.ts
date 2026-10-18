import * as v from 'valibot';
import { baseKinds, createRegistry, metaOf, type KindSpec, type ResourceMeta } from '@bh/resource';
import { defineRegistry } from '@bh/registry';
import { describe, expect, it } from 'vitest';
import { formatBytes } from './bytes';
import { formatDuration } from './duration';
import { baseFormats, type BaseFormats } from './base-formats';
import { checkFormats, formatValue } from './formats';
import type { FormatContext, Formatter } from './registry';
import { formatText, type FormatPiece } from './pieces';

/** A value in one of bh's formats, as the registry formats a field's. */
function pieces(
  name: keyof BaseFormats,
  value: Parameters<Formatter['format']>[0],
  options: Record<string, unknown> = {},
  context: FormatContext = {},
): FormatPiece[] {
  return formatValue(baseFormats, { name, options: options as never }, value, context);
}

function text(
  name: keyof BaseFormats,
  value: Parameters<Formatter['format']>[0],
  options: Record<string, unknown> = {},
  context: FormatContext = {},
): string {
  return formatText(pieces(name, value, options, context));
}

describe('bh’s formats', () => {
  it('are the eleven the feature names, each registered by its own name', () => {
    expect(baseFormats.names).toEqual([
      'number',
      'percent',
      'bytes',
      'duration',
      'money',
      'date',
      'datetime',
      'relative',
      'plain',
      'markdown',
      'rich',
    ]);
    for (const [key, entry] of baseFormats.entries()) {
      expect(entry.name).toBe(key);
    }
    expect(Object.isFrozen(baseFormats)).toBe(true);
  });

  it('take kinds the kind registry knows, so the resource’s registry accepts them as they are', () => {
    const registry = createRegistry({ formats: baseFormats });
    expect(registry.formats.names).toEqual(baseFormats.names);
  });

  it('check their options by their schemas', () => {
    const accepts = (name: keyof BaseFormats, options: unknown) => {
      const schema = baseFormats.get(name).options ?? v.strictObject({});
      return v.is(schema, options);
    };
    expect(accepts('number', { digits: 2, notation: 'compact' })).toBe(true);
    expect(accepts('number', { digits: 2.5 })).toBe(false);
    expect(accepts('number', { notation: 'scientific' })).toBe(false);
    expect(accepts('percent', { digits: 1 })).toBe(true);
    expect(accepts('percent', { digits: -1 })).toBe(false);
    expect(accepts('bytes', { units: 'decimal', digits: 0, per: 's' })).toBe(true);
    expect(accepts('bytes', { per: 'fortnight' })).toBe(false);
    expect(accepts('duration', { unit: 'ms', days: true })).toBe(true);
    expect(accepts('duration', { unit: 'hours' })).toBe(false);
    expect(accepts('money', { currency: 'EUR' })).toBe(true);
    expect(accepts('money', {})).toBe(false);
    expect(accepts('money', { currency: 'euro' })).toBe(false);
    expect(accepts('datetime', { timeZone: 'Asia/Tbilisi' })).toBe(true);
    expect(accepts('datetime', { timeZone: 'Mars/Olympus' })).toBe(false);
    expect(accepts('relative', { smallestUnit: 'minute' })).toBe(true);
    // A key no format takes is refused, so a misspelt option is found; the
    // formats that take none refuse every key.
    expect(accepts('bytes', { digit: 1 })).toBe(false);
    expect(accepts('date', { digits: 1 })).toBe(false);
    expect(accepts('plain', {})).toBe(true);
  });
});

describe('number', () => {
  it('writes the number with its grouping, to the most digits Intl gives it', () => {
    expect(text('number', 1234.5)).toBe('1,234.5');
    expect(text('number', 1234567)).toBe('1,234,567');
    expect(text('number', -0.5)).toBe('-0.5');
    expect(text('number', 1 / 3)).toBe('0.333');
  });

  it('writes to the most digits asked for, dropping a whole amount’s zeros', () => {
    expect(text('number', 1234.5678, { digits: 2 })).toBe('1,234.57');
    expect(text('number', 1234.5, { digits: 2 })).toBe('1,234.5');
    expect(text('number', 1234, { digits: 2 })).toBe('1,234');
    expect(text('number', 1234.5, { digits: 0 })).toBe('1,235');
  });

  it('writes a compact number with its suffix as a unit, to a digit when asked', () => {
    expect(pieces('number', 12400, { notation: 'compact', digits: 1 })).toEqual([
      { text: '12.4' },
      { text: 'K', unit: true },
    ]);
    expect(text('number', 1_500_000, { notation: 'compact' })).toBe('1.5M');
    expect(text('number', 999, { notation: 'compact' })).toBe('999');
    expect(text('number', 12345, { notation: 'compact', digits: 0 })).toBe('12K');
  });

  it('writes in the app’s locale, and in English for a tag Intl cannot read', () => {
    expect(text('number', 1234.5, {}, { locale: 'de' })).toBe('1.234,5');
    expect(text('number', 1234.5, {}, { locale: 'en_US' })).toBe('1,234.5');
    expect(text('number', 1234.5, {}, { locale: 'en-US' })).toBe(text('number', 1234.5));
  });

  it('hands back what is no finite number as its text', () => {
    expect(text('number', 'abc')).toBe('abc');
    expect(text('number', true)).toBe('true');
    expect(text('number', Infinity)).toBe('Infinity');
    expect(text('number', { a: 1 })).toBe('{"a":1}');
  });
});

describe('percent', () => {
  it('takes a fraction: 0.427 is 43%, the sign a unit', () => {
    expect(pieces('percent', 0.427)).toEqual([{ text: '43' }, { text: '%', unit: true }]);
    expect(text('percent', 1)).toBe('100%');
    expect(text('percent', 0)).toBe('0%');
    expect(text('percent', 1.5)).toBe('150%');
    expect(text('percent', -0.05)).toBe('-5%');
  });

  it('writes to the most digits asked for', () => {
    expect(text('percent', 0.427, { digits: 1 })).toBe('42.7%');
    expect(text('percent', 0.4, { digits: 1 })).toBe('40%');
    expect(text('percent', 0.4274, { digits: 2 })).toBe('42.74%');
  });

  it('keeps the locale’s own spacing, the space a piece of its own', () => {
    const german = pieces('percent', 0.427, {}, { locale: 'de' });
    expect(formatText(german)).toMatch(/^43\s%$/);
    expect(german.map((piece) => piece.unit)).toEqual([undefined, undefined, true]);
  });
});

describe('bytes', () => {
  it('writes a size in 1024s, its number and its unit apart', () => {
    expect(pieces('bytes', 1536)).toEqual([
      { text: '1.5' },
      { text: ' ' },
      { text: 'KiB', unit: true },
    ]);
    expect(text('bytes', 512)).toBe('512 B');
    expect(text('bytes', 64 * 1024 ** 2)).toBe('64 MiB');
  });

  it('writes what formatBytes writes, for any size and options', () => {
    for (const bytes of [0, 1, 512, 1023, 1024, 1_048_570, 2_252_000_000, -1536, 5 * 1024 ** 5]) {
      expect(text('bytes', bytes)).toBe(formatBytes(bytes));
      expect(text('bytes', bytes, { units: 'decimal', digits: 2 })).toBe(
        formatBytes(bytes, { units: 'decimal', digits: 2 }),
      );
    }
  });

  it('counts in 1000s with SI names when asked, and to the digits asked for', () => {
    expect(text('bytes', 1_500_000, { units: 'decimal' })).toBe('1.5 MB');
    expect(text('bytes', 1536, { digits: 2 })).toBe('1.5 KiB');
    expect(text('bytes', 1500, { digits: 0 })).toBe('1 KiB');
  });

  it('writes a rate with `per`, the divisor part of the unit', () => {
    const mebibytes = 12.4 * 1024 ** 2;
    expect(pieces('bytes', mebibytes, { per: 's' })).toEqual([
      { text: '12.4' },
      { text: ' ' },
      { text: 'MiB/s', unit: true },
    ]);
    expect(text('bytes', mebibytes, { per: 'min' })).toBe('12.4 MiB/min');
    expect(text('bytes', 2048, { per: 'h', units: 'decimal' })).toBe('2 kB/h');
  });

  it('hands back what is no finite number as its text, with no unit', () => {
    expect(pieces('bytes', NaN)).toEqual([{ text: 'NaN' }]);
    expect(pieces('bytes', 'big', { per: 's' })).toEqual([{ text: 'big' }]);
  });
});

describe('duration', () => {
  it('writes minutes unless told the unit, each number and unit apart', () => {
    expect(pieces('duration', 125)).toEqual([
      { text: '2' },
      { text: 'h', unit: true },
      { text: ' ' },
      { text: '5' },
      { text: 'm', unit: true },
    ]);
    expect(text('duration', 45)).toBe('45m');
  });

  it('counts in the unit of the value', () => {
    expect(text('duration', 840, { unit: 'ms' })).toBe('840ms');
    expect(text('duration', 2900, { unit: 'ms' })).toBe('2.9s');
    expect(text('duration', 86, { unit: 's' })).toBe('1m 26s');
    expect(text('duration', 2.5, { unit: 'h' })).toBe('2h 30m');
    expect(text('duration', 76, { unit: 'h' })).toBe('76h');
    expect(text('duration', 76, { unit: 'h', days: true })).toBe('3d 4h');
  });

  it('writes what formatDuration writes, for any length and options', () => {
    for (const unit of ['ms', 's', 'min', 'h'] as const) {
      for (const value of [0, 0.4, 1, 59.6, 90, 3599, 3600, 86_400, 123_456, -90, -0.0001]) {
        expect(text('duration', value, { unit })).toBe(formatDuration(value, { unit }));
        expect(text('duration', value, { unit, days: true })).toBe(
          formatDuration(value, { unit, days: true }),
        );
      }
    }
  });

  it('keeps the sign on the first number, and writes zero in its unit', () => {
    expect(pieces('duration', -90, { unit: 's' })[0]).toEqual({ text: '-1' });
    expect(text('duration', 0, { unit: 's' })).toBe('0s');
    expect(text('duration', 0)).toBe('0m');
  });

  it('hands back what is no finite number as its text', () => {
    expect(text('duration', 'soon')).toBe('soon');
    expect(text('duration', Infinity)).toBe('Infinity');
  });
});

describe('money', () => {
  it('writes an amount in its currency, the symbol a unit', () => {
    expect(pieces('money', 12.5, { currency: 'USD' })).toEqual([
      { text: '$', unit: true },
      { text: '12.50' },
    ]);
    expect(text('money', 1234.5, { currency: 'EUR' })).toBe('€1,234.50');
    expect(text('money', -3, { currency: 'USD' })).toBe('-$3.00');
  });

  it('writes the digits its currency has', () => {
    expect(text('money', 1234, { currency: 'JPY' })).toBe('¥1,234');
    expect(text('money', 1.5, { currency: 'JPY' })).toBe('¥2');
  });

  it('writes in the app’s locale', () => {
    const german = pieces('money', 1234.5, { currency: 'EUR' }, { locale: 'de-DE' });
    expect(formatText(german)).toMatch(/^1\.234,50\s€$/);
    expect(german.at(-1)).toEqual({ text: '€', unit: true });
  });

  it('shows the value unformatted when its currency is missing or wrong, never failing', () => {
    expect(text('money', 12.5)).toBe('12.5');
    expect(text('money', 12.5, { currency: 'euro' })).toBe('12.5');
    expect(text('money', 'free', { currency: 'EUR' })).toBe('free');
  });
});

describe('date', () => {
  it('writes the UTC day, the month in three letters', () => {
    expect(text('date', '2026-07-13')).toBe('Jul 13, 2026');
    expect(text('date', '2026-01-05T23:30:00Z')).toBe('Jan 5, 2026');
  });

  it('writes in the app’s locale, and hands back what no Date can read', () => {
    expect(text('date', '2026-07-13', {}, { locale: 'en-GB' })).toBe('13 Jul 2026');
    expect(text('date', '2026-07-13', {}, { locale: 'de' })).toBe('13.07.2026');
    expect(text('date', 'not a date')).toBe('not a date');
    expect(text('date', 20260713)).toBe('20260713');
  });

  it('does not read the app’s time zone, a day being the same everywhere', () => {
    const late = '2026-07-13T23:30:00Z';
    expect(text('date', late, {}, { timeZone: 'Asia/Tbilisi' })).toBe(text('date', late));
  });
});

describe('datetime', () => {
  const AT = '2026-07-13T09:05:30Z';

  it('writes the date and a 24-hour clock', () => {
    expect(text('datetime', AT, { timeZone: 'UTC' })).toBe('Jul 13, 2026, 09:05');
  });

  it('reads the clock in the app’s zone, and a format’s own zone over it', () => {
    expect(text('datetime', AT, {}, { timeZone: 'Asia/Tbilisi' })).toBe('Jul 13, 2026, 13:05');
    expect(text('datetime', AT, { timeZone: 'UTC' }, { timeZone: 'Asia/Tbilisi' })).toBe(
      'Jul 13, 2026, 09:05',
    );
    expect(text('datetime', AT, { timeZone: 'America/New_York' }, { timeZone: 'UTC' })).toBe(
      'Jul 13, 2026, 05:05',
    );
  });

  it('writes in the app’s locale, and hands back what no Date can read', () => {
    expect(text('datetime', AT, { timeZone: 'UTC' }, { locale: 'en-GB' })).toBe(
      '13 Jul 2026, 09:05',
    );
    expect(text('datetime', 'later', { timeZone: 'UTC' })).toBe('later');
  });

  it('keeps a zone the runtime does not know from taking it down', () => {
    expect(text('datetime', AT, {}, { timeZone: 'Mars/Olympus' })).toMatch(/^Jul 13, 2026, /);
  });
});

describe('relative', () => {
  const NOW = new Date('2026-07-06T09:00:00Z');

  it('counts a moment in minutes and hours under a day, and in days beyond', () => {
    const at = (value: string) => text('relative', value, {}, { now: NOW });
    expect(at('2026-07-06T08:55:00Z')).toBe('5 minutes ago');
    expect(at('2026-07-06T08:59:30Z')).toBe('just now');
    expect(at('2026-07-06T11:00:00Z')).toBe('in 2 hours');
    expect(at('2026-07-05T09:30:00Z')).toBe('23 hours ago');
    expect(at('2026-07-03T09:00:00Z')).toBe('3 days ago');
  });

  it('counts a date, which has no time of day, in days', () => {
    const at = (value: string) => text('relative', value, {}, { now: NOW });
    expect(at('2026-07-06')).toBe('today');
    expect(at('2026-07-07')).toBe('tomorrow');
    expect(at('2026-07-13')).toBe('in 7 days');
  });

  it('counts in the step asked for, over what the value’s shape says', () => {
    const value = '2026-07-06T08:00:00Z';
    expect(text('relative', value, { smallestUnit: 'day' }, { now: NOW })).toBe('today');
    expect(text('relative', value, { smallestUnit: 'minute' }, { now: NOW })).toBe('1 hour ago');
    expect(text('relative', '2026-07-06', { smallestUnit: 'minute' }, { now: NOW })).toBe(
      '9 hours ago',
    );
  });

  it('writes the locale’s words', () => {
    expect(text('relative', '2026-07-06T08:55:00Z', {}, { now: NOW, locale: 'de' })).toBe(
      'vor 5 Minuten',
    );
  });

  it('counts from the current time while the context gives no moment', () => {
    const before = Date.now();
    const justNow = text('relative', new Date(before - 30_000).toISOString());
    expect(justNow).toBe('just now');
  });

  it('hands back what no Date can read', () => {
    expect(text('relative', 'not a date', {}, { now: NOW })).toBe('not a date');
  });
});

describe('the text formats', () => {
  it('plain writes the text as it is, and a value that is not text as JSON or as written', () => {
    expect(pieces('plain', '# Not **markdown**')).toEqual([{ text: '# Not **markdown**' }]);
    expect(text('plain', 42)).toBe('42');
    expect(text('plain', false)).toBe('false');
    expect(text('plain', ['a', 1])).toBe('["a",1]');
  });

  it('markdown writes the text markdown reads as', () => {
    expect(text('markdown', '# Plan\n\nSome **bold** and a [link](https://example.com).')).toBe(
      'Plan\nSome bold and a link.',
    );
    expect(text('markdown', '- one\n- two\n\n1. three')).toBe('one\ntwo\nthree');
  });

  it('rich writes the words in a rich text, a block to a line', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Plan' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Some ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' words.' },
          ],
        },
      ],
    };
    expect(text('rich', JSON.stringify(doc))).toBe('Plan\nSome bold words.');
    expect(text('rich', 'not a document')).toBe('not a document');
  });
});

describe('formatValue', () => {
  it('formats by a name alone, or by a name with options', () => {
    expect(formatText(formatValue(baseFormats, 'percent', 0.427))).toBe('43%');
    expect(
      formatText(formatValue(baseFormats, { name: 'percent', options: { digits: 1 } }, 0.427)),
    ).toBe('42.7%');
    expect(formatText(formatValue(baseFormats, 'bytes', 2048))).toBe('2 KiB');
  });

  it('gives a value that names no format, or one nothing registered, as its text', () => {
    expect(formatValue(baseFormats, undefined, 42)).toEqual([{ text: '42' }]);
    expect(formatValue(baseFormats, 'no-such-format', 42)).toEqual([{ text: '42' }]);
    // Only a registry’s own keys count, never what every object has.
    expect(formatValue(baseFormats, 'constructor', 42)).toEqual([{ text: '42' }]);
    expect(formatValue(baseFormats, 'toString', 42)).toEqual([{ text: '42' }]);
  });

  it('gives a value whose options its format refuses as its text, never throwing', () => {
    expect(formatValue(baseFormats, { name: 'bytes', options: { per: 'week' } }, 2048)).toEqual([
      { text: '2048' },
    ]);
    expect(formatValue(baseFormats, { name: 'money', options: {} }, 12.5)).toEqual([
      { text: '12.5' },
    ]);
  });

  it('leaves a format that takes no options alone when given some', () => {
    expect(formatValue(baseFormats, { name: 'plain', options: { digits: 2 } }, 'x')).toEqual([
      { text: 'x' },
    ]);
  });

  it('gives a format its context', () => {
    const context: FormatContext = { locale: 'de', timeZone: 'UTC' };
    expect(formatText(formatValue(baseFormats, 'number', 1234.5, context))).toBe('1.234,5');
    expect(formatText(formatValue(baseFormats, 'datetime', '2026-07-13T09:05:00Z', context))).toBe(
      '13.07.2026, 09:05',
    );
  });
});

describe('an app’s own format', () => {
  // All its options are optional, so the schema takes none, named alone, as bh's do.
  const rate = v.optional(v.strictObject({ per: v.optional(v.picklist(['page', 'visit'])) }), {});

  const perPage: Formatter<v.InferOutput<typeof rate>> = {
    name: 'rate',
    kinds: ['number'],
    options: rate,
    format: (value, { per = 'page' }, { locale }) => {
      return typeof value === 'number'
        ? [{ text: value.toLocaleString(locale ?? 'en-US') }, { text: ` per ${per}`, unit: true }]
        : [{ text: String(value) }];
    },
  };

  const formats = baseFormats.register({ rate: perPage });

  it('is registered beside bh’s, and formats a field’s value by its name', () => {
    expect(formats.names).toHaveLength(baseFormats.names.length + 1);
    expect(formatValue(formats, 'rate', 1200)).toEqual([
      { text: '1,200' },
      { text: ' per page', unit: true },
    ]);
    expect(formatText(formatValue(formats, { name: 'rate', options: { per: 'visit' } }, 4))).toBe(
      '4 per visit',
    );
    expect(formatText(formatValue(formats, 'rate', 1200, { locale: 'de' }))).toBe('1.200 per page');
    // bh’s still work beside it.
    expect(formatText(formatValue(formats, 'percent', 0.5))).toBe('50%');
    expect(formatValue(baseFormats, 'rate', 1200)).toEqual([{ text: '1200' }]);
  });

  it('refuses the options its schema refuses, as bh’s do', () => {
    expect(formatValue(formats, { name: 'rate', options: { per: 'year' } }, 3)).toEqual([
      { text: '3' },
    ]);
  });

  it('is accepted by the resource’s registry, which then checks a field naming it', () => {
    const registry = createRegistry({ formats });
    const field = (key: string, format?: ResourceMeta['fields'][number]['format']) => {
      return {
        key,
        label: key,
        type: { kind: key === 'name' ? 'text' : 'number' },
        ...(format === undefined ? {} : { format }),
        query: { filter: [], sort: false, group: false, search: false },
        write: { create: false, update: false, required: false },
      };
    };
    const meta = (format: ResourceMeta['fields'][number]['format']) => {
      return {
        resource: 'pages',
        label: { one: 'Page', other: 'Pages' },
        roles: { idField: 'id', titleField: 'name' },
        fields: [field('id'), field('name'), field('hits', format)],
        sort: [],
        actions: [],
        serves: {
          read: true,
          create: false,
          update: false,
          delete: false,
          filter: { any: false, not: false },
          sort: { max: 1 },
          page: { numbered: 'any', cursor: false, total: false, max: 100 },
        },
      };
    };
    const check = metaOf(registry);
    expect(v.safeParse(check, meta('rate')).success).toBe(true);
    expect(v.safeParse(check, meta({ name: 'rate', options: { per: 'visit' } })).success).toBe(
      true,
    );
    expect(v.safeParse(check, meta({ name: 'rate', options: { per: 'year' } })).success).toBe(
      false,
    );
    expect(v.safeParse(check, meta('bytes')).success).toBe(true);
    expect(v.safeParse(check, meta('plain')).success).toBe(false);
    expect(v.safeParse(metaOf(createRegistry()), meta('rate')).success).toBe(false);
  });
});

describe('checkFormats', () => {
  const color: KindSpec = {
    name: 'color',
    value: () => v.pipe(v.string(), v.hexColor()),
    many: false,
    operators: ['equals'],
    sort: false,
    group: true,
    search: false,
  };

  it('takes bh’s formats against bh’s kinds: each kind’s default format is registered and takes it', () => {
    expect(() => {
      checkFormats(baseFormats);
    }).not.toThrow();
    const defaults = baseKinds
      .values()
      .flatMap((kind) => (kind.format === undefined ? [] : [kind.name]));
    expect(defaults).toEqual(['text', 'markdown', 'richtext', 'number', 'date', 'datetime']);
    for (const kind of baseKinds.values()) {
      if (kind.format !== undefined) {
        expect(baseFormats.get(kind.format).kinds).toContain(kind.name);
      }
    }
  });

  it('refuses a kind whose default format nothing is registered as', () => {
    const kinds = baseKinds.register({ color: { ...color, format: 'swatch' } });
    expect(() => {
      checkFormats(baseFormats, kinds);
    }).toThrow(
      'The kind "color" shows in the format "swatch" unless a field names another, but no format is registered by that name.',
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withoutNumber = defineRegistry<Formatter<any>>({ name: 'format' }).register(
      Object.fromEntries(baseFormats.entries().filter(([name]) => name !== 'number')),
    );
    expect(() => {
      checkFormats(withoutNumber);
    }).toThrow('The kind "number" shows in the format "number"');
  });

  it('refuses a kind whose default format does not take it', () => {
    const kinds = baseKinds.register({ color: { ...color, format: 'percent' } });
    expect(() => {
      checkFormats(baseFormats, kinds);
    }).toThrow(
      'The kind "color" shows in the format "percent", which takes "number" and not "color".',
    );
  });

  it('takes an app’s kind once its default format is registered and takes it', () => {
    const swatch: Formatter = {
      name: 'swatch',
      kinds: ['color'],
      format: (value) => [{ text: String(value) }],
    };
    const kinds = baseKinds.register({ color: { ...color, format: 'swatch' } });
    expect(() => {
      checkFormats(baseFormats.register({ swatch }), kinds);
    }).not.toThrow();
  });

  it('leaves to the registry a format registered by a name not its own, or with no function', () => {
    expect(() => baseFormats.register({ money2: baseFormats.get('money') })).toThrow(
      'The format "money2" is named "money": register it by its own name.',
    );
    const broken = { ...baseFormats.get('plain'), format: undefined } as unknown as Formatter;
    expect(() => baseFormats.override({ plain: broken })).toThrow(
      'format "plain": format: its format is a function',
    );
  });
});
