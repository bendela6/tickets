import { isApplePlatform, keysOf } from '../../../primitives/components/kbd/keys';

// The modifier each name in a chord asks for; `mod` is the platform's own.
const MODIFIERS = {
  mod: 'mod',
  ctrl: 'ctrlKey',
  control: 'ctrlKey',
  alt: 'altKey',
  option: 'altKey',
  opt: 'altKey',
  shift: 'shiftKey',
  meta: 'metaKey',
  cmd: 'metaKey',
  command: 'metaKey',
} as const;

type Modifier = 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey';

/**
 * Whether a keydown is the chord `keys` names, as `Kbd` draws it: `'/'`,
 * `'mod+K'`. Every modifier it names must be held, and Control, Alt and Meta
 * must not be held unless named, so `/` is not Ctrl+/. Shift is left alone
 * unless named, since on many layouts it is how a key like `?` is typed.
 */
export function isShortcut(event: KeyboardEvent, keys: string, apple = isApplePlatform()) {
  const parts = keysOf(keys);
  const key = parts.at(-1);
  if (event.key.toLowerCase() !== key?.toLowerCase()) {
    return false;
  }
  const wanted = new Set<Modifier>();
  for (const part of parts.slice(0, -1)) {
    const name = MODIFIERS[part.toLowerCase() as keyof typeof MODIFIERS] as
      Modifier | 'mod' | undefined;
    if (name === undefined) {
      return false;
    }
    wanted.add(name === 'mod' ? (apple ? 'metaKey' : 'ctrlKey') : name);
  }
  const held: Modifier[] = ['ctrlKey', 'altKey', 'metaKey'];
  return (
    [...wanted].every((modifier) => event[modifier]) &&
    held.every((modifier) => wanted.has(modifier) || !event[modifier])
  );
}

/** Whether focus is in a field of some kind, where a key types rather than jumps. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
