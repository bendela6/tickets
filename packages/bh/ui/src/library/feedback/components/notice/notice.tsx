import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { axis, HUES, over, TONE_HUE, variants, type Role } from '../../../../style';
import { Icon, type IconName, type IconSize } from '../../../primitives/components/icon';

/**
 * What a notice says about its message, in bh's role names: `neutral` a note
 * in passing, `primary` information in the accent, `success` that something
 * worked, `warning` that something needs care, and `danger` an error.
 */
export type NoticeTone = Extract<Role, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'>;

/** The type, padding and glyph as one step: 12, 13 and 15 pixel type. */
export type NoticeSize = 'sm' | 'md' | 'lg';

// Each tone owns a glyph as well as a colour, so what a notice says survives a
// reader who can't tell its red from its green — the rule the design's status
// kinds keep. `neutral` and `primary` both inform; they differ in weight, not
// in kind, so they share one.
const GLYPH: Record<NoticeTone, IconName> = {
  neutral: 'circle-info',
  primary: 'circle-info',
  success: 'circle-check',
  warning: 'triangle-alert',
  danger: 'circle-x',
};

// The glyph's name to a screen reader, read before the message: the colour and
// the shape say it to everyone else. English, as bh's other default labels
// are; `iconLabel` takes the app's own word.
const WORD: Record<NoticeTone, string> = {
  neutral: 'Note',
  primary: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Error',
};

const GLYPH_SIZE: Record<NoticeSize, IconSize> = { sm: 'md', md: 'lg', lg: 'xl' };

// Which ramp the notice paints from. `scale` is the prop it surfaces as; the
// tone resolves to it through TONE_HUE.
const SCALE = axis('scale', HUES, 'gray');

// design-system.html §11, Callouts: a tinted fill and a toned leading icon,
// radius 8, no border, no left bar. The fill is the subtle pair, 3 under 11,
// which every scale holds to the same contrast; the glyph takes the text's
// colour. §1f's all-clear row sets the md step: 13px type, a 16px glyph, 10
// between them, 14 in from the sides.
const noticeClass = variants({
  base: 'flex items-start rounded-8 font-sans',
  config: {
    fill: {
      default: 'tint',
      options: { tint: over(SCALE, (hue) => `bg-${hue}-3 text-${hue}-11`) },
    },
    size: {
      default: 'md',
      options: {
        sm: 'gap-8 px-10 py-8 text-12/17',
        md: 'gap-10 px-14 py-12 text-13/19',
        lg: 'gap-12 p-16 text-15/24',
      },
    },
  },
});

// The glyph's box is one line of the message tall, so the glyph sits on the
// first line's middle however many lines follow, and whether a title or the
// message comes first.
const markClass = variants({
  base: 'flex shrink-0 items-center',
  config: {
    size: { default: 'md', options: { sm: 'h-17', md: 'h-19', lg: 'h-24' } },
  },
});

// The actions go under the message rather than beside it: a button is taller
// than a line of text, and beside a one-line message it would either stretch
// the notice or sit off the glyph's line. Under it, they wrap on a phone too.
const actionsClass = variants({
  base: 'flex flex-wrap items-center gap-8',
  config: {
    size: { default: 'md', options: { sm: 'pt-4', md: 'pt-6', lg: 'pt-8' } },
  },
});

// `title` is the notice's own line, so the DOM attribute of that name is left
// out; `children` is the message, typed here; `color` because the colour is
// the tone's.
export type NoticeProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children' | 'color'> & {
  /** What it says about the message, in a colour and a glyph of its own: a note, information, a success, a warning or an error. */
  tone?: NoticeTone;
  /** A line in bold above the message. */
  title?: ReactNode;
  /** The message. A string keeps its line breaks, so an error in a server's own words keeps its lines. */
  children?: ReactNode;
  /** What to do about it, under the message: a button, a link, or a few of them. */
  action?: ReactNode;
  /**
   * Announces the notice to a screen reader as it appears, for one that answers
   * something the reader just did, such as a save that failed. A `danger`
   * notice interrupts, as an alert; any other waits its turn, as a status.
   * Leave it off for a notice that stands on the page: it is read in its place.
   */
  announce?: boolean;
  /** A glyph from the registry in place of the tone's own. */
  icon?: IconName;
  /** What a screen reader calls the glyph, before the message. Unset, it is the tone's word: Note, Info, Success, Warning or Error. */
  iconLabel?: string;
  /** Type, padding and glyph together: 12, 13 and 15 pixel type. `lg` is for a screen read at arm's length, such as a phone at a counter. */
  size?: NoticeSize;
  /** Added to the notice's own classes. */
  className?: string;
};

/**
 * A box with a tone for a message on a page: a note, information, a success,
 * a warning or an error, with an optional title and actions.
 *
 * Not a live region unless `announce` makes it one, because most notices are
 * on the page from its first render, and a live region there would read them
 * out over whatever the reader was doing. Passes other props to its `<div>`,
 * so `role`, `id` and `aria-*` reach it; a `role` given wins over the one
 * `announce` sets.
 */
export const Notice = forwardRef<HTMLDivElement, NoticeProps>(function Notice(
  {
    tone = 'neutral',
    title,
    children,
    action,
    announce = false,
    icon,
    iconLabel,
    size = 'md',
    className,
    ...rest
  },
  ref,
) {
  // `alert` for an error the reader caused, since they are waiting on the
  // outcome; `status` for the rest, which can wait for a pause.
  const live = tone === 'danger' ? 'alert' : 'status';
  return (
    <div
      ref={ref}
      role={announce ? live : undefined}
      className={noticeClass({ size, scale: TONE_HUE[tone], className })}
      {...rest}
    >
      <span className={markClass({ size })}>
        <Icon name={icon ?? GLYPH[tone]} size={GLYPH_SIZE[size]} label={iconLabel ?? WORD[tone]} />
      </span>
      {/*
        `wrap-anywhere`, not `wrap-break-word`: both break a URL that would
        run out of the box, but only `anywhere` lets it count as breakable
        when the box is sized to its content, as in a flex row or a centred
        column, where `break-word` still made the box as wide as the URL.
        != null rather than truthiness below, so a message of 0 is shown.
      */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 wrap-anywhere">
        {title != null ? <div className="font-600">{title}</div> : null}
        {children != null ? <div className="whitespace-pre-line">{children}</div> : null}
        {action != null ? <div className={actionsClass({ size })}>{action}</div> : null}
      </div>
    </div>
  );
});
