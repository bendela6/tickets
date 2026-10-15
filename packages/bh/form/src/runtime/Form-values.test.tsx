/// <reference types="@testing-library/jest-dom/vitest" />
import { useState, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Form } from './Form';
import { useStandaloneForm } from './use-standalone-form';
import { defineRegistry } from '../builder/define-registry';
import { defineForm } from '../builder/define-form';
import type { FieldWrapperProps, InputProps } from '../types/registry';

// Commits at once.
const TextInput = (p: InputProps<object, string>) => {
  return (
    <input aria-label={p.name} value={p.value ?? ''} onChange={(e) => p.onChange(e.target.value)} />
  );
};

// Holds a draft while typed in, and commits it on leaving, as `commit: 'leave'` does.
function DraftInput(p: InputProps<object, string>) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={p.name}
      value={draft ?? p.value ?? ''}
      onChange={(e) => {
        setDraft(e.target.value);
        p.onDraft?.(e.target.value);
      }}
      onBlur={() => {
        if (draft !== null) {
          p.onChange(draft);
          setDraft(null);
        }
      }}
    />
  );
}

function FieldStub({ children }: FieldWrapperProps) {
  return <>{children}</>;
}

const registry = defineRegistry({
  inputs: {
    text: { Component: TextInput, defaultValue: '' },
    draft: { Component: DraftInput, defaultValue: '' },
  },
  layouts: {},
  field: { Component: FieldStub },
});

const form = defineForm(registry).build((b) => {
  return [
    b.text({ name: 'status', config: {} }),
    b.draft({ name: 'search', config: {} }),
    b.reset({ label: 'Reset' }),
  ];
});

const input = (name: string): HTMLInputElement => screen.getByLabelText(name);

describe('<Form values>', () => {
  test('starts at the values, apart from where it started, without running onCommit', () => {
    const onCommit = vi.fn();
    render(
      <Form
        registry={registry}
        form={form}
        defaultValues={{ status: '', search: '' }}
        values={{ status: 'open', search: 'login' }}
        onCommit={onCommit}
      />,
    );
    expect(input('status').value).toBe('open');
    expect(input('search').value).toBe('login');
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('follows new values without a remount and without running onCommit', () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <Form registry={registry} form={form} values={{ status: 'open' }} onCommit={onCommit} />,
    );
    const before = input('status');
    rerender(
      <Form registry={registry} form={form} values={{ status: 'closed' }} onCommit={onCommit} />,
    );
    expect(input('status')).toBe(before);
    expect(before.value).toBe('closed');
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('takes the same value handed back, a new object, as no change', () => {
    const { rerender } = render(
      <Form registry={registry} form={form} values={{ status: 'open' }} onCommit={vi.fn()} />,
    );
    fireEvent.change(input('status'), { target: { value: 'mine' } });
    rerender(
      <Form registry={registry} form={form} values={{ status: 'open' }} onCommit={vi.fn()} />,
    );
    expect(input('status').value).toBe('mine');
  });

  test('a field being typed in keeps its draft, while the others follow', () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <Form
        registry={registry}
        form={form}
        values={{ status: 'open', search: '' }}
        onCommit={onCommit}
      />,
    );
    fireEvent.change(input('search'), { target: { value: 'log' } });
    rerender(
      <Form
        registry={registry}
        form={form}
        values={{ status: 'closed', search: 'from the address' }}
        onCommit={onCommit}
      />,
    );
    expect(input('status').value).toBe('closed');
    expect(input('search').value).toBe('log');
    fireEvent.blur(input('search'));
    expect(onCommit).toHaveBeenCalledWith(
      { field: 'search', value: 'log', previous: '' },
      { status: 'closed', search: 'log' },
    );
  });

  test('a reset still goes to where the form started', () => {
    render(
      <Form
        registry={registry}
        form={form}
        defaultValues={{ status: 'any', search: '' }}
        values={{ status: 'open', search: 'login' }}
        onCommit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(input('status').value).toBe('any');
    expect(input('search').value).toBe('');
  });

  test('useStandaloneForm follows values too', () => {
    function Held(props: { values: Record<string, unknown> }): ReactNode {
      const formApi = useStandaloneForm({ form, registry, values: props.values });
      return <Form registry={registry} formApi={formApi} />;
    }
    const { rerender } = render(<Held values={{ status: 'open' }} />);
    expect(input('status').value).toBe('open');
    rerender(<Held values={{ status: 'closed' }} />);
    expect(input('status').value).toBe('closed');
  });
});
