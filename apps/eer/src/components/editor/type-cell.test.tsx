import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TypeCell } from './type-cell';

afterEach(cleanup);

describe('TypeCell', () => {
  it('selects the base type and emits it', () => {
    const onChange = vi.fn();
    render(<TypeCell value="int" onChange={onChange} />);
    const select = screen.getByLabelText('type');
    expect(select).toHaveValue('int');
    fireEvent.change(select, { target: { value: 'text' } });
    expect(onChange).toHaveBeenCalledWith('text');
  });

  it('shows one param input for varchar and emits varchar(n)', () => {
    const onChange = vi.fn();
    render(<TypeCell value="varchar(255)" onChange={onChange} />);
    expect(screen.getByLabelText('type')).toHaveValue('varchar');
    const p1 = screen.getByLabelText('type parameter 1');
    expect(p1).toHaveValue('255');
    fireEvent.change(p1, { target: { value: '64' } });
    expect(onChange).toHaveBeenCalledWith('varchar(64)');
  });

  it('shows two param inputs for numeric', () => {
    const onChange = vi.fn();
    render(<TypeCell value="numeric(10,2)" onChange={onChange} />);
    expect(screen.getByLabelText('type parameter 1')).toHaveValue('10');
    expect(screen.getByLabelText('type parameter 2')).toHaveValue('2');
    fireEvent.change(screen.getByLabelText('type parameter 2'), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith('numeric(10,4)');
  });

  it('falls back to a custom text input for an unknown type', () => {
    const onChange = vi.fn();
    render(<TypeCell value="citext" onChange={onChange} />);
    expect(screen.getByLabelText('type')).toHaveValue('__custom__');
    const custom = screen.getByLabelText('custom type');
    expect(custom).toHaveValue('citext');
    fireEvent.change(custom, { target: { value: 'my_enum' } });
    expect(onChange).toHaveBeenCalledWith('my_enum');
  });

  it('switching to custom keeps editing free-form', () => {
    const onChange = vi.fn();
    render(<TypeCell value="int" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('type'), { target: { value: '__custom__' } });
    expect(screen.getByLabelText('custom type')).toBeInTheDocument();
  });
});
