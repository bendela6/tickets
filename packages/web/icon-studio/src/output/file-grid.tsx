import type { IconDoc } from '../doc';
import { dataUri } from '../generate/raster';
import { renderSvg, SAFE_ZONE_PCT, safeZonePct } from '../generate/render';

interface Row {
  file: string;
  use: string;
  svg: string;
  sizes: number[];
  ground: 'light' | 'dark' | 'checker';
}

function rows(doc: IconDoc): Row[] {
  return [
    { file: 'favicon.svg', use: 'Browser tab. Swaps triad by theme.', svg: renderSvg(doc, 'favicon'), sizes: [16, 32, 48], ground: 'checker' },
    { file: 'icon-512.png', use: 'PWA install. Maskable chip.', svg: renderSvg(doc, 'chip'), sizes: [64, 128], ground: 'checker' },
    { file: 'icon-192.png', use: 'Android home screen. Maskable chip.', svg: renderSvg(doc, 'chip'), sizes: [48, 96], ground: 'checker' },
    { file: 'apple-touch-icon.png', use: 'iOS home screen. Square — iOS masks it.', svg: renderSvg(doc, 'apple'), sizes: [60, 120], ground: 'checker' },
    { file: 'icon-mono.svg', use: 'Safari pinned tab.', svg: renderSvg(doc, 'mono'), sizes: [16, 32], ground: 'light' },
    { file: 'site.webmanifest', use: 'Install metadata. Points at the chip icons above.', svg: renderSvg(doc, 'chip'), sizes: [32], ground: 'dark' },
  ];
}

const BG: Record<Row['ground'], string> = {
  light: 'bg-white',
  dark: 'bg-gray-12',
  checker: 'bg-surface-inset',
};

export function FileGrid({ doc }: { doc: IconDoc }) {
  return (
    <div className="grid gap-12 md:grid-cols-2">
      {rows(doc).map((row) => (
        <div key={row.file} className="overflow-hidden rounded-xl border-1 border-gray-6 bg-gray-2">
          <div className="flex flex-col gap-2 px-12 pt-12">
            <span className="font-mono text-13 font-600 text-gray-12">{row.file}</span>
            <span className="text-12 text-gray-11">{row.use}</span>
          </div>
          <div className={`mt-12 flex flex-wrap items-end justify-center gap-20 p-16 ${BG[row.ground]}`}>
            {row.sizes.map((size) => (
              <figure key={size} className="m-0 flex flex-col items-center gap-6">
                <img src={dataUri(row.svg)} width={size} height={size} alt="" />
                <figcaption className="font-mono text-11 text-gray-11">{size}px</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
      <p className="font-mono text-12 text-gray-11 md:col-span-2">
        chip mark reaches {safeZonePct(doc, 'chip').toFixed(0)}% of the tile
        {safeZonePct(doc, 'chip') > SAFE_ZONE_PCT ? ' — outside the maskable safe circle' : ' — inside the maskable safe circle'}
      </p>
    </div>
  );
}
