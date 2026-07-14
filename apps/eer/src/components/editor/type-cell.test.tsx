import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TypeCell } from './type-cell';

afterEach(cleanup);

// The real app feeds the just-emitted value back in as the `value` prop on
// every keystroke (the grid re-renders the cell from its own state). This
// wrapper reproduces that loop so tests can exercise the resync effect the
// same way the real app does, instead of only ever seeing a static `value`.
function ControlledTypeCell({ initial, onEmit }: { initial: string; onEmit?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <TypeCell
      value={value}
      onChange={(v) => {
        setValue(v);
        onEmit?.(v);
      }}
    />
  );
}

describe('TypeCell', () => {
  it('selects the base type and emits it', () => {
    const onChange = vi.fn();
    render(<TypeCell value="integer" onChange={onChange} />);
    const select = screen.getByLabelText('type');
    expect(select).toHaveValue('integer');
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

  it('stays in custom mode when the typed text transiently equals a catalogue type name', () => {
    // Start already in custom mode (an unknown base) and type a value that
    // collides exactly with a catalogue name. The real app echoes each
    // keystroke back as the `value` prop, which is what ControlledTypeCell
    // simulates.
    render(<ControlledTypeCell initial="citext" />);
    const custom = screen.getByLabelText('custom type');
    fireEvent.change(custom, { target: { value: 'jsonb' } }); // collides with a real catalogue type

    expect(screen.getByLabelText('custom type')).toBeInTheDocument();
    expect(screen.getByLabelText('type')).toHaveValue('__custom__');
  });

  it('types jsonb_data through the jsonb collision without unmounting the custom input', () => {
    const emitted: string[] = [];
    render(<ControlledTypeCell initial="" onEmit={(v) => emitted.push(v)} />);

    const target = 'jsonb_data';
    for (let i = 1; i <= target.length; i++) {
      const partial = target.slice(0, i);
      const custom = screen.getByLabelText('custom type'); // must still be mounted every keystroke
      fireEvent.change(custom, { target: { value: partial } });
    }

    expect(screen.getByLabelText('custom type')).toBeInTheDocument();
    expect(screen.getByLabelText('custom type')).toHaveValue('jsonb_data');
    expect(screen.getByLabelText('type')).toHaveValue('__custom__');
    expect(emitted.at(-1)).toBe('jsonb_data');
  });

  it('does not discard the typed text when re-picking custom… after the jsonb collision', () => {
    const emitted: string[] = [];
    render(<ControlledTypeCell initial="" onEmit={(v) => emitted.push(v)} />);

    const target = 'jsonb_data';
    for (let i = 1; i <= target.length; i++) {
      fireEvent.change(screen.getByLabelText('custom type'), { target: { value: target.slice(0, i) } });
    }

    expect(emitted).not.toContain('');
  });

  it('explicitly picking a catalogue type from the select exits custom mode', () => {
    render(<ControlledTypeCell initial="citext" />);
    expect(screen.getByLabelText('custom type')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'integer' } });

    expect(screen.queryByLabelText('custom type')).not.toBeInTheDocument();
    expect(screen.getByLabelText('type')).toHaveValue('integer');
  });

  it('resyncs out of custom mode when the value prop changes externally (grid reuses the row)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<TypeCell value="citext" onChange={onChange} />);
    expect(screen.getByLabelText('custom type')).toBeInTheDocument();

    // The grid reuses this cell for a different column; TypeCell never emitted
    // "integer" itself, so this must resync even though customMode was true.
    rerender(<TypeCell value="integer" onChange={onChange} />);

    expect(screen.queryByLabelText('custom type')).not.toBeInTheDocument();
    expect(screen.getByLabelText('type')).toHaveValue('integer');
  });
});
