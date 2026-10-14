// What a key is called on each platform, and how a chord is written as data.
// Pure, so the tests can read every name without rendering.

/**
 * Whose names the keys are drawn with: Apple's glyphs (`⌘`, `⇧`, `⌥`), or the
 * words a PC keyboard prints (`Ctrl`, `Shift`, `Alt`).
 */
export type KbdPlatform = 'apple' | 'other';

/** One key as a cap shows it, and what a screen reader says when it shows a glyph. */
export interface KeyFace {
  shown: string;
  spoken?: string;
}

// [apple, other]. A name is looked up lower-cased, so `Shift`, `shift` and
// `SHIFT` are one key. `mod` is the one most shortcuts want: Command on a Mac,
// Control elsewhere, the way an app binds `metaKey` or `ctrlKey` by platform.
const NAMED: Record<string, readonly [apple: string, other: string]> = {
  mod: ['⌘', 'Ctrl'],
  meta: ['⌘', 'Win'],
  cmd: ['⌘', 'Win'],
  command: ['⌘', 'Win'],
  ctrl: ['⌃', 'Ctrl'],
  control: ['⌃', 'Ctrl'],
  alt: ['⌥', 'Alt'],
  option: ['⌥', 'Alt'],
  opt: ['⌥', 'Alt'],
  shift: ['⇧', 'Shift'],
  enter: ['↵', 'Enter'],
  return: ['↵', 'Enter'],
  // Each as its keyboard prints it: a Mac's is lower-case.
  esc: ['esc', 'Esc'],
  escape: ['esc', 'Esc'],
  tab: ['⇥', 'Tab'],
  backspace: ['⌫', 'Backspace'],
  delete: ['⌦', 'Del'],
  del: ['⌦', 'Del'],
  space: ['Space', 'Space'],
  up: ['↑', '↑'],
  down: ['↓', '↓'],
  left: ['←', '←'],
  right: ['→', '→'],
  arrowup: ['↑', '↑'],
  arrowdown: ['↓', '↓'],
  arrowleft: ['←', '←'],
  arrowright: ['→', '→'],
  home: ['Home', 'Home'],
  end: ['End', 'End'],
  pageup: ['PgUp', 'PgUp'],
  pagedown: ['PgDn', 'PgDn'],
};

// A glyph alone is not something every screen reader can say, so each is
// spoken as its word. Keyed by the glyph, so `⌘` written by hand is named too.
const SPOKEN: Record<string, string> = {
  '⌘': 'Command',
  '⌃': 'Control',
  '⌥': 'Option',
  '⇧': 'Shift',
  '↵': 'Return',
  '⇥': 'Tab',
  '⌫': 'Delete',
  '⌦': 'Forward Delete',
  '↑': 'Up Arrow',
  '↓': 'Down Arrow',
  '←': 'Left Arrow',
  '→': 'Right Arrow',
};

/**
 * A chord as its keys. An array is the keys already; a string has `+` between
 * them (`mod+K`), as data holds a shortcut. A `+` with nothing on one side is
 * the key itself, so `+` and `Ctrl++` read as written.
 */
export function keysOf(keys: string | readonly string[]): string[] {
  return typeof keys === 'string' ? keys.split(/(?<=.)\+(?=.)/) : [...keys];
}

/**
 * One key as `platform` names it. A name the table knows is drawn the
 * platform's way, a single letter in capitals, and anything else as written:
 * `F5`, `/`, `?`.
 */
export function faceOf(key: string, platform: KbdPlatform): KeyFace {
  const spoken = (shown: string): KeyFace => {
    const word = SPOKEN[shown];
    return word ? { shown, spoken: word } : { shown };
  };
  const named = NAMED[key.toLowerCase()];
  if (named) {
    return spoken(named[platform === 'apple' ? 0 : 1]);
  }
  return spoken(/^[a-z]$/.test(key) ? key.toUpperCase() : key);
}

/** True on Apple platforms, where `mod` is Command rather than Control. */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}
