import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../../../../style/cn';
import { Icon, type IconName } from '../../../primitives/components/icon';
import { TONE_HUE, type Tone } from '../../../../style/tones';
import { Spinner } from '../spinner';

// The shared shell for what a screen shows in place of its content: an
// optional tone-colored icon disc, a title, optional body copy, and an
// optional action (Retry button, link, etc). Retires six near-verbatim copies
// of the signals error+Retry block plus assorted list-empty states, and, with
// `state="loading"`, the apps' own centred spinners and "Loading…" lines.
//
// Every state draws the same box, the same column and the same disc, so a
// screen that goes from loading to empty or to an error keeps its height: the
// spinner sits where the icon would, in a disc of the same size.

/**
 * How long the loading state waits before it shows, in milliseconds. A load
 * that answers inside it never shows a spinner at all, so a fast screen
 * doesn't flash one; a slower one shows it before the wait reads as nothing
 * happening.
 */
const LOADING_DELAY = 400;

/** A screen that says what happened in place of its content: empty, not found, or an error. */
type MessageProps = {
  /** `loading` while the content is on its way. Unset, the block says what happened in its place. */
  state?: never;
  /** One line saying what happened, required; while loading, what is on its way, `Loading…` unless set. */
  title: ReactNode;
  /** A mark above the title, in a disc of the tone. No disc without it; while loading, the spinner takes its place. */
  icon?: IconName;
  /**
   * While loading, how long it waits before it shows, in milliseconds, so a load that answers sooner never flashes it.
   * @default 400
   */
  delay?: never;
} & Shared;

/** A screen whose content is on its way. */
type LoadingProps = {
  /** `loading` while the content is on its way. Unset, the block says what happened in its place. */
  state: 'loading';
  /** One line saying what happened, required; while loading, what is on its way, `Loading…` unless set. */
  title?: ReactNode;
  /** A mark above the title, in a disc of the tone. No disc without it; while loading, the spinner takes its place. */
  icon?: never;
  /**
   * While loading, how long it waits before it shows, in milliseconds, so a load that answers sooner never flashes it.
   * @default 400
   */
  delay?: number;
} & Shared;

/** What every state takes, meaning the same in each. */
interface Shared {
  /**
   * Which ramp the disc paints from: a role, or a hue by name.
   * @default 'neutral'
   */
  tone?: Tone;
  /** A line or two under the title. */
  body?: ReactNode;
  /** Something to do about it, under the body: a button or a link. */
  action?: ReactNode;
  /** Added to the outer block's classes. */
  className?: string;
}

export type ScreenStateProps = MessageProps | LoadingProps;

// The parts, written once for every state.
const BOX = 'flex flex-col items-center gap-8 px-24 py-40 text-center';
const TITLE = 'text-13/19 font-600 text-gray-12';
const BODY = 'text-12/17 text-gray-11 max-w-360';
const ACTION = 'mt-4';

/** The disc a mark sits in, in the subtle pair of the tone: 3 fills, 11 texts. */
function discClass(tone: Tone) {
  return cn(
    'flex size-30 items-center justify-center rounded-full',
    `bg-${TONE_HUE[tone]}-3 text-${TONE_HUE[tone]}-11`,
  );
}

/** What a screen shows in place of its content: loading, empty, not found, or an error. */
export function ScreenState(props: ScreenStateProps) {
  return props.state === 'loading' ? <Loading {...props} /> : <Message {...props} />;
}

function Message({ title, icon, tone = 'neutral', body, action, className }: MessageProps) {
  return (
    <div className={cn(BOX, className)}>
      {icon ? (
        <span className={discClass(tone)}>
          <Icon name={icon} size="md" />
        </span>
      ) : null}
      <div className={TITLE}>{title}</div>
      {/* != null (not truthiness) — a numeric 0 body/action is real content
      and must render, not get swallowed like an unset one. */}
      {body != null ? <div className={BODY}>{body}</div> : null}
      {action != null ? <div className={ACTION}>{action}</div> : null}
    </div>
  );
}

/** Whether `delay` milliseconds have passed since the first render. Once true, it stays true. */
function useShownAfter(delay: number): boolean {
  const [shown, setShown] = useState(() => delay <= 0);
  useEffect(() => {
    if (shown) {
      return undefined;
    }
    const timer = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(timer);
  }, [shown, delay]);
  return shown;
}

// Until the delay is up, every part is drawn but invisible, so the block
// already holds the height it shows at and nothing under it moves when it
// appears. The `status` region is there from the first render, holding
// nothing a screen reader can reach; the words go into it when the delay is
// up, as a new node, which is what a live region announces. The block itself
// is `aria-busy`: it stands for content still on its way.
function Loading({
  title = 'Loading…',
  tone = 'neutral',
  body,
  action,
  delay = LOADING_DELAY,
  className,
}: LoadingProps) {
  const shown = useShownAfter(delay);
  const veil = shown ? undefined : 'invisible';
  return (
    <div aria-busy="true" className={cn(BOX, className)}>
      <span className={cn(discClass(tone), veil)}>
        {/* Unnamed, since the title says what is loading. A reader who asked
        for less motion sees it fade in place instead of turning. */}
        <Spinner label="" className="motion-reduce:animate-pulse" />
      </span>
      <div role="status">
        <div
          key={shown ? 'shown' : 'waiting'}
          aria-hidden={shown ? undefined : true}
          className={cn('flex flex-col items-center gap-8', veil)}
        >
          <div className={TITLE}>{title}</div>
          {body != null ? <div className={BODY}>{body}</div> : null}
        </div>
      </div>
      {action != null ? <div className={cn(ACTION, veil)}>{action}</div> : null}
    </div>
  );
}
