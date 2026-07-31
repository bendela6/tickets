import { Slider } from '@tickets/ui';
import { ShapeGlyph } from '../canvas/shape-tools';
import {
  ARTBOARD_MAX,
  ARTBOARD_MIN,
  ARTBOARD_PRESETS,
  SNAP_MIN,
  SNAP_PRESETS,
} from '../doc/constants';
import { bounds } from '../doc/geometry';
import { selectedObject } from '../doc/store';
import { useEditor } from '../editor-context';
import type { IconObject } from '../doc/types';
import { ColourPairField } from './colour-pair-field';
import { MotionGroup } from './motion-group';
import { NumberField } from './number-field';
import { RailGroup } from './rail-group';

/**
 * The right rail.
 *
 * It is never blank: with nothing selected the same frame carries the
 * artboard's own size and background, so the rail does not collapse and the
 * document's properties have somewhere to live.
 */
export function PropsPanel() {
  const { state } = useEditor();
  const object = selectedObject(state);
  return (
    <div className="flex w-full flex-col">
      <Header object={object} />
      {object ? <ObjectProperties object={object} /> : <DocumentProperties />}
    </div>
  );
}

function Header({ object }: { object: IconObject | null }) {
  return (
    <div className="flex h-11 flex-none items-center gap-2.25 border-b-1 border-gray-6 px-3.5">
      <span className="flex-none text-gray-11">
        {object ? (
          <ShapeGlyph
            kind={object.geometry.kind}
            sides={object.geometry.kind === 'polygon' ? object.geometry.sides : undefined}
          />
        ) : (
          <ShapeGlyph kind="rect" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-12 font-500 text-gray-12">
        {object?.name ?? 'document'}
      </span>
      <span className="flex-none font-sans text-9 font-500 tracking-widest text-gray-9">
        {object ? object.geometry.kind.toUpperCase() : 'DOCUMENT'}
      </span>
    </div>
  );
}

function ObjectProperties({ object }: { object: IconObject }) {
  const { state, dispatch, view } = useEditor();
  const isLine = object.geometry.kind === 'line';

  return (
    <>
      <PositionGroup object={object} />

      <RailGroup label="APPEARANCE">
        {/* A line has no area, so a fill would paint nothing. Everything else
            gets both, and both are editable — a shape that can be given a
            stroke width it cannot colour is not a finished control. */}
        {isLine ? null : (
          <ColourPairField
            label="FILL"
            value={object.fill}
            ground={view.ground}
            against={state.doc.background}
            onChange={(hex) =>
              dispatch({
                type: 'setColor',
                id: object.id,
                channel: 'fill',
                ground: view.ground,
                hex,
              })
            }
          />
        )}

        <ColourPairField
          label="STROKE"
          value={object.stroke}
          ground={view.ground}
          against={state.doc.background}
          onChange={(hex) =>
            dispatch({
              type: 'setColor',
              id: object.id,
              channel: 'stroke',
              ground: view.ground,
              hex,
            })
          }
        />

        <NumberField
          label={isLine ? 'THICKNESS' : 'STROKE WIDTH'}
          name={isLine ? 'Thickness' : 'Stroke width'}
          value={object.strokeWidth}
          min={isLine ? 1 : 0}
          onCommit={(width) => dispatch({ type: 'setStrokeWidth', id: object.id, width })}
        />

        <div className="flex flex-col gap-1.5">
          <NumberField
            label="OPACITY"
            value={object.opacity}
            min={0}
            max={100}
            suffix="%"
            onCommit={(opacity) => dispatch({ type: 'setOpacity', id: object.id, opacity })}
          />
          <Slider
            label={`${object.name} opacity`}
            size="sm"
            value={object.opacity}
            valueText={`${object.opacity}%`}
            onChange={(opacity) => dispatch({ type: 'setOpacity', id: object.id, opacity })}
          />
        </div>
      </RailGroup>

      <ShapeSpecific object={object} />

      <MotionGroup object={object} />
    </>
  );
}

/**
 * Where the object is, stated in the terms the shape is actually defined by.
 *
 * A line is two points, so quoting it an X/Y/W/H box describes a by-product of
 * where its ends happen to be — and offers a height field that really means
 * thickness. A polygon is a centre and a radius. Only the two box shapes are
 * boxes. Every shape still gets rotation, because rotation is a transform on
 * top of geometry rather than part of it, and `spins` needs it.
 */
function PositionGroup({ object }: { object: IconObject }) {
  const { state, dispatch } = useEditor();
  const geometry = object.geometry;
  // The arrows move by one grid unit, so holding one walks the same positions
  // a drag would land on rather than a parallel set of its own.
  const step = state.doc.snap;

  const rotation = (
    <NumberField
      label="ROTATION"
      value={object.rotation}
      suffix="°"
      onCommit={(degrees) => dispatch({ type: 'rotateObject', id: object.id, degrees })}
    />
  );

  const setGeometry = (next: typeof geometry, label: string) =>
    dispatch({ type: 'setGeometry', id: object.id, geometry: next, label });

  if (geometry.kind === 'line') {
    return (
      <RailGroup label="POSITION">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField
            label="X1"
            value={geometry.x1}
          step={step}
            onCommit={(x1) => setGeometry({ ...geometry, x1 }, `reshape ${object.name}`)}
          />
          <NumberField
            label="Y1"
            value={geometry.y1}
          step={step}
            onCommit={(y1) => setGeometry({ ...geometry, y1 }, `reshape ${object.name}`)}
          />
          <NumberField
            label="X2"
            value={geometry.x2}
          step={step}
            onCommit={(x2) => setGeometry({ ...geometry, x2 }, `reshape ${object.name}`)}
          />
          <NumberField
            label="Y2"
            value={geometry.y2}
          step={step}
            onCommit={(y2) => setGeometry({ ...geometry, y2 }, `reshape ${object.name}`)}
          />
        </div>
        {rotation}
      </RailGroup>
    );
  }

  if (geometry.kind === 'polygon') {
    return (
      <RailGroup label="POSITION &amp; SIZE">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField
            label="CX"
            name="Centre X"
            value={geometry.cx}
          step={step}
            onCommit={(cx) => setGeometry({ ...geometry, cx }, `move ${object.name}`)}
          />
          <NumberField
            label="CY"
            name="Centre Y"
            value={geometry.cy}
          step={step}
            onCommit={(cy) => setGeometry({ ...geometry, cy }, `move ${object.name}`)}
          />
        </div>
        <NumberField
          label="RADIUS"
          value={geometry.r}
          step={step}
          min={1}
          onCommit={(r) => setGeometry({ ...geometry, r }, `resize ${object.name}`)}
        />
        {rotation}
      </RailGroup>
    );
  }

  const box = bounds(object);
  return (
    <RailGroup label="POSITION &amp; SIZE">
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField
          label="X"
          value={box.x}
          step={step}
          onCommit={(x) => setGeometry({ ...geometry, x }, `move ${object.name}`)}
        />
        <NumberField
          label="Y"
          value={box.y}
          step={step}
          onCommit={(y) => setGeometry({ ...geometry, y }, `move ${object.name}`)}
        />
        <NumberField
          label="W"
          name="Width"
          value={box.w}
          step={step}
          min={1}
          onCommit={(w) => dispatch({ type: 'resizeObject', id: object.id, box: { ...box, w } })}
        />
        <NumberField
          label="H"
          name="Height"
          value={box.h}
          step={step}
          min={1}
          onCommit={(h) => dispatch({ type: 'resizeObject', id: object.id, box: { ...box, h } })}
        />
      </div>
      {rotation}
    </RailGroup>
  );
}

/**
 * The one group that depends on which shape is selected — corner radius for a
 * rectangle, sides for a polygon, nothing for the other two.
 *
 * A separate component rather than two ternaries inside `ObjectProperties`,
 * because narrowing `object.geometry.kind` in a JSX condition does not narrow
 * it inside the callbacks underneath: a `const` here does what a condition
 * there cannot.
 */
function ShapeSpecific({ object }: { object: IconObject }) {
  const { dispatch } = useEditor();
  const geometry = object.geometry;

  if (geometry.kind === 'rect') {
    return (
      <RailGroup label="RECTANGLE">
        <NumberField
          label="CORNER RADIUS"
          value={geometry.radius}
          min={0}
          onCommit={(radius) =>
            dispatch({
              type: 'setGeometry',
              id: object.id,
              geometry: { ...geometry, radius },
              label: `radius ${object.name}`,
            })
          }
        />
      </RailGroup>
    );
  }

  if (geometry.kind === 'polygon') {
    return (
      <RailGroup label="POLYGON">
        <NumberField
          label="SIDES"
          value={geometry.sides}
          min={3}
          max={24}
          onCommit={(sides) =>
            dispatch({
              type: 'setGeometry',
              id: object.id,
              geometry: { ...geometry, sides },
              label: `sides ${object.name}`,
            })
          }
        />
      </RailGroup>
    );
  }

  return null;
}

function DocumentProperties() {
  const { state, dispatch, view } = useEditor();
  const { doc } = state;

  return (
    <>
      <RailGroup label="ARTBOARD">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField
            label="W"
            name="Artboard width"
            value={doc.artboard.width}
            min={ARTBOARD_MIN}
            max={ARTBOARD_MAX}
            onCommit={(width) => dispatch({ type: 'setArtboard', artboard: { width } })}
          />
          <NumberField
            label="H"
            name="Artboard height"
            value={doc.artboard.height}
            min={ARTBOARD_MIN}
            max={ARTBOARD_MAX}
            onCommit={(height) => dispatch({ type: 'setArtboard', artboard: { height } })}
          />
        </div>
        <div className="flex gap-1.25">
          {ARTBOARD_PRESETS.map((preset) => {
            const current =
              preset.width === doc.artboard.width && preset.height === doc.artboard.height;
            return (
              <button
                key={`${preset.width}x${preset.height}`}
                type="button"
                aria-pressed={current}
                aria-label={`${preset.width} by ${preset.height}`}
                onClick={() => dispatch({ type: 'setArtboard', artboard: preset })}
                className={
                  current
                    ? 'h-6.5 flex-1 rounded-md border-1 border-indigo-9 bg-indigo-3 font-mono text-10 text-indigo-9'
                    : 'h-6.5 flex-1 rounded-md border-1 border-gray-6 bg-surface-raised font-mono text-10 text-gray-11'
                }
              >
                {preset.width}
              </button>
            );
          })}
        </div>
      </RailGroup>

      <RailGroup label="PRECISION">
        <NumberField
          label="STEP"
          name="Snap step"
          value={doc.snap}
          min={SNAP_MIN}
          step={0.5}
          onCommit={(snap) => dispatch({ type: 'setSnap', snap })}
        />
        <div className="flex gap-1.25">
          {SNAP_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={preset === doc.snap}
              aria-label={`Step ${preset}`}
              onClick={() => dispatch({ type: 'setSnap', snap: preset })}
              className={
                preset === doc.snap
                  ? 'h-6.5 flex-1 rounded-md border-1 border-indigo-9 bg-indigo-3 font-mono text-10 text-indigo-9'
                  : 'h-6.5 flex-1 rounded-md border-1 border-gray-6 bg-surface-raised font-mono text-10 text-gray-11'
              }
            >
              {preset}
            </button>
          ))}
        </div>
        <span className="font-mono text-9/relaxed text-gray-9 text-pretty">
          every position and size lands on multiples of {doc.snap} — the grid draws the same step
        </span>
      </RailGroup>

      <RailGroup label="BACKGROUND">
        <ColourPairField
          label="ARTBOARD"
          value={doc.background}
          ground={view.ground}
          against={doc.background}
          showContrast={false}
          onChange={(hex) => dispatch({ type: 'setBackground', ground: view.ground, hex })}
        />
      </RailGroup>

      <div className="flex flex-col gap-1.25 px-3.5 py-3.25">
        <span className="font-sans text-11/relaxed text-gray-11">
          {doc.objects.length === 0
            ? 'The artboard is empty.'
            : `${doc.objects.length} object${doc.objects.length === 1 ? '' : 's'} on the artboard.`}
        </span>
        <span className="font-mono text-10 text-gray-9">select an object to edit it</span>
      </div>
    </>
  );
}
