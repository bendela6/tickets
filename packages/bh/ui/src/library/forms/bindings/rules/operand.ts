import type { Condition, FieldMeta, OperatorSpec, Scalar } from '@bh/resource';
import type { Option } from '../../../inputs/contract';
import type { InputKind } from '../../registry';
import { hueOf } from '../option-hues';
import { optionsOf, takesOperand, type RuleOption, type RulesMeta } from './meta';

// The value step: which registered input draws an operator's value on a field,
// and how the input's value and the condition's operand turn into each other.

/** A condition's operand: one value, or a list of them. */
export type Operand = NonNullable<Condition['value']>;

/** How a rule's value is drawn and read. */
export interface OperandInput {
  /** The registered input that draws it. */
  type: InputKind;
  /** That input's config. */
  config: Record<string, unknown>;
  /** The input's value for an operand; its empty value for none. */
  toInput: (operand: Condition['value']) => unknown;
  /** The operand an input's value is; undefined while it isn't one yet, as an empty box. */
  toOperand: (input: unknown) => Operand | undefined;
}

const TEXT_KINDS = new Set(['text', 'markdown', 'richtext', 'url', 'email', 'phone']);
const LISTS = new Set(['in', 'notIn']);
const SINGLE_CHOICE = new Set(['equals', 'notEquals']);
const YES_NO: Option[] = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

/** The operand's values as a list. */
function listOf(operand: Condition['value']): Scalar[] {
  if (operand === undefined) {
    return [];
  }
  return Array.isArray(operand) ? operand : [operand];
}

/** Text that isn't blank, else nothing. */
function text(input: unknown): string | undefined {
  return typeof input === 'string' && input.trim() !== '' ? input : undefined;
}

/** A list that isn't empty, else nothing. */
function some<T>(list: T[]): T[] | undefined {
  return list.length > 0 ? list : undefined;
}

/** A form's text input that hands over each keystroke, whatever the form's own `commit`. */
const TEXT = { commit: 'change' } as const;

/** An option or a ref's row as a choice offers it. */
function choicesOf(options: readonly RuleOption[]): Option[] {
  return options.map((option) => {
    const color = hueOf(option.color);
    return { value: option.value, label: option.label, ...(color ? { color } : {}) };
  });
}

/** Whether an input holds nothing: no value, no text, no item. */
function isEmpty(input: unknown): boolean {
  return (
    input === undefined ||
    input === null ||
    input === '' ||
    (Array.isArray(input) && input.length === 0)
  );
}

/**
 * A choice of one, or of several, among options; several show a placeholder
 * that says what to choose while none is.
 */
function choice(op: string, options: readonly RuleOption[], placeholder: string): OperandInput {
  if (LISTS.has(op)) {
    return {
      type: 'multi-select',
      config: { options: choicesOf(options), placeholder },
      toInput: (operand) => listOf(operand).map(String),
      toOperand: (input) => some(Array.isArray(input) ? input.map(String) : []),
    };
  }
  return {
    type: 'select',
    config: { options: choicesOf(options) },
    toInput: (operand) => (operand === undefined ? null : String(listOf(operand)[0])),
    toOperand: (input) => text(input),
  };
}

/** Yes and No, one or both. */
function yesNo(op: string): OperandInput {
  const truth = (value: string) => value === 'true';
  if (LISTS.has(op)) {
    return {
      type: 'multi-select',
      config: { options: YES_NO },
      toInput: (operand) => listOf(operand).map(String),
      toOperand: (input) => some(Array.isArray(input) ? input.map(String).map(truth) : []),
    };
  }
  return {
    type: 'segmented',
    config: { options: YES_NO },
    toInput: (operand) => (operand === undefined ? '' : String(listOf(operand)[0])),
    toOperand: (input) => (input === 'true' || input === 'false' ? truth(input) : undefined),
  };
}

/** Several typed values, as tags: text as it is, numbers parsed. */
function tags(numbers: boolean): OperandInput {
  return {
    type: 'tags',
    config: {},
    toInput: (operand) => listOf(operand).map(String),
    toOperand: (input) => {
      const typed = Array.isArray(input) ? input.map(String) : [];
      if (!numbers) {
        return some(typed);
      }
      const parsed = typed.map(Number);
      return parsed.some((each) => !Number.isFinite(each)) ? undefined : some(parsed);
    },
  };
}

/** A number: a count of days after `inLast`, a value otherwise. */
function number(days: boolean): OperandInput {
  return {
    type: 'number',
    config: days ? { ...TEXT, min: 1, step: 1, suffix: 'days' } : TEXT,
    toInput: (operand) => (typeof operand === 'number' ? operand : null),
    toOperand: (input) => (typeof input === 'number' && Number.isFinite(input) ? input : undefined),
  };
}

/** A day; a datetime's operand is that day's first moment, in UTC. */
function day(datetime: boolean): OperandInput {
  return {
    type: 'date',
    config: {},
    toInput: (operand) => (typeof operand === 'string' ? operand.slice(0, 10) : null),
    toOperand: (input) => {
      const picked = text(input);
      return picked && datetime ? `${picked}T00:00:00.000Z` : picked;
    },
  };
}

/** One value as typed. */
function plain(type: InputKind, config: Record<string, unknown> = {}): OperandInput {
  return {
    type,
    config,
    toInput: (operand) => (typeof operand === 'string' ? operand : type === 'text' ? '' : null),
    toOperand: (input) => text(input),
  };
}

/**
 * The input a form draws for an operator's value on a field, as a filter's
 * + Filter draws it: `select` for `equals` and `notEquals` on an option or a
 * ref, `multi-select` for `in` and `notIn`; `text` for text and `tags` for
 * several; `number` for a number, and for `inLast` with "days" after it;
 * `date` for a date and a datetime, a datetime from the day's first moment;
 * `segmented` Yes and No for a boolean; the app's own input for its own
 * operator; and none for an operator that takes no value, as `empty` and
 * `isMe`. `options` are a ref's rows, as `optionsFor` gave them.
 */
export function operandInput(
  meta: RulesMeta,
  field: FieldMeta,
  spec: OperatorSpec,
  options: readonly RuleOption[] = [],
): OperandInput | null {
  if (!takesOperand(spec)) {
    return null;
  }
  const own = meta.operatorInputs?.[spec.name];
  if (own) {
    return {
      type: own,
      config: {},
      toInput: (operand) => operand ?? null,
      toOperand: (input) => (isEmpty(input) ? undefined : (input as Operand)),
    };
  }
  const kind = field.type.kind;
  if (spec.name === 'inLast' || spec.name === 'notInLast') {
    return number(true);
  }
  if (kind === 'option' || kind === 'ref') {
    const offered =
      kind === 'option' ? optionsOf({ field }).filter((each) => !each.archived) : options;
    const placeholder = `Choose ${field.label.toLowerCase()}`;
    return LISTS.has(spec.name) || SINGLE_CHOICE.has(spec.name)
      ? choice(spec.name, offered, placeholder)
      : null;
  }
  if (kind === 'boolean') {
    return yesNo(spec.name);
  }
  if (LISTS.has(spec.name)) {
    return tags(kind === 'number');
  }
  if (kind === 'number') {
    return number(false);
  }
  if (kind === 'date' || kind === 'datetime') {
    return day(kind === 'datetime');
  }
  if (kind === 'time') {
    return plain('time');
  }
  if (TEXT_KINDS.has(kind)) {
    return plain('text', TEXT);
  }
  // An app's own kind, with none of its own input: its value as typed.
  return plain('text', TEXT);
}
