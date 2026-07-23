import { runtimeStyle } from './runtime-style';
import { SWATCHES } from './swatches';

export const meta = { title: 'Swatches', group: 'Foundation' };

export const states = [
  {
    name: 'presets',
    render: () => (
      <div className="flex gap-2">
        {SWATCHES.map((hex) => (
          <span
            key={hex}
            title={hex}
            className="size-8 rounded-ctrl border border-hairline bg-(--swatch)"
            style={runtimeStyle({ '--swatch': hex })}
          />
        ))}
      </div>
    ),
  },
];
