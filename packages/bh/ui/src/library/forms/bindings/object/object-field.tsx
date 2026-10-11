import { NestedFields, type FormConfig, type InputProps, type InputRegistry } from '@bh/form';

export interface ObjectFieldConfig {
  /** Its fields. `schemaToFormConfig` builds them for a nested object. */
  fields: FormConfig<InputRegistry>;
}

type Value = Record<string, unknown>;

/**
 * One object inside a form, its fields set in a box of their own: a size's
 * width and height, an address's lines. Drawn with the form's own registry.
 */
export function ObjectField(p: InputProps<ObjectFieldConfig, Value | null>) {
  const value = p.value && typeof p.value === 'object' ? p.value : {};
  return (
    <div
      id={p.name}
      className="rounded-8 border-gray-6 flex flex-col gap-10 border-1 p-12"
      onBlur={p.onBlur}
    >
      <NestedFields
        name={p.name}
        nodes={p.config.fields.nodes}
        value={value}
        disabled={p.disabled}
        onChange={p.onChange}
      />
    </div>
  );
}
