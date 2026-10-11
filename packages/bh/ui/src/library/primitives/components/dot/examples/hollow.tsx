import { Dot } from '@bh/ui';

export function Hollow() {
  return (
    <div className="flex items-center gap-12">
      <Dot color="var(--color-blue-9)" />
      <Dot color="var(--color-blue-9)" hollow />
    </div>
  );
}
