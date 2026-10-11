import { Icon, ICON_NAMES } from '@bh/ui';

export function Registry() {
  return (
    <div className="flex flex-wrap gap-16">
      {ICON_NAMES.map((name) => {
        return (
          <div key={name} className="text-gray-11 flex w-80 flex-col items-center gap-6">
            <Icon name={name} size="lg" />
            <span className="text-10 text-gray-11 font-mono">{name}</span>
          </div>
        );
      })}
    </div>
  );
}
