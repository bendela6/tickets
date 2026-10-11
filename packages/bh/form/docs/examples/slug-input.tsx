import { defineForm, defineRegistry, Form, FormProvider, type InputProps } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, Input, RootWrapper } from '@bh/ui';

interface SlugConfig {
  /** Shown before the field, as the address it ends. */
  prefix?: string;
}

/** Text kept to lowercase letters, digits and dashes, as typed. */
function SlugField(p: InputProps<SlugConfig, string>) {
  return (
    <div className="flex items-center gap-8">
      {p.config.prefix ? (
        <span className="text-13/19 text-gray-11 font-mono">{p.config.prefix}</span>
      ) : null}
      <Input
        // The field's label is for `name`; its help or problem has `describedBy`.
        id={p.name}
        aria-describedby={p.describedBy}
        name={p.name}
        value={p.value ?? ''}
        onChange={(next) => p.onChange(next.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}
        onBlur={p.onBlur}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        className="font-mono"
      />
    </div>
  );
}

const registry = defineRegistry({
  inputs: { ...baseInputs, slug: { Component: SlugField, defaultValue: '' } },
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const post = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'title',
      label: 'Title',
      config: {},
    }),
    b.slug({
      name: 'slug',
      label: 'Address',
      config: { prefix: 'example.com/' },
    }),
  ];
});

export function SlugInput() {
  return (
    <FormProvider registry={registry}>
      <div className="w-full max-w-400">
        <Form form={post} />
      </div>
    </FormProvider>
  );
}
