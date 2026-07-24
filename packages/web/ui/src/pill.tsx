import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './icons/icon';
import { toneClasses, type Tone, type ToneEmphasis } from './tones';

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
  className?: string;
}) {
  const classes = cn(
    'inline-flex h-5.5 items-center gap-1.5 px-2.25 font-sans text-meta font-medium',
    shape === 'full' ? 'rounded-full' : 'rounded-md',
    toneClasses(tone, emphasis),
    className,
  );
  const body = (
    <>
      {isValidElement(icon) ? icon : icon ? <Icon name={icon} size={10} /> : null}
      {strikethrough ? <s className="line-through">{label}</s> : label}
      {trailing}
    </>
  );
  if (onClick) {
    return (
      <button type="button" aria-pressed={pressed} onClick={onClick} className={classes}>
        {body}
      </button>
    );
  }
  return <span className={classes}>{body}</span>;
}
