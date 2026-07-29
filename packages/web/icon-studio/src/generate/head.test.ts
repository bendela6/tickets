import { DEFAULT_CONFIG } from '../config';
import { buildHeadBlock, HEAD_END, HEAD_START, injectHeadBlock } from './head';

const page = (inner: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />${inner}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

test('the block carries every tag the platforms need', () => {
  const block = buildHeadBlock(DEFAULT_CONFIG);
  for (const needle of [
    'rel="icon" href="/favicon.svg"',
    'rel="mask-icon" href="/icon-mono.svg"',
    'rel="apple-touch-icon" href="/apple-touch-icon.png"',
    'rel="manifest" href="/site.webmanifest"',
    'name="theme-color"',
    'name="apple-mobile-web-app-capable"',
    'name="apple-mobile-web-app-status-bar-style"',
  ]) {
    expect(block).toContain(needle);
  }
  expect(block).toContain(DEFAULT_CONFIG.chip);
  expect(block).toContain(DEFAULT_CONFIG.light[0]);
});

test('the block is wrapped in both markers', () => {
  const block = buildHeadBlock(DEFAULT_CONFIG);
  expect(block.startsWith(HEAD_START)).toBe(true);
  expect(block.trimEnd().endsWith(HEAD_END)).toBe(true);
});

test('inserts before </head> when no markers are present', () => {
  const html = page('');
  const out = injectHeadBlock(html, buildHeadBlock(DEFAULT_CONFIG));
  expect(out).toContain(HEAD_START);
  expect(out.indexOf(HEAD_START)).toBeLessThan(out.indexOf('</head>'));
  expect(out).toContain('<meta charset="UTF-8" />');
});

test('replaces the existing block, leaving everything else alone', () => {
  const first = injectHeadBlock(page(''), buildHeadBlock(DEFAULT_CONFIG));
  const changed = { ...DEFAULT_CONFIG, chip: '#003344' };
  const second = injectHeadBlock(first, buildHeadBlock(changed));
  expect(second.match(new RegExp(HEAD_START, 'g'))).toHaveLength(1);
  expect(second).toContain('#003344');
  expect(second).not.toContain(DEFAULT_CONFIG.chip);
  expect(second).toContain('<div id="root"></div>');
});

test('injecting the same block twice is a no-op', () => {
  const block = buildHeadBlock(DEFAULT_CONFIG);
  const once = injectHeadBlock(page(''), block);
  expect(injectHeadBlock(once, block)).toBe(once);
});

test('throws when there is no </head> to insert before', () => {
  expect(() => injectHeadBlock('<html><body></body></html>', buildHeadBlock(DEFAULT_CONFIG))).toThrow(
    /<\/head>/,
  );
});

test('throws when HEAD_START is present but HEAD_END is missing', () => {
  const block = buildHeadBlock(DEFAULT_CONFIG);
  const html = page(`
    ${HEAD_START}
    <stale>tag</stale>`);
  expect(() => injectHeadBlock(html, block)).toThrow(/HEAD_END/);
  expect(() => injectHeadBlock(html, block)).toThrow(/index.html/);
});

test('throws when HEAD_END is present but HEAD_START is missing', () => {
  const block = buildHeadBlock(DEFAULT_CONFIG);
  const html = page(`
    <stale>tag</stale>
    ${HEAD_END}`);
  expect(() => injectHeadBlock(html, block)).toThrow(/HEAD_START/);
  expect(() => injectHeadBlock(html, block)).toThrow(/index.html/);
});

test('throws when markers are present but in reverse order', () => {
  const block = buildHeadBlock(DEFAULT_CONFIG);
  const html = page(`
    ${HEAD_END}
    <stale>tag</stale>
    ${HEAD_START}`);
  expect(() => injectHeadBlock(html, block)).toThrow(/out of order/);
  expect(() => injectHeadBlock(html, block)).toThrow(/index.html/);
});

test('regression: clean insert and identical injection still work', () => {
  const block = buildHeadBlock(DEFAULT_CONFIG);
  const html = page('');
  const once = injectHeadBlock(html, block);
  expect(once).toContain(HEAD_START);
  expect(injectHeadBlock(once, block)).toBe(once);
});
