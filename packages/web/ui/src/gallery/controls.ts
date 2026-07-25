import type { ReactNode } from 'react';

// Documentation a control carries into the Props tab (design 1j). All
// optional: a control with none of it still renders a complete row — name,
// derived type, badge, options and defaults all come from the control itself.
export interface ControlDocs {
  /**
   * Named type printed under the prop name — `Tone`, `IconName`, `ReactNode`.
   * Falls back to the control's primitive (`enum`/`boolean`/`string`/`number`).
   */
  type?: string;
  /** Prose for the props row: what the prop does and when to reach for it. */
  description?: string;
  /** Badges the prop REQUIRED instead of OPTIONAL. */
  required?: boolean;
}

export interface SelectDef<T extends string = string, N extends boolean = boolean> extends ControlDocs {
  kind: 'select';
  options: readonly T[];
  initial: T | undefined;
  allowNone: N;
  label: string | undefined;
}
export interface BooleanDef extends ControlDocs {
  kind: 'boolean';
  initial: boolean;
  label: string | undefined;
}
export interface TextDef extends ControlDocs {
  kind: 'text';
  initial: string;
  placeholder: string;
  label: string | undefined;
}
export interface NumberDef extends ControlDocs {
  kind: 'number';
  initial: number;
  min: number | undefined;
  max: number | undefined;
  step: number;
  label: string | undefined;
}
export type AnyControlDef = SelectDef | BooleanDef | TextDef | NumberDef;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ControlValue<D> = D extends SelectDef<infer T, infer N>
  ? N extends true
    ? T | undefined
    : T
  : D extends BooleanDef
    ? boolean
    : D extends TextDef
      ? string
      : D extends NumberDef
        ? number
        : never;

export type ControlValues<C extends Record<string, AnyControlDef>> = { [K in keyof C]: ControlValue<C[K]> };

// Component-level documentation, shown in the Props tab's API header
// (design 1j). Everything is optional; the package name is derived from the
// demo's path rather than declared.
export interface PlaygroundDocs {
  /**
   * Prose under the API heading — what the component is for and the one rule
   * a caller most needs. Spans in `backticks` render as inline code.
   */
  summary?: string;
  /** Right-hand meta column, second line — e.g. 'v2.4.0 · stable'. */
  version?: string;
  /** Right-hand meta column, third line, drawn in the success tone. */
  status?: string;
}

export interface PlaygroundDef<C extends Record<string, AnyControlDef> = Record<string, AnyControlDef>> {
  controls: C;
  render: (values: ControlValues<C>) => ReactNode;
  docs?: PlaygroundDocs;
}
export type AnyPlayground = PlaygroundDef;

// Overloads (not a const-generic default) so N is concrete at every call
// site: during definePlayground's callback inference a generic N widens to
// its `boolean` constraint and the ControlValue conditional distributes,
// leaking `| undefined` into non-allowNone selects.
export function select<const T extends readonly string[]>(
  options: T,
  opts: ControlDocs & { initial?: T[number]; label?: string; allowNone: true },
): SelectDef<T[number], true>;
export function select<const T extends readonly string[]>(
  options: T,
  opts?: ControlDocs & { initial?: T[number]; label?: string; allowNone?: false },
): SelectDef<T[number], false>;
export function select<const T extends readonly string[]>(
  options: T,
  opts?: ControlDocs & { initial?: T[number]; label?: string; allowNone?: boolean },
): SelectDef<T[number], boolean> {
  const allowNone = opts?.allowNone ?? false;
  return {
    kind: 'select',
    options,
    initial: opts?.initial ?? (allowNone ? undefined : options[0]),
    allowNone,
    label: opts?.label,
    ...docsOf(opts),
  };
}

// Picks just the doc fields off an opts bag so each constructor spreads the
// same three keys without copying the list four times.
function docsOf(opts: ControlDocs | undefined): ControlDocs {
  return { type: opts?.type, description: opts?.description, required: opts?.required };
}

function booleanControl(initial = false, opts?: ControlDocs & { label?: string }): BooleanDef {
  return { kind: 'boolean', initial, label: opts?.label, ...docsOf(opts) };
}
export { booleanControl as boolean };

function textControl(
  initial = '',
  opts?: ControlDocs & { label?: string; placeholder?: string },
): TextDef {
  return {
    kind: 'text',
    initial,
    placeholder: opts?.placeholder ?? '',
    label: opts?.label,
    ...docsOf(opts),
  };
}
export { textControl as text };

function numberControl(
  initial = 0,
  opts?: ControlDocs & { min?: number; max?: number; step?: number; label?: string },
): NumberDef {
  return {
    kind: 'number',
    initial,
    min: opts?.min,
    max: opts?.max,
    step: opts?.step ?? 1,
    label: opts?.label,
    ...docsOf(opts),
  };
}
export { numberControl as number };

export function definePlayground<C extends Record<string, AnyControlDef>>(p: PlaygroundDef<C>): PlaygroundDef<C> {
  return p;
}

export function initialValues<C extends Record<string, AnyControlDef>>(controls: C): ControlValues<C> {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(controls)) out[key] = def.initial;
  return out as ControlValues<C>;
}
