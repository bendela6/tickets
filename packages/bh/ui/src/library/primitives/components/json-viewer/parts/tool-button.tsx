import { cn } from '../../../../../style/cn';
import { Icon, type IconName } from '../../icon';

/** A header control: quiet enough to sit in a 26px strip, still a real button. */
export function ToolButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  /** Optional: undo and redo have no glyph in the set, and read fine as words. */
  icon?: IconName;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-10 rounded-4 inline-flex shrink-0 items-center gap-4 px-6 py-3 font-mono',
        disabled
          ? 'text-gray-8 cursor-default'
          : 'text-gray-11 hover:text-gray-12 hover:bg-gray-3 cursor-pointer',
      )}
    >
      {icon !== undefined && <Icon name={icon} size="2xs" />}
      {label}
    </button>
  );
}
