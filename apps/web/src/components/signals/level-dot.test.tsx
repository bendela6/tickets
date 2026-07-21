import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { LevelDot } from './level-dot';

test('labels each level for assistive tech', () => {
  render(<LevelDot level="error" />);
  expect(screen.getByLabelText('error')).toBeInTheDocument();
});

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
  expect(errorClasses).toMatch(/bg-danger/);
  // warning is a rotated diamond
  expect(warningClasses).toMatch(/rotate-45/);
  // info is an open (unfilled) circle
  expect(infoClasses).toMatch(/rounded-full/);
  expect(infoClasses).toMatch(/border/);
});
