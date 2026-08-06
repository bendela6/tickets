import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Combobox } from '../../components/combobox';
import { DatePicker } from '../../components/date-picker';
import { Input } from '../../components/input';
import { MultiCombobox } from '../../components/multi-combobox';
import { NumberInput } from '../../components/number-input';
import { Textarea } from '../../components/textarea';

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];

// Every field control has to be disable-able, and has to *look* disabled when
// it is. Input and Textarea get it through native prop spreading rather than a
// declared prop, which is easy to break silently by tightening their prop
// types — this pins the behaviour rather than the mechanism.
describe('every field control can be disabled', () => {
  it('Input and Textarea disable natively', () => {
    const { rerender } = render(<Input disabled aria-label="a"  value="" onChange={() => {}} />);
    expect(screen.getByLabelText('a')).toBeDisabled();
    rerender(<Textarea disabled aria-label="b"  value="" onChange={() => {}} />);
    expect(screen.getByLabelText('b')).toBeDisabled();
  });

  it('the trigger-style controls disable their trigger', () => {
    const { rerender, container } = render(
      <Combobox options={options} value={null} onChange={() => {}} disabled />,
    );
    expect(container.querySelector('button')).toBeDisabled();

    rerender(<DatePicker value={null} onChange={() => {}} disabled />);
    expect(container.querySelector('button')).toBeDisabled();
  });

  it('the composite controls block interaction while disabled', () => {
    // These wrap several focusables, so the shell drops pointer events rather
    // than each child carrying `disabled`.
    const { container, rerender } = render(
      <MultiCombobox options={options} value={['a']} onChange={() => {}} disabled />,
    );
    expect(container.firstElementChild!.className).toContain('pointer-events-none');
    // …and the clear affordance is hidden, not just unclickable.
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();

    rerender(<NumberInput value={1} onChange={() => {}} disabled />);
    expect(container.firstElementChild!.className).toContain('pointer-events-none');
  });

  it('a disabled field takes the muted border and fill, whatever its tone', () => {
    render(<Input disabled tone="danger" aria-label="c"  value="" onChange={() => {}} />);
    const input = screen.getByLabelText('c');
    expect(input.className).toContain('disabled:opacity-45');
    expect(input.className).toContain('disabled:text-gray-9');
  });
});
