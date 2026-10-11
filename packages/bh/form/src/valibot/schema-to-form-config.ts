import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { FormConfig } from '../types/form-config';
import type { FieldNode } from '../types/field-node';
import type { InputRegistry } from '../types/registry';
import { inferField, isObjectSchema } from './infer-input';

/**
 * A form from a valibot object schema: a field per entry, its input inferred
 * from the entry's type and the entry itself as its `validate`. `overrides`
 * set a field's `label`, `description`, `type` or `config` by name, over
 * what is inferred. Its nodes are fields only.
 */
export function schemaToFormConfig<R extends InputRegistry = InputRegistry>(
  schema: unknown,
  overrides: Record<
    string,
    Partial<{
      label: string;
      description: string;
      type: string;
      config: Record<string, unknown>;
    }>
  > = {},
): Omit<FormConfig<R>, 'nodes'> & { nodes: FieldNode<R>[] } {
  const s = schema as { type?: unknown; entries?: unknown } | null | undefined;
  if (!isObjectSchema(s)) {
    throw new Error('schemaToFormConfig: expected a valibot ObjectSchema');
  }
  const nodes: FieldNode<R>[] = [];
  for (const [name, entry] of Object.entries(s.entries)) {
    // A nested object, or each item of a list of them, is a form of its own;
    // overrides name the outer form's fields only.
    const inferred = inferField(entry as never, (inner) => schemaToFormConfig(inner));
    const o = overrides[name] ?? {};
    nodes.push({
      kind: 'field',
      name,
      type: o.type ?? inferred.type,
      label: o.label ?? inferred.label,
      description: o.description ?? inferred.description,
      required: inferred.required,
      config: { ...inferred.config, ...(o.config ?? {}) },
      // Each entry is itself a standard-schema (valibot schemas implement the
      // spec). Attaching it as the field's `validate` gives the consumer
      // per-field validation for free without writing duplicate schema code.
      validate: entry as StandardSchemaV1,
    } as FieldNode<R>);
  }
  return { nodes };
}
