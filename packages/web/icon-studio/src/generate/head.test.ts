import { buildHeadBlock, HEAD_END, HEAD_START, injectHeadBlock } from './head';

const MASK_ICON_COLOR = '#7167ff';
const THEME_COLOR = '#1b1830';
const COLORS = { maskIconColor: MASK_ICON_COLOR, themeColor: THEME_COLOR };

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
  const block = buildHeadBlock(COLORS);
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
  expect(block).toContain(THEME_COLOR);
  expect(block).toContain(MASK_ICON_COLOR);
});

test('the block is wrapped in both markers', () => {
  const block = buildHeadBlock(COLORS);
  expect(block).toContain(HEAD_START);
  expect(block.trimEnd().endsWith(HEAD_END)).toBe(true);
});

test('inserts before </head> when no markers are present', () => {
  const html = page('');
  const out = injectHeadBlock(html, buildHeadBlock(COLORS));
  expect(out).toContain(HEAD_START);
  expect(out.indexOf(HEAD_START)).toBeLessThan(out.indexOf('</head>'));
  expect(out).toContain('<meta charset="UTF-8" />');
});

test('replaces the existing block, leaving everything else alone', () => {
  const first = injectHeadBlock(page(''), buildHeadBlock(COLORS));
  const changed = { ...COLORS, themeColor: '#003344' };
  const second = injectHeadBlock(first, buildHeadBlock(changed));
  expect(second.match(new RegExp(HEAD_START, 'g'))).toHaveLength(1);
  expect(second).toContain('#003344');
  expect(second).not.toContain(THEME_COLOR);
  expect(second).toContain('<div id="root"></div>');
});

test('injecting the same block twice is a no-op', () => {
  const block = buildHeadBlock(COLORS);
  const once = injectHeadBlock(page(''), block);
  expect(injectHeadBlock(once, block)).toBe(once);
});

test('throws when there is no </head> to insert before', () => {
  expect(() => injectHeadBlock('<html><body></body></html>', buildHeadBlock(COLORS))).toThrow(
    /<\/head>/,
  );
});

test('throws when HEAD_START is present but HEAD_END is missing', () => {
  const block = buildHeadBlock(COLORS);
  const html = page(`
    ${HEAD_START}
    <stale>tag</stale>`);
  expect(() => injectHeadBlock(html, block)).toThrow(/HEAD_END/);
  expect(() => injectHeadBlock(html, block)).toThrow(/index.html/);
});

test('throws when HEAD_END is present but HEAD_START is missing', () => {
  const block = buildHeadBlock(COLORS);
  const html = page(`
    <stale>tag</stale>
    ${HEAD_END}`);
  expect(() => injectHeadBlock(html, block)).toThrow(/HEAD_START/);
  expect(() => injectHeadBlock(html, block)).toThrow(/index.html/);
});

test('throws when markers are present but in reverse order', () => {
  const block = buildHeadBlock(COLORS);
  const html = page(`
    ${HEAD_END}
    <stale>tag</stale>
    ${HEAD_START}`);
  expect(() => injectHeadBlock(html, block)).toThrow(/out of order/);
  expect(() => injectHeadBlock(html, block)).toThrow(/index.html/);
});

test('regression: clean insert and identical injection still work', () => {
  const block = buildHeadBlock(COLORS);
  const html = page('');
  const once = injectHeadBlock(html, block);
  expect(once).toContain(HEAD_START);
  expect(injectHeadBlock(once, block)).toBe(once);
});

test('all lines of the injected block have exactly 4-space indentation', () => {
  const block = buildHeadBlock(COLORS);
  const injected = injectHeadBlock(page(''), block);

  // Extract the full block section including leading whitespace
  const blockStart = injected.lastIndexOf('\n', injected.indexOf(HEAD_START)) + 1;
  const blockEnd = injected.indexOf(HEAD_END) + HEAD_END.length;
  const blockSection = injected.substring(blockStart, blockEnd);

  // Split into lines and check indentation
  const lines = blockSection.split('\n');
  for (const line of lines) {
    // Every line in the block should start with exactly 4 spaces
    if (line.trim().length > 0) {
      expect(line.substring(0, 4)).toBe('    ');
      // Verify there's content after the spaces
      expect(line.length).toBeGreaterThan(4);
      // Verify exactly 4 spaces, not more
      expect(line[4]).not.toBe(' ');
    }
  }
});
