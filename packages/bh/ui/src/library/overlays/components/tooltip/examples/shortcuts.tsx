import { Button, Tooltip } from '@bh/ui';

const ACTIONS = [
  ['Copy', '⌘C'],
  ['Paste', '⌘V'],
  ['Undo', '⌘Z'],
] as const;

export function Shortcuts() {
  return (
    <div className="flex gap-4">
      {ACTIONS.map(([name, keys]) => {
        return (
          <Tooltip
            key={name}
            content={
              <>
                {name} <span className="text-gray-8 font-mono">{keys}</span>
              </>
            }
          >
            <Button variant="ghost">{name}</Button>
          </Tooltip>
        );
      })}
    </div>
  );
}
