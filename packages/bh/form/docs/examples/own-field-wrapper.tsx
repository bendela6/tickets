import {
  defineForm,
  defineRegistry,
  Form,
  FormProvider,
  type FieldWrapperProps,
  type RootWrapperProps,
} from '@bh/form';
import { baseInputs } from '@bh/ui';

// The label above, a dot for required, and the problem in place of the help.
// The two lines take the ids the input is described by.
function CompactField({
  name,
  label,
  description,
  required,
  error,
  descriptionId,
  errorId,
  children,
}: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-4">
      {label ? (
        <label htmlFor={name} className="text-13/19 font-500 text-gray-12 font-sans">
          {label}
          {required ? <span className="text-indigo-11"> •</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-12/17 text-red-11 font-sans">
          {error}
        </p>
      ) : description ? (
        <p id={descriptionId} className="text-12/17 text-gray-11 font-sans">
          {description}
        </p>
      ) : null}
    </div>
  );
}

// The space between fields: without a root, they are drawn with none.
function Stacked({ children }: RootWrapperProps) {
  return <div className="flex flex-col gap-16">{children}</div>;
}

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: {},
  field: { Component: CompactField },
  root: { Component: Stacked },
});

const note = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'title',
      label: 'Title',
      required: true,
      config: {},
    }),
    b.textarea({
      name: 'body',
      label: 'Note',
      description: 'Plain text; line breaks are kept.',
      config: { rows: 3 },
    }),
  ];
});

export function OwnFieldWrapper() {
  return (
    <FormProvider registry={registry}>
      <div className="w-full max-w-360">
        <Form form={note} />
      </div>
    </FormProvider>
  );
}
