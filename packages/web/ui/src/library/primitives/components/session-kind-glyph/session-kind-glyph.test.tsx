import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { SessionKindGlyph } from './session-kind-glyph';

test('terminal renders an inked prompt glyph with an accessible label', () => {
  render(<SessionKindGlyph kind="terminal" />);
  const glyph = screen.getByRole('img', { name: 'terminal session' });
  expect(glyph).toHaveTextContent('>_');
  expect(glyph).toHaveClass('bg-gray-12');
});

test('agent renders the accent asterisk with an accessible label', () => {
  render(<SessionKindGlyph kind="agent" />);
  const glyph = screen.getByRole('img', { name: 'agent session' });
  expect(glyph).toHaveTextContent('✳');
  expect(glyph).toHaveClass('bg-indigo-3');
});
