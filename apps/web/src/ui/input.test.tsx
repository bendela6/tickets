import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { FieldError } from './field-error';
import { FieldLabel } from './field-label';
import { Input } from './input';

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
