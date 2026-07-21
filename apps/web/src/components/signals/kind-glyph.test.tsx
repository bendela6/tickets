import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { KindGlyph } from './kind-glyph';

test('labels each signal kind for assistive tech', () => {
  render(<KindGlyph type="event" />);
  expect(screen.getByLabelText('event')).toBeInTheDocument();
});

test('renders the design glyph set per kind', () => {
  const cases: Array<[Parameters<typeof KindGlyph>[0]['type'], string]> = [
    ['event', '◆'],
    ['log', '≡'],
    ['click', '◉'],
    ['navigation', '→'],
    ['http', '⇅'],
    ['error', '✕'],
    ['custom', '✳'],
  ];
  for (const [type, glyph] of cases) {
    const { unmount } = render(<KindGlyph type={type} />);
    expect(screen.getByLabelText(type)).toHaveTextContent(glyph);
    unmount();
  }
});

test('error variant uses danger coloring, distinct from the neutral kinds', () => {
  render(<KindGlyph type="error" />);
  render(<KindGlyph type="click" />);
  expect(screen.getByLabelText('error').className).toMatch(/danger/);
  expect(screen.getByLabelText('click').className).not.toMatch(/danger/);
});
