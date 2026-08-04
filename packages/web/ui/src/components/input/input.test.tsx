import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { FieldError } from '../field-error';
import { FieldLabel } from '../field-label';
import { Input } from './input';

test('md input carries the spec size classes', () => {
  render(<Input aria-label="Title" />);
  const input = screen.getByLabelText('Title');
  expect(input).toHaveClass('h-36', 'px-12', 'rounded-lg', 'bg-surface-raised', 'border-gray-7');
  // Regression guard: tailwind-merge must not let the 14px font size evict the
  // ink text color (the same trap the primary button hit with text-13/19).
  expect(input).toHaveClass('text-14');
  expect(input).toHaveClass('text-gray-12');
});

test('sm input overrides height, padding, radius, and font size', () => {
  render(<Input size="sm" aria-label="Estimate" />);
  const input = screen.getByLabelText('Estimate');
  expect(input).toHaveClass('h-28', 'px-9', 'rounded-md', 'text-13');
  expect(input).not.toHaveClass('text-14');
});

test('invalid input shows the danger border and always-on halo', () => {
  render(<Input tone="danger" aria-label="Key" />);
  const input = screen.getByLabelText('Key');
  expect(input).toHaveClass('border-red-9', 'ring-3', 'ring-red-3');
});

test('input associates label and error', () => {
  render(
    <>
      <FieldLabel htmlFor="key" required>
        Key
      </FieldLabel>
      <Input id="key" tone="danger" aria-describedby="key-error" />
      <FieldError id="key-error">Key must be kebab-case</FieldError>
    </>,
  );
  const input = screen.getByLabelText('Key *');
  expect(input).toHaveAccessibleDescription('Key must be kebab-case');
  expect(input).toHaveAttribute('aria-invalid', 'true');
});

test('an adorned input keeps the field chrome on the wrapper, not the inner box', () => {
  // The border has to draw around the adornment too, so it moves outward and
  // the inner input goes bare. Focus still lands on the input, which is why
  // the ring hangs off focus-within on the wrapper.
  const { container } = render(<Input aria-label="Filter" trailing={<kbd>⌘K</kbd>} />);
  const input = screen.getByLabelText('Filter');
  const wrapper = container.firstElementChild!;

  expect(input).not.toHaveClass('border-1');
  expect(wrapper.className).toContain('border-1');
  expect(wrapper.className).toContain('focus-within:');
  expect(wrapper).toContainElement(screen.getByText('⌘K'));
});

test('without an adornment the input is unwrapped, exactly as before', () => {
  // Every existing call site takes this path, so the chrome must stay on the
  // input itself and `className` must still land there.
  const { container } = render(<Input aria-label="Plain" className="w-200" />);
  const input = screen.getByLabelText('Plain');
  expect(container.firstElementChild).toBe(input);
  expect(input).toHaveClass('border-1', 'w-200');
});
