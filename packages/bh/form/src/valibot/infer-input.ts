import type { FormConfig } from '../types/form-config';
import type { InputRegistry } from '../types/registry';

interface PipeItem {
  type: string;
  requirement?: unknown;
  title?: unknown;
  description?: unknown;
  metadata?: unknown;
}

interface ValibotEntry {
  type: string;
  pipe?: PipeItem[];
  options?: unknown[];
  wrapped?: ValibotEntry;
  item?: ValibotEntry;
  entries?: Record<string, unknown>;
}

export interface InferredField {
  type: string;
  required: boolean;
  config: Record<string, unknown>;
  /** From the schema's `v.title()`. */
  label?: string;
  /** From the schema's `v.description()`. */
  description?: string;
}

/** The object schemas valibot has: plain, strict and loose all read the same here. */
const OBJECTS = new Set(['object', 'strict_object', 'loose_object']);

export const isObjectSchema = (
  entry: { type?: unknown; entries?: unknown } | null | undefined,
): entry is { type: string; entries: Record<string, unknown> } => {
  return OBJECTS.has(String(entry?.type)) && typeof entry?.entries === 'object';
};

/**
 * What the pipes along the way say about the field: its title and
 * description, and an input asked for by name with
 * `v.metadata({ input: 'textarea' })` or `v.metadata({ input: { type, config } })`.
 */
interface Said {
  label?: string;
  description?: string;
  input?: { type: string; config: Record<string, unknown> };
}

function said(pipe: PipeItem[] | undefined, into: Said): void {
  for (const item of pipe ?? []) {
    if (item.type === 'title' && typeof item.title === 'string') {
      into.label ??= item.title;
    } else if (item.type === 'description' && typeof item.description === 'string') {
      into.description ??= item.description;
    } else if (item.type === 'metadata') {
      const input = (item.metadata as { input?: unknown } | undefined)?.input;
      if (typeof input === 'string') {
        into.input ??= { type: input, config: {} };
      } else if (typeof (input as { type?: unknown } | undefined)?.type === 'string') {
        const { type, config } = input as { type: string; config?: Record<string, unknown> };
        into.input ??= { type, config: config ?? {} };
      }
    }
  }
}

/** The options of a picklist or an enum, as a select offers them. */
const optionsOf = (entry: ValibotEntry) => {
  return (entry.options ?? []).map((value) => ({ value, label: String(value) }));
};

/** Unwraps optional/nullish/nullable, gathering what the pipes say on the way. */
function unwrap(
  entry: ValibotEntry | undefined,
  into: Said,
): { cur?: ValibotEntry; optional: boolean } {
  let optional = false;
  let cur = entry;
  said(cur?.pipe, into);
  while (cur && (cur.type === 'optional' || cur.type === 'nullish' || cur.type === 'nullable')) {
    optional = true;
    cur = cur.wrapped;
    said(cur?.pipe, into);
  }
  return { cur, optional };
}

/** The field a list holds many of, by what each item is. */
function listOf(
  item: ValibotEntry | undefined,
  toConfig: (schema: unknown) => FormConfig<InputRegistry>,
): Pick<InferredField, 'type' | 'config'> | undefined {
  const { cur } = unwrap(item, {});
  if (cur?.type === 'string') {
    return { type: 'tags', config: {} };
  }
  if (cur?.type === 'picklist' || cur?.type === 'enum') {
    return { type: 'multi-select', config: { options: optionsOf(cur) } };
  }
  if (cur && isObjectSchema(cur)) {
    return { type: 'list', config: { item: toConfig(cur) } };
  }
  return undefined;
}

/**
 * The input a schema entry asks for. `toConfig` builds the form an object
 * entry (or each item of a list of objects) holds, as `schemaToFormConfig`
 * builds the outer one.
 */
export function inferField(
  entry: ValibotEntry,
  toConfig: (schema: unknown) => FormConfig<InputRegistry>,
): InferredField {
  const notes: Said = {};
  const { cur, optional } = unwrap(entry, notes);
  const required = !optional;
  const { label, description } = notes;
  const field = (type: string, config: Record<string, unknown> = {}): InferredField => {
    const input = notes.input;
    return {
      type: input?.type ?? type,
      required: cur ? required : false,
      config: { ...config, ...input?.config },
      ...(label === undefined ? {} : { label }),
      ...(description === undefined ? {} : { description }),
    };
  };

  if (!cur) {
    return field('text');
  }
  if (cur.type === 'string') {
    return field(cur.pipe?.some((p) => p.type === 'email') ? 'email' : 'text');
  }
  if (cur.type === 'number') {
    return field('number');
  }
  if (cur.type === 'boolean') {
    return field('checkbox');
  }
  if (cur.type === 'date') {
    return field('date');
  }
  if (cur.type === 'picklist' || cur.type === 'enum') {
    return field('select', { options: optionsOf(cur) });
  }
  if (cur.type === 'array') {
    const list = listOf(cur.item, toConfig);
    if (list) {
      return field(list.type, list.config);
    }
  }
  if (isObjectSchema(cur)) {
    return field('object', { fields: toConfig(cur) });
  }
  return field('text');
}
