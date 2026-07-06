import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Checkbox } from './checkbox';

test('toggles via label click', async () => {
  const onChange = vi.fn();
  render(<Checkbox label="Show KPI strip" onChange={onChange} />);
  await userEvent.click(screen.getByLabelText('Show KPI strip'));
  expect(onChange).toHaveBeenCalledOnce();
});

test('keeps the accent fill class and has no conflicting bg-image (twMerge regression)', () => {
  const { container } = render(<Checkbox label="On" defaultChecked />);
  const input = screen.getByRole('checkbox');
  expect(input.className).toContain('checked:bg-accent');
  expect(input.className).not.toContain('bg-[url');
  // Checkmark is an overlay <svg> toggled by peer-checked, never a bg-image.
  const overlay = container.querySelector('svg.peer-checked\\:block');
  expect(overlay).not.toBeNull();
  expect(container.innerHTML).not.toContain('bg-[url');
});

test('reflects the indeterminate prop onto the DOM node and keeps the accent fill', () => {
  render(<Checkbox label="Mixed" indeterminate />);
  const input = screen.getByRole('checkbox') as HTMLInputElement;
  expect(input.indeterminate).toBe(true);
  expect(input.className).toContain('indeterminate:bg-accent');
});
