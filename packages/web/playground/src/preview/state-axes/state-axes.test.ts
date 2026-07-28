import { boolean, number, select, text } from '@tickets/ui';
import { deriveAxes, enumerateControl } from './state-axes';

const CONTROLS = {
  size: select(['sm', 'md', 'lg'], { initial: 'md' }),
  variant: select(['subtle', 'solid', 'outline']),
  label: text('New ticket'),
  tone: select(['neutral', 'primary']),
  loading: boolean(false),
};

describe('enumerateControl', () => {
  it('enumerates a select over its options', () => {
    expect(enumerateControl(select(['sm', 'md']))).toEqual([
      { label: 'sm', value: 'sm' },
      { label: 'md', value: 'md' },
    ]);
  });

  it('enumerates a boolean over both of its states', () => {
    expect(enumerateControl(boolean(false))).toEqual([
      { label: 'false', value: false },
      { label: 'true', value: true },
    ]);
  });

  it.each([
    ['text', text('x')],
    ['number', number(3)],
  ])('declines to enumerate an open %s domain', (_kind, def) => {
    // There is no honest "every value" to lay out for a free-text or numeric
    // prop, so it belongs to the controls rail rather than the state viewer.
    expect(enumerateControl(def)).toBeNull();
  });
});

describe('deriveAxes', () => {
  it('orders variant, then tone, then size, then the rest as declared', () => {
    expect(deriveAxes(CONTROLS, 'button').map((s) => s.prop)).toEqual([
      'variant',
      'tone',
      'size',
      'loading',
    ]);
  });

  it('drops props with no enumerable domain', () => {
    expect(deriveAxes(CONTROLS, 'button').map((s) => s.prop)).not.toContain('label');
  });

  it('varies exactly one prop per cell, holding the rest at their defaults', () => {
    const variant = deriveAxes(CONTROLS, 'button')[0]!;
    expect(variant.cells.map((c) => c.label)).toEqual(['subtle', 'solid', 'outline']);
    // Every other prop is the demo's default in every cell — a specimen that
    // also moved its size would not isolate the axis it claims to show.
    for (const cell of variant.cells) {
      expect(cell.values.size).toBe('md');
      expect(cell.values.tone).toBe('neutral');
      expect(cell.values.label).toBe('New ticket');
    }
    expect(variant.cells.map((c) => c.values.variant)).toEqual(['subtle', 'solid', 'outline']);
  });

  it('gives every section and cell a stable, unique anchor', () => {
    const sections = deriveAxes(CONTROLS, 'button');
    expect(sections[0]!.slug).toBe('button--variant');
    expect(sections[0]!.cells[1]!.slug).toBe('button--variant-solid');
    const slugs = sections.flatMap((s) => [s.slug, ...s.cells.map((c) => c.slug)]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('returns nothing when no control is enumerable', () => {
    expect(deriveAxes({ label: text('x'), count: number(1) }, 'thing')).toEqual([]);
  });
});
