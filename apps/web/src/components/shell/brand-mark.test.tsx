import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import config from '../../../icons.config.json';
import { BRAND_MARK_CSS, BrandMark } from './brand-mark';

// Every expectation below is derived from icons.config.json rather than
// restating its values, so retuning the mark in the studio can never leave
// this file asserting a mark the app no longer draws.

function sticks(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('svg path')];
}

function svgOf(container: HTMLElement): Element {
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('BrandMark rendered no <svg>');
  return svg;
}

test('draws one stick per configured angle, painted low → mid → top so the leading stick lands on top', () => {
  const { container } = render(<BrandMark />);
  const [top, mid, low] = config.angles;

  expect(sticks(container).map((p) => p.getAttribute('transform'))).toEqual([
    `rotate(${low} 24 24)`,
    `rotate(${mid} 24 24)`,
    `rotate(${top} 24 24)`,
  ]);
});

test('gives each stick its own custom property, in that same paint order', () => {
  const { container } = render(<BrandMark />);

  expect(sticks(container).map((p) => p.getAttribute('stroke'))).toEqual([
    'var(--brand-low)',
    'var(--brand-mid)',
    'var(--brand-top)',
  ]);
});

test('draws the favicon geometry: a full diameter at the configured weight', () => {
  const { container } = render(<BrandMark />);
  const drawn = sticks(container);

  // The exact path and weight the generated favicon.svg carries — same drawing,
  // not a lookalike.
  expect(drawn.map((p) => p.getAttribute('d'))).toEqual(Array(3).fill('M24 6L24 42'));
  expect(drawn.map((p) => p.getAttribute('stroke-width'))).toEqual(
    Array(3).fill(String(config.bareWeight)),
  );
});

test('re-points the same three properties for dark rather than redrawing anything', () => {
  const [lightTop, lightMid, lightLow] = config.light;
  const [darkTop, darkMid, darkLow] = config.dark;

  expect(BRAND_MARK_CSS).toContain(
    `:root,[data-theme='light']{--brand-top:${lightTop};--brand-mid:${lightMid};--brand-low:${lightLow}}`,
  );
  expect(BRAND_MARK_CSS).toContain(
    `[data-theme='dark']{--brand-top:${darkTop};--brand-mid:${darkMid};--brand-low:${darkLow}}`,
  );
});

test('scales from the size prop without touching the drawing', () => {
  const { container } = render(<BrandMark size={18} />);
  const svg = svgOf(container);

  expect(svg.getAttribute('width')).toBe('18');
  expect(svg.getAttribute('height')).toBe('18');
  expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
});

test('publishes the theme block into the document, so the strokes resolve', () => {
  render(<BrandMark />);

  const published = [...document.querySelectorAll('style')].filter((s) =>
    s.textContent?.includes('--brand-top'),
  );
  expect(published.length).toBeGreaterThan(0);
});
