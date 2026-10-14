import { describe, expect, it } from 'vitest';
import { parseAnsi, stripAnsi } from './ansi';
import { paletteColor, rgbColor, standardColor } from './ansi-color';

const ESC = '\u001b';
const sgr = (codes: string) => {
  return `${ESC}[${codes}m`;
};

describe('parseAnsi', () => {
  it('leaves a line with no codes as one plain run', () => {
    expect(parseAnsi('plain text')).toEqual([{ text: 'plain text', style: {} }]);
  });

  it('draws the eight colours in the design hues, at rung 11', () => {
    const names = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
    const line = names.map((name, index) => `${sgr(String(30 + index))}${name}`).join('');
    const drawn = parseAnsi(line).map(({ text, style }) => [text, style.fg]);
    expect(drawn).toEqual([
      ['black', { hue: 'gray', step: '12' }],
      ['red', { hue: 'red', step: '11' }],
      ['green', { hue: 'green', step: '11' }],
      ['yellow', { hue: 'yellow', step: '11' }],
      ['blue', { hue: 'blue', step: '11' }],
      ['magenta', { hue: 'purple', step: '11' }],
      ['cyan', { hue: 'cyan', step: '11' }],
      ['white', { hue: 'gray', step: '11' }],
    ]);
  });

  it('draws a bright colour in the same hue at rung 9', () => {
    expect(parseAnsi(`${sgr('91')}bright red`)[0]?.style.fg).toEqual({ hue: 'red', step: '9' });
    expect(parseAnsi(`${sgr('90')}dim gray`)[0]?.style.fg).toEqual({ hue: 'gray', step: '9' });
  });

  it('turns a background into its hue, normal or bright', () => {
    expect(parseAnsi(`${sgr('41')}a`)[0]?.style.bg).toBe('red');
    expect(parseAnsi(`${sgr('104')}a`)[0]?.style.bg).toBe('blue');
    expect(parseAnsi(`${sgr('45')}a${sgr('49')}b`).map((s) => s.style.bg)).toEqual([
      'purple',
      undefined,
    ]);
  });

  it('keeps bold, dim, italic, underline and strike, and takes each off again', () => {
    const runs = parseAnsi(
      `${sgr('1')}b${sgr('22')}${sgr('2')}d${sgr('22')}${sgr('3')}i${sgr('23')}${sgr('4')}u${sgr('24')}${sgr('9')}s${sgr('29')}n`,
    );
    expect(runs).toEqual([
      { text: 'b', style: { bold: true } },
      { text: 'd', style: { dim: true } },
      { text: 'i', style: { italic: true } },
      { text: 'u', style: { underline: true } },
      { text: 's', style: { strike: true } },
      { text: 'n', style: {} },
    ]);
  });

  it('resets everything at 0, and at an empty sequence', () => {
    expect(parseAnsi(`${sgr('1;31')}a${sgr('0')}b`)[1]).toEqual({ text: 'b', style: {} });
    expect(parseAnsi(`${sgr('1;31')}a${ESC}[mb`)[1]).toEqual({ text: 'b', style: {} });
  });

  it('reads several codes in one sequence, and 39 takes the colour off alone', () => {
    const runs = parseAnsi(`${sgr('1;32')}ok${sgr('39')} still bold`);
    expect(runs).toEqual([
      { text: 'ok', style: { bold: true, fg: { hue: 'green', step: '11' } } },
      { text: ' still bold', style: { bold: true } },
    ]);
  });

  it('maps 256 colours: the standard sixteen, the cube and the grays', () => {
    expect(parseAnsi(`${sgr('38;5;1')}a`)[0]?.style.fg).toEqual({ hue: 'red', step: '11' });
    expect(parseAnsi(`${sgr('38;5;9')}a`)[0]?.style.fg).toEqual({ hue: 'red', step: '9' });
    // 208 is the cube's orange (255, 135, 0).
    expect(parseAnsi(`${sgr('38;5;208')}a`)[0]?.style.fg?.hue).toBe('orange');
    // 244 is a mid gray, which a terminal uses for the dim.
    expect(parseAnsi(`${sgr('38;5;244')}a`)[0]?.style.fg).toEqual({ hue: 'gray', step: '9' });
    expect(parseAnsi(`${sgr('48;5;2')}a`)[0]?.style.bg).toBe('green');
  });

  it('maps a 24-bit colour to the nearest hue, in both spellings', () => {
    expect(parseAnsi(`${sgr('38;2;220;40;30')}a`)[0]?.style.fg).toEqual({ hue: 'red', step: '11' });
    expect(parseAnsi(`${sgr('38:2::30:160:60')}a`)[0]?.style.fg?.hue).toBe('green');
    expect(parseAnsi(`${sgr('38:2:30:160:60')}a`)[0]?.style.fg?.hue).toBe('green');
    expect(parseAnsi(`${sgr('48;2;40;80;220')}a`)[0]?.style.bg).toMatch(/blue|indigo/);
  });

  it('reads the codes after a 256 or 24-bit colour as codes of their own', () => {
    const style = parseAnsi(`${sgr('38;5;1;1;4')}a`)[0]?.style;
    expect(style).toEqual({ fg: { hue: 'red', step: '11' }, bold: true, underline: true });
    const after24 = parseAnsi(`${sgr('38;2;0;0;0;3')}a`)[0]?.style;
    expect(after24?.italic).toBe(true);
  });

  it('drops a colour it cannot read rather than guessing', () => {
    expect(parseAnsi(`${sgr('38;5;300')}a`)[0]?.style.fg).toBeUndefined();
    expect(parseAnsi(`${sgr('31')}${sgr('38;5')}a`)[0]?.style.fg).toBeUndefined();
  });

  it('never shows an escape code, whatever it does', () => {
    const line = [
      `${ESC}[2K`, // erase the line
      `${ESC}[1A`, // cursor up
      `${ESC}[?25l`, // hide the cursor
      `${ESC}]0;window title${'\u0007'}`, // a title, ended by BEL
      `${ESC}]8;;https://example.com${ESC}\\link${ESC}]8;;${ESC}\\`, // a hyperlink
      `${ESC}(B`, // a character set
      `${ESC}7`, // save the cursor
      'done',
      '\u009b31mred', // the 8-bit CSI
    ].join('');
    expect(stripAnsi(line)).toBe('linkdonered');
  });

  it('drops control characters but keeps a tab', () => {
    expect(stripAnsi('a\u0007b\u0008c\td')).toBe('abc\td');
  });

  it('drops a sequence cut off at the end of the line', () => {
    expect(stripAnsi(`text${ESC}[31`)).toBe('text');
    expect(stripAnsi(`text${ESC}`)).toBe('text');
  });

  it('merges neighbouring runs printed alike, and never makes an empty run', () => {
    expect(parseAnsi(`${sgr('31')}a${sgr('31')}b${sgr('0')}${sgr('0')}c`)).toEqual([
      { text: 'ab', style: { fg: { hue: 'red', step: '11' } } },
      { text: 'c', style: {} },
    ]);
  });
});

describe('the colour mapping', () => {
  it('puts black and white on gray, white a step quieter', () => {
    expect(standardColor(0)).toEqual({ hue: 'gray', step: '12' });
    expect(standardColor(7)).toEqual({ hue: 'gray', step: '11' });
    expect(standardColor(15)).toEqual({ hue: 'gray', step: '12' });
  });

  it('maps every 256 colour to a hue', () => {
    for (let index = 0; index < 256; index += 1) {
      expect(paletteColor(index), `colour ${index}`).toBeDefined();
    }
  });

  it('keeps grays gray, and the primaries on their hues', () => {
    expect(rgbColor(128, 128, 128)?.hue).toBe('gray');
    expect(rgbColor(250, 250, 250)).toEqual({ hue: 'gray', step: '11' });
    expect(rgbColor(10, 10, 10)).toEqual({ hue: 'gray', step: '12' });
    expect(rgbColor(255, 0, 0)?.hue).toBe('red');
    expect(rgbColor(0, 255, 0)?.hue).toBe('green');
    expect(rgbColor(255, 255, 0)?.hue).toBe('yellow');
    expect(rgbColor(0, 200, 230)?.hue).toBe('cyan');
  });

  it('refuses a channel out of range', () => {
    expect(rgbColor(256, 0, 0)).toBeUndefined();
    expect(rgbColor(-1, 0, 0)).toBeUndefined();
  });
});
