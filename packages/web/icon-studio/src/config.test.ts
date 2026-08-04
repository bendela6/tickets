import { PRESETS } from './config';

// The bare mark's own values (the weight-to-reach ratio, the locked
// colours and angles) are pinned against `DEFAULT_DOC` in doc.test.ts now —
// `config.ts` no longer holds a second, parallel copy of them (`MarkConfig`
// / `DEFAULT_CONFIG` were retired once `icon-writer.ts`'s ENOENT fallback
// switched to serving `DEFAULT_DOC` directly). What's left here is the
// preset palette, which has no `IconDoc` equivalent.

test('every preset supplies three light, three dark and a chip', () => {
  for (const [name, p] of Object.entries(PRESETS)) {
    expect(p.light, name).toHaveLength(3);
    expect(p.dark, name).toHaveLength(3);
    expect(p.chip, name).toMatch(/^#[0-9a-f]{6}$/);
  }
});

test('the lifted preset only changes the dark violet', () => {
  expect(PRESETS.lifted.light).toEqual(PRESETS.chosen.light);
  expect(PRESETS.lifted.dark[0]).toBe('#8071ff');
  expect(PRESETS.lifted.dark.slice(1)).toEqual(PRESETS.chosen.dark.slice(1));
});
