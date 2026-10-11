import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const profile = defineForm(registry).build((b) => {
  return [
    b.card({ title: 'Profile', description: 'How others see you.' }, [
      b.row({}, [
        b.text({
          name: 'first',
          label: 'First name',
          config: {},
        }),
        b.text({
          name: 'last',
          label: 'Last name',
          config: {},
        }),
      ]),
      b.select({
        name: 'language',
        label: 'Language',
        defaultValue: 'en',
        config: {
          options: [
            { value: 'en', label: 'English' },
            { value: 'fr', label: 'French' },
            { value: 'ka', label: 'Georgian' },
          ],
        },
      }),
      b.group({ title: 'Notifications' }, [
        b.toggle({
          name: 'digest',
          label: 'Weekly digest',
          config: { label: 'Weekly digest' },
        }),
        b.checkbox({
          name: 'mentions',
          label: 'Mentions',
          config: { label: 'Email me when someone mentions me' },
        }),
      ]),
    ]),
  ];
});

export function Layouts() {
  return (
    <FormProvider registry={registry}>
      <div className="w-full max-w-560">
        <Form form={profile} />
      </div>
    </FormProvider>
  );
}
