import type { Tone } from '../../../../../style';
import { Button } from '../../button';
import type { IconName } from '../../icon';

/** A toolbar tool: an icon-only `Button`, quiet in the strip, named by its label, which is its tooltip. */
export function ToolButton({
  icon,
  label,
  tone = 'neutral',
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  /** Neutral unless it is saying something: the copy turns green, or red when it failed. */
  tone?: Tone;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      tone={tone}
      size="xs"
      icon={icon}
      label={label}
      disabled={disabled}
      onClick={onClick}
    />
  );
}
