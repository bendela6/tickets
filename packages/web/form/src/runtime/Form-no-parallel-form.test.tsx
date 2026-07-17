import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Form } from './Form';
import { useStandaloneForm } from './use-standalone-form';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';
import type * as UseFormModule from './use-form';

// Verifies the structural fix: when `formApi` is supplied, `<Form>` must not
// build its own parallel tanstack form via an inline `useForm` call. The
// public `Form` discriminator picks a leaf component, and only the inline
// leaf builds a tanstack form. In api-mode the only `useForm` invocation
// should be the one inside `useStandaloneForm`.
//
// We spy on our own `./use-form` wrapper rather than `@tanstack/react-form`
// because the tanstack ESM namespace is non-configurable and can't be
// `vi.spyOn`-ed. Every call to our wrapper corresponds 1:1 with a call to
// the underlying `useTanstackForm`, so this count is a reliable proxy.
//
// `vi.mock` is hoisted; we use the factory form to wrap the real module and
// add a spy on the wrapped `useForm` export.
vi.mock('./use-form', async (importOriginal) => {
  const actual = await importOriginal<typeof UseFormModule>();
  return {
    ...actual,
    useForm: vi.fn(actual.useForm),
  };
});

// Pulled in after the mock is registered so the spy reference is the same
// instance the production code will see.
import { useForm as wrappedUseForm } from './use-form';
const useFormSpy = wrappedUseForm as unknown as ReturnType<typeof vi.fn>;

const TextInput = (p: InputProps<Record<string, never>, string>) => {
  return <input data-testid={p.name} value={p.value ?? ''} onChange={() => {}} />;
};

function FieldStub({ children }: FieldWrapperProps) {
  return <>{children}</>;
}

const registry = defineRegistry({
  inputs: {
    text: { Component: TextInput, defaultValue: '' },
  },
  layouts: {},
  field: { Component: FieldStub },
});

describe('<Form formApi> does not build a parallel form', () => {
  test('useForm is invoked once when formApi is supplied', () => {
    useFormSpy.mockClear();
    function Page() {
      const api = useStandaloneForm({
        config: {
          nodes: [{ kind: 'field', name: 'a', type: 'text', defaultValue: '', config: {} }],
        },
      });
      return (
        <Form
          formApi={api}
          registry={registry}
          config={{
            nodes: [{ kind: 'field', name: 'a', type: 'text', defaultValue: '', config: {} }],
          }}
        />
      );
    }
    render(<Page />);
    // Once for useStandaloneForm's internal useForm call. Not twice — the
    // <Form> discriminator must route to FormWithApi, which does not call
    // useForm at all.
    expect(useFormSpy).toHaveBeenCalledTimes(1);
  });

  test('inline mode invokes useForm once', () => {
    useFormSpy.mockClear();
    render(
      <Form
        registry={registry}
        config={{
          nodes: [{ kind: 'field', name: 'a', type: 'text', defaultValue: '', config: {} }],
        }}
      />,
    );
    expect(useFormSpy).toHaveBeenCalledTimes(1);
  });
});
