/// <reference types="@testing-library/jest-dom/vitest" />
import type { EntriesOf } from '@bh/registry';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Form } from './Form';
import { FormProvider } from './form-provider';
import { useStandaloneForm } from './use-standalone-form';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';
import type { FormConfig } from '../types/form-config';
import { noInputs, noLayouts } from '../builder/registries';

function inputOf(mark: string) {
  return function TextInput(p: InputProps<Record<string, never>, string>) {
    return (
      <input
        data-testid={`${mark}-${p.name}`}
        value={p.value ?? ''}
        onChange={(e) => p.onChange(e.target.value)}
      />
    );
  };
}

function FieldStub({ children }: FieldWrapperProps) {
  return <>{children}</>;
}

const registryOf = (mark: string) => {
  return defineRegistry({
    inputs: noInputs.register({ text: { Component: inputOf(mark), defaultValue: '' } }),
    layouts: noLayouts,
    field: { Component: FieldStub },
  });
};

const provided = registryOf('provided');
const own = registryOf('own');

const config: FormConfig<EntriesOf<typeof provided.inputs>> = {
  nodes: [{ kind: 'field', name: 'title', type: 'text', defaultValue: '', config: {} }],
};

describe('<FormProvider>', () => {
  test('gives a form with no registry of its own the one it supplies', async () => {
    const onSubmit = vi.fn();
    render(
      <FormProvider registry={provided}>
        <Form form={config} onSubmit={onSubmit}>
          <button type="submit">Save</button>
        </Form>
      </FormProvider>,
    );
    fireEvent.change(screen.getByTestId('provided-title'), { target: { value: 'Draft' } });
    fireEvent.click(screen.getByText('Save'));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ title: 'Draft' }));
  });

  test("lets a form's own registry win over the one it supplies", () => {
    render(
      <FormProvider registry={provided}>
        <Form form={config} registry={own} />
      </FormProvider>,
    );
    expect(screen.getByTestId('own-title')).toBeInTheDocument();
    expect(screen.queryByTestId('provided-title')).toBeNull();
  });

  test('supplies useStandaloneForm too', async () => {
    const onSubmit = vi.fn();
    function Page() {
      const api = useStandaloneForm({ form: config, onSubmit });
      return (
        <>
          <Form formApi={api} />
          <button type="button" onClick={() => void api.submit()}>
            Save
          </button>
        </>
      );
    }
    render(
      <FormProvider registry={provided}>
        <Page />
      </FormProvider>,
    );
    fireEvent.change(screen.getByTestId('provided-title'), { target: { value: 'Kept' } });
    fireEvent.click(screen.getByText('Save'));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ title: 'Kept' }));
  });

  test('says how to fix a form with no registry anywhere', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Form form={config} />)).toThrow(
      '<Form> has no registry: wrap the app in <FormProvider registry={registry}>, or give it one',
    );
    quiet.mockRestore();
  });
});
