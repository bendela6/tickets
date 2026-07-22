import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { defineForm, defineRegistry, Form } from '../index';
import type { FieldWrapperProps, InputProps, LayoutComponentProps } from '../types/registry';

const Stub = (p: InputProps<Record<string, never>, string>) => {
  return (
    <input
      data-testid={p.name}
      value={p.value ?? ''}
      onChange={(e) => p.onChange(e.target.value)}
    />
  );
};

interface PanelProps {
  variant?: 'default' | 'danger';
}

function Panel({ props, children }: LayoutComponentProps<PanelProps>) {
  const variant = props.variant ?? 'default';
  return <div data-testid={`panel-${variant}`}>{children}</div>;
}

function FieldStub({ children }: FieldWrapperProps) {
  return <>{children}</>;
}

const formRegistry = defineRegistry({
  inputs: {
    text: { Component: Stub, defaultValue: '' },
  },
  layouts: {
    panel: { Component: Panel },
  },
  field: { Component: FieldStub },
});

describe('defineForm — custom layout kinds via builder', () => {
  test('builder emits a custom layout node for a registered layout kind', () => {
    const config = defineForm(formRegistry).build((b) => {
      return [
        // b.panel is typed and runtime-resolvable via the layout registry.
        b.panel({ variant: 'danger' }, [b.text({ name: 'a', config: {} })]),
      ];
    });
    expect(config.nodes[0]).toMatchObject({
      kind: 'panel',
      props: { variant: 'danger' },
      children: [{ kind: 'field', name: 'a', type: 'text' }],
    });

    // And it renders end-to-end through <Form>.
    render(<Form registry={formRegistry} config={config} />);
    expect(screen.getByTestId('panel-danger')).toBeInTheDocument();
    expect(screen.getByTestId('a')).toBeInTheDocument();
  });

  test('builder still throws for unknown keys not in either registry', () => {
    expect(() => {
      return defineForm(formRegistry).build((b) => {
        return [(b as unknown as { mystery: (o: unknown) => unknown }).mystery({}) as never];
      });
    }).toThrow(/mystery/);
  });
});
