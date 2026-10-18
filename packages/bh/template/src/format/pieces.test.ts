import { describe, expect, it } from 'vitest';
import { formatText, measuresAsPieces, type FormatPiece } from './pieces';

describe('formatText', () => {
  it('joins the pieces’ text, as written', () => {
    const pieces: FormatPiece[] = [{ text: '12.4' }, { text: ' ' }, { text: 'MiB', unit: true }];
    expect(formatText(pieces)).toBe('12.4 MiB');
    expect(formatText([{ text: '43' }, { text: '%', unit: true }])).toBe('43%');
  });

  it('writes nothing for no pieces, and an empty piece as nothing', () => {
    expect(formatText([])).toBe('');
    expect(formatText([{ text: '' }, { text: 'a' }])).toBe('a');
  });
});

describe('measuresAsPieces', () => {
  it('writes each number and its unit, a space between measures', () => {
    expect(
      measuresAsPieces([
        { amount: '2', unit: 'h' },
        { amount: '5', unit: 'm' },
      ]),
    ).toEqual([
      { text: '2' },
      { text: 'h', unit: true },
      { text: ' ' },
      { text: '5' },
      { text: 'm', unit: true },
    ]);
  });

  it('puts a gap between a number and its unit, and a suffix on the last unit', () => {
    expect(measuresAsPieces([{ amount: '12.4', unit: 'MiB' }], { gap: ' ', suffix: '/s' })).toEqual(
      [{ text: '12.4' }, { text: ' ' }, { text: 'MiB/s', unit: true }],
    );
  });
});
