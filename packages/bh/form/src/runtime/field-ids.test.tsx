/// <reference types="@testing-library/jest-dom/vitest" />
import { fireEvent, render, screen } from '@testing-library/react';
import * as v from 'valibot';
import { describe, expect, test, vi } from 'vitest';
import { defineRegistry } from '../builder/define-registry';
import type { FieldWrapperProps, InputProps } from '../types/registry';
import { fieldIds } from './field-ids';
import { Form } from './Form';
import { noInputs, noLayouts } from '../builder/registries';

function TextInput(p: InputProps<object, string>) {
  return (
    <input
      id={p.name}
      aria-describedby={p.describedBy}
      value={p.value}
      onChange={(event) => p.onChange(event.target.value)}
      onBlur={p.onBlur}
    />
  );
}

function Field({ description, error, descriptionId, errorId, children }: FieldWrapperProps) {
  return (
    <div>
      {children}
      {description && !error ? <p id={descriptionId}>{description}</p> : null}
      {error ? <p id={errorId}>{error}</p> : null}
    </div>
  );
}

const registry = defineRegistry({
  inputs: noInputs.register({ text: { Component: TextInput, defaultValue: '' } }),
  layouts: noLayouts,
  field: { Component: Field },
});

describe('fieldIds', () => {
  test('names the help and the problem after the field, and describes it by one', () => {
    expect(fieldIds('title')).toEqual({
      descriptionId: 'title-description',
      errorId: 'title-error',
      describedBy: undefined,
    });
    expect(fieldIds('title', 'Keep it short.').describedBy).toBe('title-description');
    expect(fieldIds('title', 'Keep it short.', 'Enter a title.').describedBy).toBe('title-error');
  });
});

describe('<Form>', () => {
  test('gives the wrapper the ids, and the input the one that describes it now', async () => {
    render(
      <Form
        registry={registry}
        form={{
          nodes: [
            {
              kind: 'field',
              name: 'title',
              type: 'text',
              description: 'Keep it short.',
              validate: v.pipe(v.string(), v.nonEmpty('Enter a title.')),
              config: {},
            },
          ],
        }}
        onSubmit={vi.fn()}
      >
        <button type="submit">Save</button>
      </Form>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAccessibleDescription('Keep it short.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(input).toHaveAccessibleDescription('Enter a title.'));
  });
});
