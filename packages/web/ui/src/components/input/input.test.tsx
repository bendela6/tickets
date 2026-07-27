import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { FieldError } from '../field-error';
import { FieldLabel } from '../field-label';
import { Input } from './input';

test('regular input carries the spec size classes', () => {
  render(<Input aria-label="Title" />);
  const input = screen.getByLabelText('Title');
  expect(input).toHaveClass('h-9', 'px-3', 'rounded-[8px]', 'bg-surface-raised', 'border-gray-7');
  // Regression guard: tailwind-merge must not let the 14px font size evict the
  // ink text color (the same trap the primary button hit with text-ui).
  expect(input).toHaveClass('text-[14px]');
  expect(input).toHaveClass('text-gray-12');
});

test('compact input overrides height, padding, radius, and font size', () => {
  render(<Input size="compact" aria-label="Estimate" />);
  const input = screen.getByLabelText('Estimate');
  expect(input).toHaveClass('h-7', 'px-2.25', 'rounded-[6px]', 'text-[13px]');
  expect(input).not.toHaveClass('text-[14px]');
});

test('invalid input shows the danger border and always-on halo', () => {
  render(<Input invalid aria-label="Key" />);
  const input = screen.getByLabelText('Key');
  expect(input).toHaveClass('border-red-9', 'ring-[3px]', 'ring-red-3');
});

test('input associates label and error', () => {
  render(
    <>
      <FieldLabel htmlFor="key" required>
        Key
      </FieldLabel>
      <Input id="key" invalid aria-describedby="key-error" />
      <FieldError id="key-error">Key must be kebab-case</FieldError>
    </>,
  );
  const input = screen.getByLabelText('Key *');
  expect(input).toHaveAccessibleDescription('Key must be kebab-case');
  expect(input).toHaveAttribute('aria-invalid', 'true');
});
