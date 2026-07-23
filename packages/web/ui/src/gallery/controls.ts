import type { ReactNode } from 'react';

export interface SelectDef<T extends string = string, N extends boolean = boolean> {
  kind: 'select';
  options: readonly T[];
  initial: T | undefined;
  allowNone: N;
  label: string | undefined;
}
export interface BooleanDef {
  kind: 'boolean';
  initial: boolean;
  label: string | undefined;
}
export interface TextDef {
  kind: 'text';
  initial: string;
  placeholder: string;
  label: string | undefined;
}
export interface NumberDef {
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

export interface PlaygroundDef<C extends Record<string, AnyControlDef> = Record<string, AnyControlDef>> {
  controls: C;
  render: (values: ControlValues<C>) => ReactNode;
}
export type AnyPlayground = PlaygroundDef;

// Overloads (not a const-generic default) so N is concrete at every call
// site: during definePlayground's callback inference a generic N widens to
// its `boolean` constraint and the ControlValue conditional distributes,
// leaking `| undefined` into non-allowNone selects.
export function select<const T extends readonly string[]>(
  options: T,
  opts: { initial?: T[number]; label?: string; allowNone: true },
): SelectDef<T[number], true>;
export function select<const T extends readonly string[]>(
  options: T,
  opts?: { initial?: T[number]; label?: string; allowNone?: false },
): SelectDef<T[number], false>;
export function select<const T extends readonly string[]>(
  options: T,
  opts?: { initial?: T[number]; label?: string; allowNone?: boolean },
): SelectDef<T[number], boolean> {
  const allowNone = opts?.allowNone ?? false;
  return {
    kind: 'select',
    options,
    initial: opts?.initial ?? (allowNone ? undefined : options[0]),
    allowNone,
    label: opts?.label,
  };
}

function booleanControl(initial = false, opts?: { label?: string }): BooleanDef {
  return { kind: 'boolean', initial, label: opts?.label };
}
export { booleanControl as boolean };

function textControl(initial = '', opts?: { label?: string; placeholder?: string }): TextDef {
  return { kind: 'text', initial, placeholder: opts?.placeholder ?? '', label: opts?.label };
}
export { textControl as text };

function numberControl(
  initial = 0,
  opts?: { min?: number; max?: number; step?: number; label?: string },
): NumberDef {
  return { kind: 'number', initial, min: opts?.min, max: opts?.max, step: opts?.step ?? 1, label: opts?.label };
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
