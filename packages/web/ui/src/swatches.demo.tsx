import { runtimeStyle } from './runtime-style';
import { SWATCHES } from './swatches';

// `impl` is spelled out because this is the one demo whose component is a
// `.ts` file — the default convention looks for `swatches.tsx`.
export const meta = { title: 'Swatches', group: 'Foundation', size: 'lg', impl: './swatches.ts' };

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
