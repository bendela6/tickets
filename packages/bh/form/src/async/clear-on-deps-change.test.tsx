/// <reference types="@testing-library/jest-dom/vitest" />
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { defineRegistry } from '../builder/define-registry';
import { Form } from '../runtime/Form';
import type { FieldWrapperProps, InputProps } from '../types/registry';
import { noInputs, noLayouts } from '../builder/registries';

function TextInput(p: InputProps<{ options?: string[] }, string>) {
  return (
    <input
      data-testid={p.name}
      data-options={(p.config.options ?? []).join(',')}
      value={p.value}
      onChange={(event) => p.onChange(event.target.value)}
    />
  );
}

function Field({ children }: FieldWrapperProps) {
  return <div>{children}</div>;
}

const registry = defineRegistry({
  inputs: noInputs.register({ text: { Component: TextInput, defaultValue: '' } }),
  layouts: noLayouts,
  field: { Component: Field },
});

const CITIES: Record<string, string[]> = { north: ['Bergen', 'Oulu'], south: ['Rome'] };

const config = {
  nodes: [
    { kind: 'field' as const, name: 'region', type: 'text' as const, config: {} },
    {
      kind: 'field' as const,
      name: 'city',
      type: 'text' as const,
      config: {
        options: {
          dependsOn: ['region'],
          fn: ({ region }: Record<string, unknown>) => {
            return Promise.resolve(CITIES[String(region)] ?? []);
          },
        },
      },
    },
  ],
};

describe('a field whose config is loaded from other fields', () => {
  test('keeps the value it starts with, as a stored record has it', async () => {
    render(
      <Form
        registry={registry}
        form={config}
        defaultValues={{ region: 'north', city: 'Bergen' }}
        onSubmit={vi.fn()}
      />,
    );
    await vi.waitFor(() => {
      expect(screen.getByTestId('city')).toHaveAttribute('data-options', 'Bergen,Oulu');
    });
    expect(screen.getByTestId('city')).toHaveValue('Bergen');
  });

  test('goes back to empty when a field it reads changes', async () => {
    render(
      <Form
        registry={registry}
        form={config}
        defaultValues={{ region: 'north', city: 'Bergen' }}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('region'), { target: { value: 'south' } });
    await vi.waitFor(() => {
      expect(screen.getByTestId('city')).toHaveAttribute('data-options', 'Rome');
    });
    expect(screen.getByTestId('city')).toHaveValue('');
  });
});

describe('a field hidden while what it reads changes', () => {
  test('comes back empty', async () => {
    const hidden = {
      nodes: [config.nodes[0], { ...config.nodes[1], when: { field: 'region', truthy: true } }],
    };
    render(
      <Form
        registry={registry}
        form={hidden as typeof config}
        defaultValues={{ region: 'north', city: 'Bergen' }}
        onSubmit={vi.fn()}
      />,
    );
    const region = screen.getByTestId('region');
    fireEvent.change(region, { target: { value: '' } });
    await vi.waitFor(() => expect(screen.queryByTestId('city')).not.toBeInTheDocument());
    fireEvent.change(region, { target: { value: 'south' } });
    await vi.waitFor(() => {
      expect(screen.getByTestId('city')).toHaveAttribute('data-options', 'Rome');
    });
    expect(screen.getByTestId('city')).toHaveValue('');
  });
});
