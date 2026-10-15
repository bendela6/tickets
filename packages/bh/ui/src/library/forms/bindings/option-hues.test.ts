import { describe, expect, it } from 'vitest';
import type { Option } from '../../inputs/contract';
import { hueOf, toneOf, withHues } from './option-hues';

describe('withHues', () => {
  it('paints a role’s color from its hue, and leaves out a color no tone names', () => {
    const options = [
      { value: 'done', label: 'Done', color: 'success' },
      { value: 'open', label: 'Open', color: 'blue' },
      { value: 'odd', label: 'Odd', color: 'mauve' },
      { value: 'plain', label: 'Plain' },
    ] as unknown as Option[];
    expect(withHues(options)).toEqual([
      { value: 'done', label: 'Done', color: 'green' },
      { value: 'open', label: 'Open', color: 'blue' },
      { value: 'odd', label: 'Odd' },
      { value: 'plain', label: 'Plain' },
    ]);
    // One copy for as long as it is the same list.
    expect(withHues(options)).toBe(withHues(options));
  });

  it('hands back a list of hues as it is, and none as an empty list', () => {
    const options: Option[] = [{ value: 'open', label: 'Open', color: 'blue' }];
    expect(withHues(options)).toBe(options);
    expect(withHues(undefined)).toEqual([]);
  });

  it('reads a tone and its hue from a word', () => {
    expect(toneOf('danger')).toBe('danger');
    expect(hueOf('danger')).toBe('red');
    expect(toneOf('mauve')).toBeUndefined();
    expect(hueOf(undefined)).toBeUndefined();
  });
});
