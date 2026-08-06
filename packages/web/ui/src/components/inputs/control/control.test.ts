
test('no control spells its own disabled opacity', async () => {
  // The failure this prevents: disabled was written out at fifteen call sites
  // with THREE different answers — fieldClass said 45%, nine triggers said 50%
  // inline and won by merging later, and the marks still tinted a ground and
  // drew a border because they never went through fieldClass at all. One
  // definition, or it drifts again the next time somebody adds a control.
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  // cwd is the package root under vitest; import.meta.url needs Windows drive
  // fixups that are not worth carrying in a test.
  const root = 'src/components/inputs';

  const offenders: string[] = [];
  for (const dir of readdirSync(root)) {
    const full = join(root, dir);
    if (!statSync(full).isDirectory() || dir === 'control') continue;
    for (const file of readdirSync(full)) {
      if (!/\.tsx?$/.test(file) || /\.(test|demo)\./.test(file)) continue;
      const src = readFileSync(join(full, file), 'utf8');
      // Only the `disabled:` VARIANT form. A bare conditional opacity is a
      // different concept and legitimately appears: NumberInput dims a step at
      // a bound, DatePicker dims an out-of-range day. Neither of those means
      // "this control is unavailable", and catching them would push the next
      // person to delete a real treatment to quiet a test.
      if (/disabled:opacity-/.test(src)) offenders.push(`${dir}/${file}`);
    }
  }
  expect(offenders).toEqual([]);
});
