import { defineForm, defineRegistry, Form, FormProvider, useFieldValue } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const card = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'name',
      label: 'Name',
      config: {},
    }),
    b.textarea({
      name: 'bio',
      label: 'Bio',
      config: { rows: 3 },
    }),
  ];
});

// Drawn inside <Form>, so it can read the values as they change.
function Preview() {
  const name = useFieldValue<string>('name');
  const bio = useFieldValue<string>('bio');
  return (
    <p className="text-12/17 text-gray-11 mt-12 font-sans">
      Hello, {name || 'stranger'}. Your bio is {bio.length} of 160 characters.
    </p>
  );
}

export function ReadingAValue() {
  return (
    <FormProvider registry={registry}>
      <div className="w-full max-w-360">
        <Form form={card}>
          <Preview />
        </Form>
      </div>
    </FormProvider>
  );
}
