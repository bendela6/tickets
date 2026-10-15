// What the panel's bars share: the reveal on hover, the rule between groups of
// controls, and the square icon button every control is.

import type { ReactElement, Ref } from 'react';
import { Button, type IconName, type Tone } from '@bh/ui';

/**
 * Shown on hover, on focus inside, and always where nothing hovers (touch):
 * the controls stay out of the example's way until a reader reaches for them.
 */
export const REVEAL =
  'opacity-0 transition-opacity duration-150 group-hover/panel:opacity-100 group-focus-within/panel:opacity-100 pointer-coarse:opacity-100';

/** A thin upright rule between groups of controls. */
export function Divider() {
  return <span aria-hidden className="bg-gray-6 mx-6 h-16 w-1" />;
}

/** Props for PanelAction. */
interface PanelActionProps {
  label: string;
  /** Neutral unless it is saying something, as a copy that worked, or failed. */
  tone?: Tone;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  /** In a bar: a size down. */
  small?: boolean;
  onClick: () => void;
  /** The glyph: an icon's name, or an element for one the registry lacks. */
  icon: IconName | ReactElement;
}

/** A square icon button, named by its tooltip. */
export function PanelAction({
  label,
  tone = 'neutral',
  disabled = false,
  small = false,
  buttonRef,
  onClick,
  icon,
}: PanelActionProps) {
  return (
    <Button
      variant="ghost"
      tone={tone}
      size={small ? 'xs' : 'sm'}
      ref={buttonRef}
      icon={icon}
      label={label}
      disabled={disabled}
      onClick={onClick}
    />
  );
}
