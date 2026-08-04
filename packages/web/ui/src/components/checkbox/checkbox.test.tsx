import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Checkbox } from './checkbox';

const noop = () => {};

test('reports the next boolean, not the change event', async () => {
  const onChange = vi.fn();
  render(<Checkbox label="Show KPI strip" value={false} onChange={onChange} />);
  await userEvent.click(screen.getByLabelText('Show KPI strip'));
  // Two facts, not one: the VALUE arrives first — a caller never reaches into
  // `.target` — and the event rides second, for the call sites that need the
  // modifier keys (the table extends a row range off `shiftKey`).
  expect(onChange).toHaveBeenCalledOnce();
  const [next, event] = onChange.mock.calls[0]!;
  expect(next).toBe(true);
  expect(event).toHaveProperty('target');
});

test('drives checked from value and reports its inverse', async () => {
  const onChange = vi.fn();
  render(<Checkbox label="Show KPI strip" value onChange={onChange} />);
  const input = screen.getByRole('checkbox') as HTMLInputElement;
  expect(input.checked).toBe(true);
  await userEvent.click(input);
  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange.mock.calls[0]![0]).toBe(false);
});

test('read-only emits nothing but stays focusable and undisabled', async () => {
  const onChange = vi.fn();
  render(<Checkbox label="Locked" value onChange={onChange} readOnly />);
  const input = screen.getByRole('checkbox') as HTMLInputElement;

  expect(input).toHaveAttribute('aria-readonly', 'true');
  // `disabled` would be the wrong reach: it drops the tab stop and the value.
  expect(input).not.toBeDisabled();

  // Still in the tab order, and still shows its value.
  await userEvent.tab();
  expect(input).toHaveFocus();

  await userEvent.keyboard(' ');
  await userEvent.click(screen.getByText('Locked'));
  expect(onChange).not.toHaveBeenCalled();
  expect(input.checked).toBe(true);

  // The affordance is what goes: the row stops inviting a click.
  const row = input.closest('label')!;
  expect(row.className).toContain('cursor-default');
  expect(row.className).toContain('pointer-events-none');
  expect(row.className).not.toContain('cursor-pointer');
});

test('an editable checkbox carries no aria-readonly and keeps its cursor', () => {
  render(<Checkbox label="Open" value={false} onChange={noop} />);
  const input = screen.getByRole('checkbox');
  expect(input).not.toHaveAttribute('aria-readonly');
  expect(input.closest('label')!.className).toContain('cursor-pointer');
});

test('renders no label element when label is omitted', () => {
  const { container } = render(<Checkbox aria-label="Select row" value={false} onChange={noop} />);
  // The row holds the mark wrapper and nothing else — an empty span would leave
  // the row's gap as dead space beside the box.
  const row = container.querySelector('label')!;
  expect(row.childElementCount).toBe(1);
  expect(row.textContent).toBe('');
  // Named from outside, so it is still an addressable checkbox.
  expect(screen.getByRole('checkbox', { name: 'Select row' })).toBeInTheDocument();
});

test('renders the label span when one is given', () => {
  const { container } = render(<Checkbox label="Directional" value={false} onChange={noop} />);
  const row = container.querySelector('label')!;
  expect(row.childElementCount).toBe(2);
  expect(row.textContent).toBe('Directional');
});

test('keeps the accent fill class and has no conflicting bg-image (twMerge regression)', () => {
  const { container } = render(<Checkbox label="On" value onChange={noop} />);
  const input = screen.getByRole('checkbox');
  expect(input.className).toContain('checked:bg-indigo-9');
  expect(input.className).not.toContain('bg-[url');
  // Checkmark is an overlay <svg> toggled by peer-checked, never a bg-image.
  const overlay = container.querySelector('svg.peer-checked\\:block');
  expect(overlay).not.toBeNull();
  expect(container.innerHTML).not.toContain('bg-[url');
});

test('reflects the indeterminate prop onto the DOM node and keeps the accent fill', () => {
  const { rerender } = render(
    <Checkbox label="Mixed" value={false} onChange={noop} indeterminate />,
  );
  const input = screen.getByRole('checkbox') as HTMLInputElement;
  // No attribute exists for it — only the IDL property, set from an effect.
  expect(input.indeterminate).toBe(true);
  expect(input.className).toContain('indeterminate:bg-indigo-9');

  // It rides on top of the value rather than being one of its states: the box
  // is half-checked while the value stays false.
  expect(input.checked).toBe(false);

  rerender(<Checkbox label="Mixed" value={false} onChange={noop} />);
  expect(input.indeterminate).toBe(false);
});

test('input keeps size-16 and shrink-0 so it never collapses as a flex item', () => {
  // Without shrink-0 the 16px input is squished to ~9px wide inside the
  // inline-flex wrapper (jsdom has no layout, so we guard the classes).
  render(<Checkbox label="Sized" value={false} onChange={noop} />);
  const input = screen.getByRole('checkbox');
  expect(input.className).toContain('size-16');
  expect(input.className).toContain('shrink-0');
});
