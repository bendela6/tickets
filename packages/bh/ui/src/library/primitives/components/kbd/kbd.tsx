import { Fragment, useSyncExternalStore, type HTMLAttributes } from 'react';
import { cn, variants } from '../../../../style';
import { faceOf, isApplePlatform, keysOf, type KbdPlatform } from './keys';

/** How the keys are drawn: on a raised cap, on a cap tinted from the colour around it, or as text alone. */
export type KbdVariant = 'raised' | 'tint' | 'text';

/** The cap's height and type size, as one step: 16, 18 and 20 pixels. */
export type KbdSize = 'sm' | 'md' | 'lg';

// The type size is every variant's; the cap is only drawn by the two that
// have one. `tint` and `text` take their colour from what they sit in, since
// a menu row or a tooltip has already chosen it.
const kbdClass = variants({
  base: 'font-mono font-500 whitespace-nowrap',
  config: {
    variant: {
      default: 'raised',
      options: {
        // The design's key cap: a raised surface on the strong border, its
        // bottom edge doubled so it reads as a key and not as a tag.
        raised: 'border-gray-7 bg-surface-raised text-gray-10',
        // For a surface with a colour of its own, such as a Tooltip's
        // inverted one, where a raised cap would read as a hole in it.
        tint: 'border-current/30 bg-current/10',
        text: 'inline-flex items-baseline',
      },
    },
    size: {
      default: 'md',
      options: {
        sm: 'text-10',
        md: 'text-11',
        lg: 'text-12',
      },
    },
  },
});

// The cap, for `raised` and `tint`. `leading-none` comes after the type size,
// so tailwind-merge keeps both, and centres the glyphs in the cap rather than
// the line box the text would otherwise bring.
const capClass = variants({
  base: 'rounded-4 inline-flex items-center justify-center border-1 border-b-2 leading-none',
  config: {
    size: {
      default: 'md',
      options: {
        sm: 'h-16 min-w-16 px-3',
        md: 'h-18 min-w-18 px-4',
        lg: 'h-20 min-w-20 px-5',
      },
    },
  },
});

// Nothing changes the platform while the page is open, so there is nothing to
// subscribe to: the store is read once, and a server render says `other`.
function subscribe() {
  return () => {};
}

function usePlatform(platform: KbdPlatform | undefined): KbdPlatform {
  const apple = useSyncExternalStore(subscribe, isApplePlatform, () => false);
  return platform ?? (apple ? 'apple' : 'other');
}

// `children` is omitted because the content is `keys`: the component names
// each key for the platform, which a string it was handed could not be.
export type KbdProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /**
   * The key, or the keys of a chord: `['mod', 'K']`, or the same as a string
   * with `+` between them, `'mod+K'`. `mod` is Command on a Mac and Control
   * elsewhere; `shift`, `alt`, `ctrl`, `enter`, `esc`, `tab`, `backspace`,
   * `delete`, `space` and the arrows (`up`) are named the platform's way too.
   * A single letter is drawn in capitals, anything else as written.
   */
  keys: string | readonly string[];
  /** How the keys are drawn: a raised cap, a cap tinted from the colour around it, or text alone. */
  variant?: KbdVariant;
  /** The cap's height and type size: 16, 18 and 20 pixels. */
  size?: KbdSize;
  /** Whose names to draw: Apple's glyphs, or a PC's words. Unset, the reader's own. */
  platform?: KbdPlatform;
  /** Added to the outer `<kbd>`'s classes. */
  className?: string;
};

/**
 * A key hint: one key, or a chord, drawn as a key cap. It only shows the key;
 * the app binds it.
 *
 * A chord is one `<kbd>` holding a `<kbd>` for each key, as HTML writes a key
 * combination. A Mac's glyphs are set side by side (`⌘K`) and a PC's words
 * joined with `+` (`Ctrl+K`). A glyph is spoken as its word, and the `+` is
 * there for a screen reader on a Mac too.
 */
export function Kbd({
  keys,
  variant = 'raised',
  size = 'md',
  platform,
  className,
  ...rest
}: KbdProps) {
  const apple = usePlatform(platform) === 'apple';
  return (
    <kbd
      className={kbdClass({
        variant,
        size,
        className: cn(variant === 'text' ? undefined : capClass({ size }), className),
      })}
      {...rest}
    >
      {keysOf(keys).map((key, index) => {
        const face = faceOf(key, apple ? 'apple' : 'other');
        return (
          <Fragment key={index}>
            {index > 0 ? <span className={apple ? 'sr-only' : undefined}>+</span> : null}
            <kbd>
              {face.spoken ? (
                <>
                  <span aria-hidden="true">{face.shown}</span>
                  <span className="sr-only">{face.spoken}</span>
                </>
              ) : (
                face.shown
              )}
            </kbd>
          </Fragment>
        );
      })}
    </kbd>
  );
}
