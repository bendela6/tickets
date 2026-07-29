import { initialValues, kebab, type AnyControlDef } from '@tickets/ui';

/** One specimen: a prop value, and the full prop set that renders it. */
export interface AxisCell {
  /** The value's own name — `solid`, `true`. Labels the specimen. */
  label: string;
  /** The demo's defaults with exactly this axis overridden, so a cell differs
   *  from its neighbours in one prop and nothing else. */
  values: Record<string, unknown>;
  /** Stable anchor, e.g. `button--variant-solid`. */
  slug: string;
}

/** Every value of one prop, rendered together. */
export interface AxisSection {
  kind: 'axis';
  /** Card heading. An axis is titled by the prop it varies. */
  title: string;
  prop: string;
  cells: AxisCell[];
  /** Stable anchor, e.g. `button--variant`. */
  slug: string;
}

/**
 * Two props crossed. `variant` decides how much of a tone a component spends
 * and `tone` decides which ramp, so neither means anything without the other,
 * and two single-prop rows can never show the pair that fails — a ghost danger
 * button is on neither of them.
 */
export interface CrossSection {
  kind: 'cross';
  /** Card heading, `variant × tone`. */
  title: string;
  rowProp: string;
  columnProp: string;
  rows: string[];
  columns: string[];
  /** The demo's defaults with both axes overridden. */
  values: (row: string, column: string) => Record<string, unknown>;
  slug: string;
}

export type StateSection = AxisSection | CrossSection;

/** The one pair that crosses, columns first. Everything else is a lone axis. */
const CROSS: [column: string, row: string] = ['variant', 'tone'];

/**
 * The vocabulary reads variant, then tone, then size — loudest axis first,
 * geometry last. Anything else follows in the order the demo declared it,
 * which is the author's own reading order.
 *
 * `size` is only promoted alongside one of the other two. The ordering exists
 * to give a COMPONENT's axes a hierarchy; a demo with no variant and no tone
 * has no such hierarchy to impose, and promoting its `size` there just
 * overrides the author — the Typography page declares font before size and
 * means it.
 */
const LEADING = ['variant', 'tone', 'size'];

function leadingFor(declared: string[]): string[] {
  const loud = LEADING.filter((key) => key !== 'size' && declared.includes(key));
  return loud.length > 0 ? LEADING.filter((key) => declared.includes(key)) : loud;
}

/**
 * The values a control can be enumerated over, or `null` when it cannot be.
 * A select is its options and a boolean is both of its states; text and number
 * are open domains, so there is no honest "every value" to lay out and they
 * are left to the playground's controls rail instead.
 */
export function enumerateControl(def: AnyControlDef): { label: string; value: unknown }[] | null {
  if (def.kind === 'select') {
    return def.options.map((option) => ({ label: option, value: option }));
  }
  if (def.kind === 'boolean') {
    return [
      { label: 'false', value: false },
      { label: 'true', value: true },
    ];
  }
  return null;
}

/** Both halves of the cross present and enumerable, or null. */
function crossOf(
  controls: Record<string, AnyControlDef>,
): { rows: string[]; columns: string[] } | null {
  const [columnProp, rowProp] = CROSS;
  const columnDef = controls[columnProp];
  const rowDef = controls[rowProp];
  if (columnDef?.kind !== 'select' || rowDef?.kind !== 'select') return null;
  return { rows: [...rowDef.options], columns: [...columnDef.options] };
}

/**
 * Turns a demo's playground controls into one section per enumerable prop.
 * The state viewer is derived from this rather than from a hand-written list,
 * so a prop that gains an option gains a specimen without anyone remembering
 * to add one.
 *
 * `variant` and `tone` are the exception: with both present they become one
 * crossed section and the two single-prop rows are dropped. Those rows are the
 * crossing's own first column and first row, so keeping them would print the
 * same specimens twice directly above the grid that already holds them.
 */
export function deriveAxes(
  controls: Record<string, AnyControlDef>,
  demoSlug: string,
): StateSection[] {
  const base = initialValues(controls) as Record<string, unknown>;
  const declared = Object.keys(controls);
  const leading = leadingFor(declared);
  const ordered = [...leading, ...declared.filter((key) => !leading.includes(key))];
  const [columnProp, rowProp] = CROSS;
  const cross = crossOf(controls);

  const sections: StateSection[] = [];
  for (const prop of ordered) {
    // The crossed pair takes the slot the column prop would have held, which
    // is the front — `variant` leads the vocabulary.
    if (cross && prop === columnProp) {
      sections.push({
        kind: 'cross',
        title: `${columnProp} × ${rowProp}`,
        rowProp,
        columnProp,
        rows: cross.rows,
        columns: cross.columns,
        values: (row, column) => ({ ...base, [rowProp]: row, [columnProp]: column }),
        slug: `${demoSlug}--${kebab(columnProp)}-${kebab(rowProp)}`,
      });
      continue;
    }
    if (cross && prop === rowProp) continue;

    const def = controls[prop];
    if (!def) continue;
    const values = enumerateControl(def);
    if (!values) continue;
    sections.push({
      kind: 'axis',
      title: prop,
      prop,
      slug: `${demoSlug}--${kebab(prop)}`,
      cells: values.map(({ label, value }) => ({
        label,
        values: { ...base, [prop]: value },
        slug: `${demoSlug}--${kebab(prop)}-${kebab(label)}`,
      })),
    });
  }
  return sections;
}
