import { expect, test } from 'vitest';
import { cursorRing, focusRing } from './focus-ring';

// Nothing here names a rung. The design moves those; what must not move is the
// shape — that outward carries a halo and inward does not, that both kill the
// native outline, and that the cursor is state-driven.

test('the default placement is unchanged, so every existing call site still works', () => {
  expect(focusRing('indigo', 'focus')).toBe(focusRing('indigo', 'focus', 'outward'));
});

test('outward draws a rim plus a halo; inward draws only an inset rim', () => {
  // An inward ring lives inside a joined control or a popup row, where a halo
  // would either be clipped by the parent or bleed over the neighbouring row —
  // and in both cases it stops reading as "this one". So the halo is what has
  // to be absent.
  const outward = focusRing('indigo', 'focus-visible', 'outward');
  const inward = focusRing('indigo', 'focus-visible', 'inward');

  expect(outward).toMatch(/ring-\d/);
  expect(inward).toMatch(/ring-inset/);
  expect(outward).not.toMatch(/ring-inset/);
  // The halo is the translucent part — an alpha modifier on the ring colour.
  expect(outward).toMatch(/ring-indigo-\d+\/\d+/);
  expect(inward).not.toMatch(/ring-indigo-\d+\/\d+/);
});

test('both placements kill the native outline and follow the trigger they are given', () => {
  for (const placement of ['outward', 'inward'] as const) {
    const cls = focusRing('red', 'focus-within', placement);
    expect(cls, placement).toContain('focus-within:outline-none');
    expect(cls, placement).not.toContain('focus-visible:');
  }
});

test('the cursor ring is state-driven, so it carries no pseudo-class', () => {
  // A listbox row never holds DOM focus — the input does, and points at the row
  // with aria-activedescendant — so a `focus-visible:` prefix would never fire
  // on the row the cursor is actually on.
  const cls = cursorRing('indigo');
  expect(cls).toMatch(/ring-inset/);
  expect(cls).not.toMatch(/focus/);
  expect(cls).not.toMatch(/hover/);
});

test('the cursor ring and the inward focus rim are the same treatment', () => {
  // They can both be on one row. Different widths or rungs would read as two
  // competing signals rather than one, so they must agree by construction.
  // Compared with the variant prefixes stripped, since that is the only thing
  // that legitimately differs between them.
  const ringUtilities = (cls: string) =>
    cls
      .split(' ')
      .map((token) => token.replace(/^(?:dark:)?(?:focus[a-z-]*:)?/, ''))
      .filter((token) => token.startsWith('ring'))
      .sort();

  expect(ringUtilities(cursorRing('indigo')))
    .toEqual(ringUtilities(focusRing('indigo', 'focus-visible', 'inward')));
});
