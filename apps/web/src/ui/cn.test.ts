import { expect, test } from 'vitest';
import { cn } from './cn';

test('merges conditionals and resolves tailwind conflicts', () => {
  expect(cn('px-2', false && 'hidden', 'px-4')).toBe('px-4');
});
