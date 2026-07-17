import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { FormConfig } from '../types/form-config';
import type { LayoutNode } from '../types/layout-node';
import type { InputRegistry } from '../types/registry';
import { inferField } from './infer-input';

interface ObjectSchemaShape {
  type: 'object';
  entries: Record<string, unknown>;
}

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
): FormConfig<R> {
  const s = schema as ObjectSchemaShape | null | undefined;
  if (s?.type !== 'object' || !s.entries) {
    throw new Error('schemaToFormConfig: expected a valibot ObjectSchema');
  }
  const nodes: LayoutNode<R>[] = [];
  for (const [name, entry] of Object.entries(s.entries)) {
    const inferred = inferField(entry as never);
    const o = overrides[name] ?? {};
    nodes.push({
      kind: 'field',
      name,
      type: o.type ?? inferred.type,
      label: o.label,
      description: o.description,
      required: inferred.required,
      config: { ...inferred.config, ...(o.config ?? {}) },
      // Each entry is itself a standard-schema (valibot schemas implement the
      // spec). Attaching it as the field's `validate` gives the consumer
      // per-field validation for free without writing duplicate schema code.
      validate: entry as StandardSchemaV1,
    } as LayoutNode<R>);
  }
  return { nodes };
}
