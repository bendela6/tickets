import { defineRegistry, Form } from '@bh/form';
import { schemaToFormConfig } from '@bh/form/valibot';
import { fireEvent, render, screen } from '@testing-library/react';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { FieldWrapper } from '../../components/field-wrapper';
import { baseInputs, baseLayouts } from '../../registry';
import { EmailField } from './email-field';

const base = { name: 'email', loading: false, onBlur: vi.fn(), config: {} };

describe('EmailField', () => {
  it('is a text box for an address, which the browser can fill in', () => {
    render(<EmailField {...base} value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
    expect(input).toHaveAttribute('id', 'email');
  });

  it('reports what is typed', () => {
    const onChange = vi.fn();
    render(<EmailField {...base} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a@b.co' } });
    expect(onChange).toHaveBeenCalledWith('a@b.co');
  });

  it('is what a schema’s v.email() draws, checked by the schema', async () => {
    const registry = defineRegistry({
      inputs: baseInputs,
      layouts: baseLayouts,
      field: { Component: FieldWrapper },
    });
    const config = schemaToFormConfig<typeof baseInputs>(
      v.object({ email: v.pipe(v.string(), v.title('Email'), v.email('That is not an email.')) }),
    );
    render(
      <Form registry={registry} form={config} onSubmit={vi.fn()}>
        <button type="submit">Send</button>
      </Form>,
    );
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That is not an email.');
  });
});
