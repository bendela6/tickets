import { useEffect, useLayoutEffect, useRef } from 'react';

/** What a key does: called with the `keydown` it matched, whose default is already prevented. */
export type HotkeyHandler = (event: KeyboardEvent) => void;

/** What `useHotkeys` takes. */
export interface UseHotkeysOptions {
  /**
   * Each key and what it does. A key is written as `Kbd` writes it, with `+`
   * between the keys of a chord: `mod+k`, `shift+mod+z`, `/`, `escape`,
   * `alt+up`. `mod` is Command on a Mac and Control elsewhere.
   */
  keys: Readonly<Record<string, HotkeyHandler>>;
  /** Whether the keys work. `true` unless given. */
  enabled?: boolean;
  /** Whether they work while the reader types in a field too, as a search's `mod+k` does. `false` unless given. */
  whileTyping?: boolean;
  /** Whether a key held down calls again as it repeats, as moving through a list wants. `false` unless given. */
  repeat?: boolean;
}

/** A key as it is written, read: its modifiers, and the key itself as `KeyboardEvent.key` names it. */
interface Chord {
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** Lower-cased, so a letter matches with or without Shift's capital. */
  key: string;
}

// The names `Kbd` draws, as the `key` a keyboard event carries, lower-cased.
const NAMED: Readonly<Record<string, string>> = {
  esc: 'escape',
  escape: 'escape',
  enter: 'enter',
  return: 'enter',
  space: ' ',
  tab: 'tab',
  backspace: 'backspace',
  delete: 'delete',
  del: 'delete',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  arrowup: 'arrowup',
  arrowdown: 'arrowdown',
  arrowleft: 'arrowleft',
  arrowright: 'arrowright',
  home: 'home',
  end: 'end',
  pageup: 'pageup',
  pagedown: 'pagedown',
};

function isApple(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** A chord as its keys, `+` between them; a `+` with nothing on one side is the key itself. */
function chordOf(written: string, apple: boolean): Chord {
  const chord: Chord = { meta: false, ctrl: false, alt: false, shift: false, key: '' };
  for (const part of written.split(/(?<=.)\+(?=.)/)) {
    const name = part.toLowerCase();
    if (name === 'mod') {
      chord[apple ? 'meta' : 'ctrl'] = true;
    } else if (name === 'meta' || name === 'cmd' || name === 'command') {
      chord.meta = true;
    } else if (name === 'ctrl' || name === 'control') {
      chord.ctrl = true;
    } else if (name === 'alt' || name === 'option' || name === 'opt') {
      chord.alt = true;
    } else if (name === 'shift') {
      chord.shift = true;
    } else {
      chord.key = NAMED[name] ?? name;
    }
  }
  return chord;
}

const isLetter = (key: string) => /^[a-z]$/.test(key);
const isNamed = (key: string) => key.length > 1;

/** Whether `event` is `chord`. */
function matches(chord: Chord, event: KeyboardEvent): boolean {
  if (
    event.metaKey !== chord.meta ||
    event.ctrlKey !== chord.ctrl ||
    event.altKey !== chord.alt ||
    // A symbol is matched as it is typed, `?` with the Shift it takes; a
    // letter or a named key says whether Shift is held.
    ((isLetter(chord.key) || isNamed(chord.key) || chord.shift) && event.shiftKey !== chord.shift)
  ) {
    return false;
  }
  const key = event.key.toLowerCase();
  if (key === chord.key) {
    return true;
  }
  // A letter typed with Option on a Mac, or on a keyboard that writes
  // another alphabet, is known by the key it is on.
  return (
    isLetter(chord.key) &&
    !/^[\x20-\x7e]$/.test(key) &&
    event.code === `Key${chord.key.toUpperCase()}`
  );
}

// What a field takes as typing: every key, which a hotkey must not take from it.
const FIELD =
  'textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"]';
const NOT_TYPED = new Set([
  'button',
  'checkbox',
  'radio',
  'submit',
  'reset',
  'image',
  'range',
  'color',
  'file',
]);
// What a control does with Enter and Space, and the arrows, itself.
const PRESSED =
  'button, a[href], summary, input, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="treeitem"]';
const STEPPED =
  'input[type="range"], [role="slider"], [role="separator"], [role="listbox"], [role="option"], [role="menu"], [role="menubar"], [role="menuitem"], [role="tablist"], [role="tab"], [role="radiogroup"], [role="radio"], [role="tree"], [role="treeitem"], [role="grid"], [role="gridcell"], [role="scrollbar"]';
const STEPS = new Set([
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'home',
  'end',
  'pageup',
  'pagedown',
]);

/** Whether the reader is typing into `element`, a field that takes keys as text. */
function isTyping(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    return !NOT_TYPED.has(element.type);
  }
  return element.closest(FIELD) !== null;
}

/** Whether the focused element uses a key with no modifier itself: Enter and Space on a button, the arrows on a slider. */
function usesKey(element: Element, key: string): boolean {
  if (key === 'enter' || key === ' ') {
    return element.closest(PRESSED) !== null;
  }
  return STEPS.has(key) && element.closest(STEPPED) !== null;
}

/**
 * Keys that work anywhere on the page: `mod+k` to search, `/` to find, `?`
 * for help. A key the focused element uses itself is left to it: anything
 * typed into a field, unless `whileTyping`; Enter and Space on a button or a
 * link; the arrows on a slider, a list or a menu. So is a key another
 * handler has already prevented, one typed while an input method composes,
 * and, unless `repeat`, a key held down as it repeats.
 *
 * A matched key's default is prevented, so the browser's own `mod+k` does
 * not run too. The handlers are read when a key is pressed, so they need no
 * memoising. It draws nothing and wires nothing: it listens on the window.
 */
export function useHotkeys({
  keys,
  enabled = true,
  whileTyping = false,
  repeat = false,
}: UseHotkeysOptions): void {
  // What the listener reads when a key is pressed, written after each commit.
  const live = useRef({ keys, whileTyping, repeat });
  useLayoutEffect(() => {
    live.current = { keys, whileTyping, repeat };
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const now = live.current;
      if (event.defaultPrevented || event.isComposing || (event.repeat && !now.repeat)) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
      if (target && !now.whileTyping && isTyping(target)) {
        return;
      }
      if (target && plain && usesKey(target, event.key.toLowerCase())) {
        return;
      }
      const apple = isApple();
      for (const [written, handler] of Object.entries(now.keys)) {
        if (matches(chordOf(written, apple), event)) {
          event.preventDefault();
          handler(event);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
