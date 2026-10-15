import type { Hue } from '../../../../../style';
import { paletteColor, rgbColor, standardColor, type AnsiColor } from './ansi-color';

/**
 * How a run of a line was printed, as far as the page can draw it. Every key
 * is unset when the terminal's default applies.
 */
export interface AnsiStyle {
  /** The text's colour. */
  fg?: AnsiColor;
  /** The colour behind the text, drawn at the hue's rung 3. */
  bg?: Hue;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

/** A run of a line's text, all printed the same way. */
export interface AnsiSegment {
  text: string;
  style: AnsiStyle;
}

const ESC = '\u001b';
const BEL = '\u0007';
// The 8-bit form of `ESC [`, which a few programs print in place of the two bytes.
const CSI_8BIT = '\u009b';

/**
 * A line's text as its program printed it, cut into runs at each change of
 * style, with every escape sequence taken out.
 *
 * Select Graphic Rendition (`ESC [ … m`) sets the style: colours 30-37 and
 * 90-97, backgrounds 40-47 and 100-107, 256 colours and 24-bit colours
 * mapped to the nearest hue, bold, dim, italic, underline and strike, and the
 * codes that reset them. Everything else a terminal would act on (cursor
 * moves, erasing, titles, links, character sets) is dropped, never shown,
 * and so are the other control characters, a tab apart.
 *
 * Neighbouring runs printed alike are merged; a run is never empty.
 */
export function parseAnsi(raw: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  let style: AnsiStyle = {};
  let text = '';

  function flush() {
    if (text === '') {
      return;
    }
    const last = segments.at(-1);
    if (last !== undefined && sameStyle(last.style, style)) {
      last.text += text;
    } else {
      segments.push({ text, style });
    }
    text = '';
  }

  let index = 0;
  while (index < raw.length) {
    const char = raw[index] ?? '';
    if (char === ESC || char === CSI_8BIT) {
      const sequence = readEscape(raw, index);
      if (sequence.sgr !== undefined) {
        flush();
        style = applySgr(style, sequence.sgr);
      }
      index = sequence.end;
      continue;
    }
    if (isControl(char)) {
      index += 1;
      continue;
    }
    text += char;
    index += 1;
  }
  flush();
  return segments;
}

/**
 * A line's text with every escape sequence and control character taken out.
 *
 * @param raw The line as it was printed, escape codes and all.
 */
export function stripAnsi(raw: string): string {
  return parseAnsi(raw)
    .map((segment) => segment.text)
    .join('');
}

interface Escape {
  /** Where the text after the sequence starts. */
  end: number;
  /** The parameters of a Select Graphic Rendition sequence, the one kind that is kept. */
  sgr?: string;
}

/**
 * Reads the escape sequence starting at `start`, an ESC or an 8-bit CSI, and
 * says where it ends. A sequence cut off by the end of the line runs to it.
 */
function readEscape(raw: string, start: number): Escape {
  let index = start + 1;
  let introducer = raw[start] === CSI_8BIT ? '[' : raw[index];
  if (raw[start] === ESC) {
    index += 1;
  }
  if (introducer === undefined) {
    return { end: raw.length };
  }

  if (introducer === '[') {
    // Control Sequence: parameter bytes, then intermediate bytes, then one final byte.
    const paramsStart = index;
    while (index < raw.length && inRange(raw, index, 0x30, 0x3f)) {
      index += 1;
    }
    const params = raw.slice(paramsStart, index);
    while (index < raw.length && inRange(raw, index, 0x20, 0x2f)) {
      index += 1;
    }
    if (index >= raw.length) {
      return { end: raw.length };
    }
    const final = raw[index];
    // A byte outside the final range means the sequence was malformed: drop
    // what was read, and let the byte stand as text.
    if (!inRange(raw, index, 0x40, 0x7e)) {
      return { end: index };
    }
    return final === 'm' ? { end: index + 1, sgr: params } : { end: index + 1 };
  }

  if (
    introducer === ']' ||
    introducer === 'P' ||
    introducer === 'X' ||
    introducer === '^' ||
    introducer === '_'
  ) {
    // An operating system command (a title, a link) or a device control
    // string: runs to BEL or to the string terminator, ESC \.
    while (index < raw.length) {
      if (raw[index] === BEL) {
        return { end: index + 1 };
      }
      if (raw[index] === ESC && raw[index + 1] === '\\') {
        return { end: index + 2 };
      }
      index += 1;
    }
    return { end: raw.length };
  }

  // Any other escape: intermediate bytes, then one final byte (`ESC ( B`, `ESC 7`).
  index = start + 1;
  while (index < raw.length && inRange(raw, index, 0x20, 0x2f)) {
    index += 1;
  }
  introducer = raw[index];
  if (introducer !== undefined && inRange(raw, index, 0x30, 0x7e)) {
    index += 1;
  }
  return { end: index };
}

function inRange(raw: string, index: number, low: number, high: number): boolean {
  const code = raw.charCodeAt(index);
  return code >= low && code <= high;
}

/** C0 and C1 control characters and DEL, apart from the tab. */
function isControl(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code < 0x20 && char !== '\t') || code === 0x7f || (code >= 0x80 && code <= 0x9f);
}

/** The style after one Select Graphic Rendition sequence's parameters. */
function applySgr(current: AnsiStyle, params: string): AnsiStyle {
  let style: AnsiStyle = { ...current };
  // `ESC [ m` is a reset, as `ESC [ 0 m` is; an empty parameter is a 0.
  const codes = params === '' ? [''] : params.split(';');
  let index = 0;
  while (index < codes.length) {
    const param = codes[index] ?? '';
    // The colon form packs a code's arguments into one parameter: `38:5:208`, `38:2::255:0:0`.
    const parts = param.split(':');
    const code = parts[0] === '' ? 0 : Number(parts[0]);
    index += 1;

    if (code === 38 || code === 48 || code === 58) {
      let color: AnsiColor | undefined;
      if (parts.length > 1) {
        color = extendedColor(parts.slice(1), true).color;
      } else {
        const read = extendedColor(codes.slice(index), false);
        color = read.color;
        index += read.used;
      }
      // 58 colours the underline, which is not drawn apart from the text.
      if (code === 38) {
        style.fg = color;
      } else if (code === 48) {
        style.bg = color?.hue;
      }
      continue;
    }
    // `4:0` is "no underline"; `4:1` to `4:5` are its kinds, all drawn as one.
    if (code === 4 && parts[1] === '0') {
      style.underline = undefined;
      continue;
    }
    style = code === 0 ? {} : applyCode(style, code);
  }
  return withoutUnset(style);
}

/**
 * One SGR code that takes no arguments, written onto the style being built.
 * Codes nothing here draws are ignored. A key a code turns off is left
 * unset, and dropped when the sequence is done.
 */
function applyCode(style: AnsiStyle, code: number): AnsiStyle {
  if (code === 1) {
    style.bold = true;
  } else if (code === 2) {
    style.dim = true;
  } else if (code === 3) {
    style.italic = true;
  } else if (code === 4 || code === 21) {
    style.underline = true;
  } else if (code === 9) {
    style.strike = true;
  } else if (code === 22) {
    style.bold = undefined;
    style.dim = undefined;
  } else if (code === 23) {
    style.italic = undefined;
  } else if (code === 24) {
    style.underline = undefined;
  } else if (code === 29) {
    style.strike = undefined;
  } else if (code >= 30 && code <= 37) {
    style.fg = standardColor(code - 30);
  } else if (code === 39) {
    style.fg = undefined;
  } else if (code >= 40 && code <= 47) {
    style.bg = standardColor(code - 40).hue;
  } else if (code === 49) {
    style.bg = undefined;
  } else if (code >= 90 && code <= 97) {
    style.fg = standardColor(code - 90 + 8);
  } else if (code >= 100 && code <= 107) {
    style.bg = standardColor(code - 100 + 8).hue;
  }
  return style;
}

/** The style with the keys a code turned off left out, so two alike compare equal. */
function withoutUnset(style: AnsiStyle): AnsiStyle {
  return Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined));
}

/**
 * The arguments of 38, 48 or 58: `5;n` for one of 256 colours, `2;r;g;b` for
 * a 24-bit one. The colon form may put a colour space before r, g and b
 * (`2::r:g:b`), which is skipped. Says how many parameters it read, so the
 * rest of the sequence is read from after them.
 */
function extendedColor(
  args: readonly string[],
  colonForm: boolean,
): { color?: AnsiColor; used: number } {
  const mode = Number(args[0]);
  if (mode === 5) {
    return { color: paletteColor(Number(args[1])), used: 2 };
  }
  if (mode === 2) {
    const channels = colonForm && args.length >= 5 ? args.slice(2, 5) : args.slice(1, 4);
    const [red, green, blue] = channels.map(Number);
    if (red === undefined || green === undefined || blue === undefined) {
      return { used: args.length };
    }
    return { color: rgbColor(red, green, blue), used: 4 };
  }
  return { used: 1 };
}

function sameStyle(a: AnsiStyle, b: AnsiStyle): boolean {
  return (
    a.fg?.hue === b.fg?.hue &&
    a.fg?.step === b.fg?.step &&
    a.bg === b.bg &&
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strike === b.strike
  );
}
