import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JsonInput } from './json-input';

const base = { name: 'payload', loading: false, onBlur: vi.fn(), config: {} };

describe('JsonInput', () => {
  // `{` opens a key descriptor in user-event v14 (`{Enter}`), so a literal
  // brace has to be doubled. `'{{'` types one `{`; passing a bare `'{'` throws
  // `Expected key descriptor but found "" in "{"`.
  it('reports the raw text, valid or not', async () => {
    const onChange = vi.fn();
    render(<JsonInput {...base} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), '{{');
    expect(onChange).toHaveBeenLastCalledWith('{');
  });

  it('complains about unparseable JSON', () => {
    render(<JsonInput {...base} value="{ nope" onChange={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toMatch(/^Invalid JSON:/);
  });

  it('accepts valid JSON without complaint', () => {
    render(<JsonInput {...base} value='{"a":1}' onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('treats empty and whitespace-only as unset rather than invalid', () => {
    const { rerender } = render(<JsonInput {...base} value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    rerender(<JsonInput {...base} value="   " onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // The parse error must track external resets, not just typing.
  it('clears the complaint when the value is replaced with valid JSON', () => {
    const { rerender } = render(<JsonInput {...base} value="{ nope" onChange={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<JsonInput {...base} value="[]" onChange={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('defaults to twelve rows and honours an override', () => {
    const { rerender } = render(<JsonInput {...base} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '12');
    rerender(<JsonInput {...base} config={{ rows: 4 }} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4');
  });

  it('turns off spellcheck, which would underline every JSON key', () => {
    render(<JsonInput {...base} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('spellcheck', 'false');
  });
});
