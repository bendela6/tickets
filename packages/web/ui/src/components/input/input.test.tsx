import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { FieldError } from '../field-error';
import { FieldLabel } from '../field-label';
import { Input } from './input';

test('md input carries the spec size classes', () => {
  render(<Input aria-label="Title" />);
  const input = screen.getByLabelText('Title');
  expect(input).toHaveClass('h-9', 'px-3', 'rounded-lg', 'bg-surface-raised', 'border-gray-7');
  // Regression guard: tailwind-merge must not let the 14px font size evict the
  // ink text color (the same trap the primary button hit with text-13/19).
  expect(input).toHaveClass('text-14');
  expect(input).toHaveClass('text-gray-12');
});

test('sm input overrides height, padding, radius, and font size', () => {
  render(<Input size="sm" aria-label="Estimate" />);
  const input = screen.getByLabelText('Estimate');
  expect(input).toHaveClass('h-7', 'px-2.25', 'rounded-md', 'text-13');
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
