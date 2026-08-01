import { PRESET_ARC, PRESET_SIDES } from '../doc/defaults';
import { arcPath, polygonPoints } from '../doc/geometry';
import { pathData } from '../render/svg';
import type { ShapeKind } from '../doc/types';

export interface ShapeTool {
  kind: ShapeKind;
  label: string;
  /** The single key that adds this shape from anywhere on the canvas. */
  key: string;
}

/**
 * One tool per element the document may hold. The polygon tool draws a
 * hexagon, which is a starting point rather than a kind of its own — the shape
 * it makes is an ordinary point list from the moment it exists.
 */
export const SHAPE_TOOLS: readonly ShapeTool[] = [
  { kind: 'rect', label: 'Rectangle', key: 'R' },
  { kind: 'circle', label: 'Circle', key: 'C' },
  { kind: 'ellipse', label: 'Ellipse', key: 'E' },
  { kind: 'line', label: 'Line', key: 'L' },
  // Y rather than the taken P: a polyline is the shape whose initial letters
  // are all spoken for.
  { kind: 'polyline', label: 'Polyline', key: 'Y' },
  { kind: 'polygon', label: 'Polygon', key: 'P' },
  // The path tool draws an arc, the way the polygon tool draws a hexagon: a
  // `<path>` is a list of commands and has no natural first shape of its own.
  { kind: 'path', label: 'Arc', key: 'A' },
];

export function shapeToolForKey(key: string): ShapeTool | undefined {
  return SHAPE_TOOLS.find((tool) => tool.key.toLowerCase() === key.toLowerCase());
}

/**
 * The mark that stands for a shape, in the rail rows, the add buttons and the
 * properties header. Drawn as SVG in `currentColor` so one glyph serves every
 * place at every size, rather than a div-and-clip-path per site.
 */
const points = (list: readonly { x: number; y: number }[]) =>
  list.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

export function ShapeGlyph({ kind, size = 13 }: { kind: ShapeKind; size?: number }) {
  const stroke = size < 16 ? 1.5 : 1.6;
  const inset = stroke / 2;
  const span = size - stroke;

  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      className="flex-none"
    >
      {kind === 'rect' ? (
        <rect
          x={inset}
          y={inset}
          width={span}
          height={span}
          rx={size / 4}
          stroke="currentColor"
          strokeWidth={stroke}
        />
      ) : null}
      {kind === 'circle' ? (
        <circle cx={size / 2} cy={size / 2} r={span / 2} stroke="currentColor" strokeWidth={stroke} />
      ) : null}
      {/* Squashed on purpose: a circle is a separate element with its own mark,
          so the ellipse's has to be one no circle could be mistaken for. */}
      {kind === 'ellipse' ? (
        <ellipse
          cx={size / 2}
          cy={size / 2}
          rx={span / 2}
          ry={span / 3}
          stroke="currentColor"
          strokeWidth={stroke}
        />
      ) : null}
      {kind === 'line' ? (
        <line
          x1={inset}
          y1={size - inset}
          x2={size - inset}
          y2={inset}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      ) : null}
      {/* The chevron a new polyline is, so the mark and the shape agree. */}
      {kind === 'polyline' ? (
        <polyline
          points={points([
            { x: inset, y: inset },
            { x: size / 2, y: size - inset },
            { x: size - inset, y: inset },
          ])}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {/* The hexagon the tool's preset makes. A polygon's own points are
          arbitrary and would draw an illegible mark at 13 pixels. */}
      {kind === 'polygon' ? (
        <polygon
          points={points(polygonPoints(size / 2, size / 2, size / 2, PRESET_SIDES))}
          fill="currentColor"
        />
      ) : null}
      {/* The spinner the tool's preset makes, drawn through the same generator
          and the same `d` builder the artboard uses, so the mark cannot drift
          from the shape it stands for. */}
      {kind === 'path' ? (
        <path
          d={pathData(
            arcPath({
              cx: size / 2,
              cy: size / 2,
              r: span / 2,
              inner: span / 2,
              ...PRESET_ARC,
            }),
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}
