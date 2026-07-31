import { polygonPoints } from '../doc/geometry';
import type { ShapeKind } from '../doc/types';

export interface ShapeTool {
  kind: ShapeKind;
  label: string;
  /** The single key that adds this shape from anywhere on the canvas. */
  key: string;
}

export const SHAPE_TOOLS: readonly ShapeTool[] = [
  { kind: 'rect', label: 'Rectangle', key: 'R' },
  { kind: 'ellipse', label: 'Ellipse', key: 'E' },
  { kind: 'line', label: 'Line', key: 'L' },
  { kind: 'polygon', label: 'Polygon', key: 'P' },
];

export function shapeToolForKey(key: string): ShapeTool | undefined {
  return SHAPE_TOOLS.find((tool) => tool.key.toLowerCase() === key.toLowerCase());
}

/**
 * The mark that stands for a shape, in the rail rows, the add buttons and the
 * properties header. Drawn as SVG in `currentColor` so one glyph serves every
 * place at every size, rather than a div-and-clip-path per site.
 */
export function ShapeGlyph({
  kind,
  size = 13,
  sides = 6,
}: {
  kind: ShapeKind;
  size?: number;
  sides?: number;
}) {
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
      {kind === 'ellipse' ? (
        <circle cx={size / 2} cy={size / 2} r={span / 2} stroke="currentColor" strokeWidth={stroke} />
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
      {kind === 'polygon' ? (
        <polygon
          points={polygonPoints(size / 2, size / 2, size / 2, sides)
            .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
            .join(' ')}
          fill="currentColor"
        />
      ) : null}
    </svg>
  );
}
