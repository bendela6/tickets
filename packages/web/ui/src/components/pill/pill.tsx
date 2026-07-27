import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { cn } from '../../style';
import { Icon, type IconName } from '../icon';
import { toneClasses, type Tone, type ToneEmphasis } from '../../style';

export function Pill({
  label,
  tone = 'neutral',
  emphasis = 'subtle',
  icon,
  shape = 'md',
  trailing,
  strikethrough,
  onClick,
  pressed,
  disabled,
  className,
}: {
  label: ReactNode;
  tone?: Tone;
  emphasis?: ToneEmphasis;
  icon?: IconName | ReactElement;
  shape?: 'md' | 'full';
  trailing?: ReactNode;
  strikethrough?: boolean;
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {isValidElement(icon) ? icon : icon ? <Icon name={icon} size={10} /> : null}
      {strikethrough ? <s className="line-through">{label}</s> : label}
      {trailing}
    </>
  );
  if (onClick) {
    // Native `disabled` gives correct focus + AT semantics for free — no
    // `aria-disabled` needed alongside it. `cursor-default` (not
    // `pointer-events-none`) since native disabled already blocks activation.
    const classes = cn(
      'inline-flex h-5.5 items-center gap-1.5 px-2.25 font-sans text-meta font-medium',
      shape === 'full' ? 'rounded-full' : 'rounded-md',
      toneClasses(tone, emphasis),
      disabled && 'cursor-default opacity-50',
      className,
    );
    return (
      <button type="button" disabled={disabled} aria-pressed={pressed} onClick={onClick} className={classes}>
        {body}
      </button>
    );
  }
  // No onClick means this is a static `<span>` — a span can't be disabled,
  // so `disabled` is meaningless here and intentionally ignored.
  const classes = cn(
    'inline-flex h-5.5 items-center gap-1.5 px-2.25 font-sans text-meta font-medium',
    shape === 'full' ? 'rounded-full' : 'rounded-md',
    toneClasses(tone, emphasis),
    className,
  );
  return <span className={classes}>{body}</span>;
}
