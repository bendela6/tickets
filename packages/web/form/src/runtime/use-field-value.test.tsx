import { describe, expect, test } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { FormContext } from './form-context';
import { useFieldValue } from './use-field-value';
import { useForm } from './use-form';
import type { InputRegistry } from '../types/registry';

type R = InputRegistry;

function FieldValueDisplay({ name }: { name: string }) {
  const v = useFieldValue<string>(name);
  return <span data-testid="value">{String(v)}</span>;
}

function Harness() {
  const { form, setFieldValue } = useForm<R>({
    config: {
      nodes: [{ kind: 'field', name: 'a', type: 'text', defaultValue: 'first', config: {} }],
    },
  });
  return (
    <FormContext.Provider value={form}>
      <FieldValueDisplay name="a" />
      <button onClick={() => setFieldValue('a', 'second')}>set</button>
    </FormContext.Provider>
  );
}

describe('useFieldValue', () => {
  test('returns current value and re-renders on update', () => {
    render(<Harness />);
    expect(screen.getByTestId('value').textContent).toBe('first');
    act(() => {
      screen.getByText('set').click();
    });
    expect(screen.getByTestId('value').textContent).toBe('second');
  });

  test('throws when used outside <Form>', () => {
    expect(() => render(<FieldValueDisplay name="a" />)).toThrow(
      /useFieldValue must be used inside <Form>/,
    );
  });
});
