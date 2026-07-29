import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { LevelDot } from './level-dot';

test('labels each level for assistive tech', () => {
  render(<LevelDot level="error" />);
  expect(screen.getByLabelText('error')).toBeInTheDocument();
});

// A border-radius at or beyond half a box's own side turns that box into a
// circle regardless of any rotation applied to it — rotating a circle is a
// visual no-op. The Tailwind side these tokens compile to (tokens.css):
// size-2 = 8px, size-2.25 = 9px, size-2.5 = 10px; rounded-none = 0,
// rounded-sm = 4px, rounded-full = always fully round. These maps let the
// test compute real geometry from the class list instead of only checking
// that a rotation utility is present, which is what let warning quietly
// become a circle (rotate-45 rounded-sm at 8px: 4px is exactly half of 8px).
const SIZE_PX: Record<string, number> = {
  'size-2': 8,
  'size-2.25': 9,
  'size-2.5': 10,
  'size-2.75': 11,
  'size-3': 12,
};

const RADIUS_PX: Record<string, number> = {
  'rounded-none': 0,
  'rounded-sm': 4,
  'rounded-md': 6,
  'rounded-lg': 8,
  'rounded-xl': 12,
};

function sizePx(className: string): number {
  const token = className.split(/\s+/).find((c) => c in SIZE_PX);
  if (!token) throw new Error(`no known size-* class in "${className}"`);
  return SIZE_PX[token]!;
}

/** `rounded-full` reports `Infinity` — it always fully rounds, no math needed. */
function radiusPx(className: string): number {
  if (/(?:^|\s)rounded-full(?:\s|$)/.test(className)) return Infinity;
  const token = className.split(/\s+/).find((c) => c in RADIUS_PX);
  if (!token) throw new Error(`no known rounded-* class in "${className}"`);
  return RADIUS_PX[token]!;
}

test('error, warning and info render visually distinct shapes', () => {
  const { getByLabelText: getError } = render(<LevelDot level="error" />);
  const { getByLabelText: getWarning } = render(<LevelDot level="warning" />);
  const { getByLabelText: getInfo } = render(<LevelDot level="info" />);

  const errorClasses = getError('error').className;
  const warningClasses = getWarning('warning').className;
  const infoClasses = getInfo('info').className;

  // Each level must carry a shape rule (fill, rotation, or border) that
  // differs from the other two — color alone is not sufficient.
  expect(errorClasses).not.toBe(warningClasses);
  expect(errorClasses).not.toBe(infoClasses);
  expect(warningClasses).not.toBe(infoClasses);

  // error is a filled circle
  expect(errorClasses).toMatch(/rounded-full/);
  expect(errorClasses).toMatch(/bg-red-9/);
  // info is an open (unfilled) circle
  expect(infoClasses).toMatch(/rounded-full/);
  expect(infoClasses).toMatch(/border/);

  // warning is a rotated DIAMOND, not a circle wearing a no-op rotation.
  // Asserting `rotate-45` alone is a false green: it stays present even if
  // the radius is later widened back to something that fully rounds the
  // box, and a rotated circle is indistinguishable from an unrotated one.
  expect(warningClasses).toMatch(/rotate-45/);
  const warningSize = sizePx(warningClasses);
  const warningRadius = radiusPx(warningClasses);
  expect(warningRadius).toBeLessThan(warningSize / 2);
});

test('a diamond mark never carries a corner radius that would round it into a circle', () => {
  // Regression guard for the C1 class of bug: any shape-coded mark that
  // rotates 45° must keep a radius under half its own box, or the rotation
  // becomes cosmetic and two distinct levels render identically.
  const { getByLabelText } = render(<LevelDot level="warning" />);
  const classes = getByLabelText('warning').className;
  expect(classes).toMatch(/rounded-none/);
  expect(classes).not.toMatch(/rounded-(?:sm|md|lg|xl|full)/);
});
