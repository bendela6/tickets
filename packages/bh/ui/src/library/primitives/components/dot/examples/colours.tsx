import { Dot } from '@bh/ui';

const HUES = ['blue', 'green', 'orange', 'purple', 'teal'];

export function Colours() {
  return (
    <div className="flex items-center gap-12">
      {HUES.map((hue) => {
        return <Dot key={hue} color={`var(--color-${hue}-9)`} />;
      })}
      <Dot color="#e5484d" />
      <Dot color="color-mix(in oklab, var(--color-blue-9), var(--color-green-9))" />
    </div>
  );
}
