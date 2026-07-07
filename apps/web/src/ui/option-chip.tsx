import { cn } from './cn';

export type OptionColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'gray';

const colorClasses: Record<OptionColor, string> = {
  red: 'bg-opt-red-subtle text-opt-red',
  orange: 'bg-opt-orange-subtle text-opt-orange',
  yellow: 'bg-opt-yellow-subtle text-opt-yellow',
  green: 'bg-opt-green-subtle text-opt-green',
  teal: 'bg-opt-teal-subtle text-opt-teal',
  cyan: 'bg-opt-cyan-subtle text-opt-cyan',
  blue: 'bg-opt-blue-subtle text-opt-blue',
  indigo: 'bg-opt-indigo-subtle text-opt-indigo',
  purple: 'bg-opt-purple-subtle text-opt-purple',
  pink: 'bg-opt-pink-subtle text-opt-pink',
  gray: 'bg-opt-gray-subtle text-opt-gray',
};

export function OptionChip({
  color,
  label,
  className,
}: {
  color: OptionColor;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center rounded-full px-2.5 font-sans text-meta font-medium',
        colorClasses[color],
        className,
      )}
    >
      {label}
    </span>
  );
}
