import { expect, test } from 'vitest';
import { hexToOptionColor } from './option-color';

// Real hex values stored in option/status configs in the dev database.
test('maps stored config hexes onto the nearest palette color', () => {
  expect(hexToOptionColor('#d03b3b')).toBe('red');
  expect(hexToOptionColor('#fab219')).toBe('yellow');
  expect(hexToOptionColor('#898781')).toBe('gray');
  expect(hexToOptionColor('#3987e5')).toBe('blue');
  expect(hexToOptionColor('#8f7ae8')).toBe('indigo');
  expect(hexToOptionColor('#0ca30c')).toBe('green');
});

test('falls back to gray for missing or malformed values', () => {
  expect(hexToOptionColor(undefined)).toBe('gray');
  expect(hexToOptionColor(null)).toBe('gray');
  expect(hexToOptionColor('')).toBe('gray');
  expect(hexToOptionColor('rebeccapurple')).toBe('gray');
  expect(hexToOptionColor('#12')).toBe('gray');
});

test('covers the remaining palette hues', () => {
  expect(hexToOptionColor('#e8590c')).toBe('orange');
  expect(hexToOptionColor('#0d9488')).toBe('teal');
  expect(hexToOptionColor('#0891b2')).toBe('cyan');
  expect(hexToOptionColor('#9333ea')).toBe('purple');
  expect(hexToOptionColor('#db2777')).toBe('pink');
});
