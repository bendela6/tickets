import { extractStateSources, findMatching } from './state-source';

describe('findMatching', () => {
  it('matches across nesting', () => {
    const src = '(a(b)c)';
    expect(findMatching(src, 0)).toBe(6);
  });

  it.each([
    ["a quoted close", `('a)b')`],
    ['a commented close', `(// )\n)`],
    ['a block-commented close', `(/* ) */)`],
    ['a template close', '(`a)b`)'],
    ['an interpolated close', '(`a${ ")" }b`)'],
  ])('does not end early on %s', (_case, src) => {
    // A source slice that stops at the first `)` inside a string would cut a
    // render body in half and show it as if that were the whole thing.
    expect(findMatching(src, 0)).toBe(src.length - 1);
  });

  it('reports -1 when the delimiter never closes', () => {
    expect(findMatching('(a', 0)).toBe(-1);
  });
});

describe('extractStateSources', () => {
  it('lifts the render body out from under the thunk and its parens', () => {
    const src = `
const tones = defineState({
  title: 'tones',
  render: () => (
    <Grid columns={6}>
      <Slot label="a" />
    </Grid>
  ),
});
`;
    expect(extractStateSources(src)).toEqual({
      tones: '<Grid columns={6}>\n  <Slot label="a" />\n</Grid>',
    });
  });

  it('keeps a body that is not parenthesised', () => {
    const src = `defineState({ title: 'one', render: () => <Button /> })`;
    expect(extractStateSources(src).one).toBe('<Button />');
  });

  it('reads every section in a file', () => {
    const src = `
const a = defineState({ title: 'first', render: () => <A /> });
const b = defineState({ title: 'second', render: () => <B /> });
`;
    expect(Object.keys(extractStateSources(src))).toEqual(['first', 'second']);
  });

  it('is not confused by a nested render or title', () => {
    // The inner object's keys sit at depth 1, so only the section's own
    // top-level `title` and `render` are read.
    const src = `defineState({ title: 'outer', render: () => <X cfg={{ title: 'inner' }} /> })`;
    expect(extractStateSources(src)).toEqual({ outer: `<X cfg={{ title: 'inner' }} />` });
  });

  it('skips a call it cannot read rather than emitting a half-parsed block', () => {
    expect(extractStateSources(`defineState({ render: () => <X /> })`)).toEqual({});
    expect(extractStateSources(`defineState(someVariable)`)).toEqual({});
  });

  it('returns nothing for a file with no authored sections', () => {
    expect(extractStateSources(`export const states = [{ name: 'a', render: () => null }];`)).toEqual({});
  });
});
