import { boolean, number, select, text } from '@tickets/ui';
import { deriveAxes, enumerateControl } from './state-axes';

const CONTROLS = {
  size: select(['sm', 'md', 'lg'], { initial: 'md' }),
  variant: select(['subtle', 'solid', 'outline']),
  label: text('New ticket'),
  tone: select(['neutral', 'primary']),
  loading: boolean(false),
};

// The same demo without the second half of the pair, so the single-axis rules
// can be stated without the crossing swallowing `variant`.
const SOLO = {
  size: select(['sm', 'md', 'lg'], { initial: 'md' }),
  variant: select(['subtle', 'solid', 'outline']),
  label: text('New ticket'),
  loading: boolean(false),
};

function axisAt(sections: ReturnType<typeof deriveAxes>, index: number) {
  const section = sections[index];
  if (!section || section.kind !== 'axis') throw new Error(`section ${index} is not an axis`);
  return section;
}

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
    expect(deriveAxes(SOLO, 'button').map((s) => s.title)).toEqual(['variant', 'size', 'loading']);
  });

  it('leaves size where the author put it when there is no variant or tone', () => {
    // The promotion exists to rank a component's axes. A demo with neither of
    // the loud two has no hierarchy to impose, so hoisting its `size` would
    // just override the author — Typography declares font before size and
    // means it.
    const controls = {
      font: select(['sans', 'mono']),
      size: select(['11', '13']),
      weight: select(['400', '500']),
    };
    expect(deriveAxes(controls, 'typography').map((s) => s.title)).toEqual([
      'font',
      'size',
      'weight',
    ]);
  });

  it('drops props with no enumerable domain', () => {
    expect(deriveAxes(SOLO, 'button').map((s) => s.title)).not.toContain('label');
  });

  it('varies exactly one prop per cell, holding the rest at their defaults', () => {
    const variant = axisAt(deriveAxes(SOLO, 'button'), 0);
    expect(variant.cells.map((c) => c.label)).toEqual(['subtle', 'solid', 'outline']);
    // Every other prop is the demo's default in every cell — a specimen that
    // also moved its size would not isolate the axis it claims to show.
    for (const cell of variant.cells) {
      expect(cell.values.size).toBe('md');
      expect(cell.values.label).toBe('New ticket');
    }
    expect(variant.cells.map((c) => c.values.variant)).toEqual(['subtle', 'solid', 'outline']);
  });

  it('gives every section and cell a stable, unique anchor', () => {
    const sections = deriveAxes(SOLO, 'button');
    expect(axisAt(sections, 0).slug).toBe('button--variant');
    expect(axisAt(sections, 0).cells[1]!.slug).toBe('button--variant-solid');
    const slugs = sections.flatMap((s) => [s.slug, ...(s.kind === 'axis' ? s.cells : []).map((c) => c.slug)]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('returns nothing when no control is enumerable', () => {
    expect(deriveAxes({ label: text('x'), count: number(1) }, 'thing')).toEqual([]);
  });
});

describe('variant × tone', () => {
  const sections = deriveAxes(CONTROLS, 'button');
  const cross = sections[0]!;
  if (cross.kind !== 'cross') throw new Error('expected the pair to cross');

  it('replaces both single-prop rows with one crossed section', () => {
    // The variant row and the tone row are this grid's first column and first
    // row — keeping them would print the same specimens twice, directly above
    // the grid that already holds them.
    expect(sections.map((s) => s.title)).toEqual(['variant × tone', 'size', 'loading']);
  });

  it('puts variant across the top and tone down the side', () => {
    // Tone is the long axis — seventeen rungs in the real vocabulary — and a
    // section scrolls sideways, not down.
    expect(cross.columns).toEqual(['subtle', 'solid', 'outline']);
    expect(cross.rows).toEqual(['neutral', 'primary']);
  });

  it('takes the front of the page, where variant would have been', () => {
    expect(cross.slug).toBe('button--variant-tone');
  });

  it('moves both props per cell and nothing else', () => {
    expect(cross.values('primary', 'outline')).toEqual({
      size: 'md',
      variant: 'outline',
      label: 'New ticket',
      tone: 'primary',
      loading: false,
    });
  });

  it('stays two rows when only one half of the pair is there', () => {
    const toneOnly = { tone: select(['neutral', 'primary']), size: select(['sm', 'md']) };
    expect(deriveAxes(toneOnly, 'x').map((s) => s.kind)).toEqual(['axis', 'axis']);
  });
});
