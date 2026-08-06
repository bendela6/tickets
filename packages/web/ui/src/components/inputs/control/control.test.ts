
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

test('every control that accepts readOnly also DRAWS it', () => {
  // Found three times by hand before this existed — PinInput, DurationInput and
  // TagInput each accepted `readOnly`, set `cursor-default`, and kept their
  // floor. A locked field that still looks editable is the exact trap the
  // design names: "read-only still has a floor, so it looks editable and
  // invites a click that does nothing. A glyph cannot fix an affordance you
  // left in place."
  //
  // None of the three was visible from its own page. A page of one control has
  // nothing to disagree with, which is why this is a test and not a review.
  const { readdirSync, readFileSync, statSync } = require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof import('node:path');
  const root = 'src/components/inputs';
  const BASES = new Set(['control', 'field', 'popup', 'option-row', 'chip', 'toggle', 'combobox-list']);

  const offenders: string[] = [];
  for (const dir of readdirSync(root)) {
    const full = join(root, dir);
    if (!statSync(full).isDirectory() || BASES.has(dir)) continue;
    const files = readdirSync(full).filter(
      (f) => /\.tsx?$/.test(f) && !/\.(test|demo)\./.test(f) && f !== 'index.ts',
    );
    if (!files.length) continue;
    const src = files.map((f) => readFileSync(join(full, f), 'utf8')).join('\n');

    if (!/\breadOnly\b/.test(src)) continue;
    const drawsIt = /readOnly(Field|Mark)Class/.test(src);
    // Delegating is legitimate: PasswordInput and SearchInput hand `readOnly`
    // to an inner Input, which draws it. CheckboxGroup hands it to its rows.
    //
    // The receiver must be a COMPONENT. `readOnly={readOnly}` on a native
    // <input> only sets the HTML attribute — it refuses the edit and draws
    // nothing, which is the entire bug this test exists for. Matching that as
    // delegation is how the first version of this guard passed against a
    // control I had deliberately broken to check it.
    const delegates = /<[A-Z]\w*(?:\s[^>]*)?\sreadOnly=\{readOnly\}/.test(src);
    // A control may also refuse the state outright by never rendering the
    // affordance — FileInput drops its remove buttons entirely.
    const refuses = /locked \? null|readOnly \? null/.test(src);
    if (!drawsIt && !delegates && !refuses) offenders.push(dir);
  }
  expect(offenders).toEqual([]);
});
