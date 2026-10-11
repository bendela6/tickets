import { Button, Tooltip } from '@bh/ui';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

export function Sides() {
  return (
    <div className="flex gap-8">
      {SIDES.map((side) => {
        return (
          <Tooltip key={side} content={`On the ${side}`} side={side}>
            <Button>{side}</Button>
          </Tooltip>
        );
      })}
    </div>
  );
}
