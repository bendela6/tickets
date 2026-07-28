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
  prop: string;
  cells: AxisCell[];
  /** Stable anchor, e.g. `button--variant`. */
  slug: string;
}

/**
 * The vocabulary reads variant, then tone, then size — loudest axis first,
 * geometry last. Anything else follows in the order the demo declared it,
 * which is the author's own reading order.
 */
const LEADING = ['variant', 'tone', 'size'];

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

/**
 * Turns a demo's playground controls into one section per enumerable prop.
 * The state viewer is derived from this rather than from a hand-written list,
 * so a prop that gains an option gains a specimen without anyone remembering
 * to add one.
 */
export function deriveAxes(
  controls: Record<string, AnyControlDef>,
  demoSlug: string,
): AxisSection[] {
  const base = initialValues(controls) as Record<string, unknown>;
  const declared = Object.keys(controls);
  const ordered = [
    ...LEADING.filter((key) => declared.includes(key)),
    ...declared.filter((key) => !LEADING.includes(key)),
  ];

  const sections: AxisSection[] = [];
  for (const prop of ordered) {
    const def = controls[prop];
    if (!def) continue;
    const values = enumerateControl(def);
    if (!values) continue;
    sections.push({
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
