import { boolean as booleanControl, select, text } from '@tickets/ui';
import { generateSnippet } from './code-snippet';

describe('generateSnippet', () => {
  it('omits props still at their initial value, keeps the rest', () => {
    const controls = {
      variant: select(['a', 'b'], { initial: 'a' }),
      size: select(['sm', 'lg'], { initial: 'sm' }),
    };
    const { code, omitted } = generateSnippet('Comp', controls, { variant: 'a', size: 'lg' });
    expect(omitted).toEqual(['variant']);
    expect(code).toBe('<Comp size="lg" />');
  });

  it('omits an allowNone select whose current value is undefined', () => {
    const controls = { color: select(['red', 'blue'], { allowNone: true }) };
    const { code, omitted } = generateSnippet('Comp', controls, { color: undefined });
    expect(omitted).toEqual(['color']);
    expect(code).toBe('<Comp />');
  });

  it('renders a true boolean as a bare flag, not `prop={true}`', () => {
    const controls = { loading: booleanControl(false) };
    const { code, omitted } = generateSnippet('Comp', controls, { loading: true });
    expect(code).toBe('<Comp loading />');
    expect(omitted).toEqual([]);
  });

  it('renders the children control as element children, never in the props/omitted list', () => {
    const controls = { children: text('') };
    const { code, omitted } = generateSnippet('Comp', controls, { children: 'Hello world' });
    expect(code).toBe('<Comp>Hello world</Comp>');
    expect(omitted).toEqual([]);
  });

  it('self-closes when there are no children', () => {
    const controls = { variant: select(['primary', 'destructive'], { initial: 'primary' }) };
    const { code } = generateSnippet('Comp', controls, { variant: 'destructive' });
    expect(code).toBe('<Comp variant="destructive" />');
  });

  it('wraps one prop per line once more than 3 props are set', () => {
    const controls = {
      a: text(''),
      b: text(''),
      c: text(''),
      d: text(''),
    };
    const { code } = generateSnippet('Comp', controls, { a: 'A', b: 'B', c: 'C', d: 'D' });
    expect(code).toBe('<Comp\n  a="A"\n  b="B"\n  c="C"\n  d="D"\n />');
  });

  it('wraps props and indents children on their own line once more than 3 props are set', () => {
    const controls = {
      a: text(''),
      b: text(''),
      c: text(''),
      d: text(''),
      children: text(''),
    };
    const { code } = generateSnippet('Comp', controls, {
      a: 'A',
      b: 'B',
      c: 'C',
      d: 'D',
      children: 'Kid',
    });
    expect(code).toBe('<Comp\n  a="A"\n  b="B"\n  c="C"\n  d="D"\n>\n  Kid\n</Comp>');
  });

  it('escapes double quotes inside string prop values', () => {
    const controls = { label: text('') };
    const { code } = generateSnippet('Comp', controls, { label: 'Say "hi"' });
    expect(code).toBe('<Comp label="Say \\"hi\\"" />');
  });

  it('returns the full list of omitted prop keys, in control order', () => {
    const controls = {
      variant: select(['a', 'b'], { initial: 'a' }),
      size: select(['sm', 'lg'], { allowNone: true }),
      loading: booleanControl(false),
    };
    const { omitted } = generateSnippet('Comp', controls, {
      variant: 'a',
      size: undefined,
      loading: false,
    });
    expect(omitted).toEqual(['variant', 'size', 'loading']);
  });
});
