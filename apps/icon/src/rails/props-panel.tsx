import { Slider } from '@tickets/ui';
import { ShapeGlyph } from '../canvas/shape-tools';
import { ARTBOARD_SIZES } from '../doc/constants';
import { bounds, fitToBox } from '../doc/geometry';
import { selectedObject } from '../doc/store';
import { useEditor } from '../editor-context';
import type { ArtboardSize, IconObject } from '../doc/types';
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
  const box = bounds(object);
  const isLine = object.geometry.kind === 'line';

  const resize = (next: Partial<typeof box>) =>
    dispatch({ type: 'resizeObject', id: object.id, box: { ...box, ...next } });

  return (
    <>
      <RailGroup label="POSITION &amp; SIZE">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField
            label="X"
            value={Math.round(box.x)}
            onCommit={(x) =>
              dispatch({
                type: 'setGeometry',
                id: object.id,
                geometry: fitToBox(object, { ...box, x }),
                label: `move ${object.name}`,
              })
            }
          />
          <NumberField
            label="Y"
            value={Math.round(box.y)}
            onCommit={(y) =>
              dispatch({
                type: 'setGeometry',
                id: object.id,
                geometry: fitToBox(object, { ...box, y }),
                label: `move ${object.name}`,
              })
            }
          />
          <NumberField
            label="W"
            name="Width"
            value={Math.round(box.w)}
            min={1}
            onCommit={(w) => resize({ w })}
          />
          <NumberField
            label="H"
            name="Height"
            value={Math.round(box.h)}
            min={1}
            onCommit={(h) => resize({ h })}
          />
        </div>
        <NumberField
          label="ROTATION"
          value={object.rotation}
          suffix="°"
          onCommit={(degrees) => dispatch({ type: 'rotateObject', id: object.id, degrees })}
        />
      </RailGroup>

      <RailGroup label="APPEARANCE">
        <ColourPairField
          label={isLine ? 'STROKE' : 'FILL'}
          value={isLine ? object.stroke : object.fill}
          ground={view.ground}
          against={state.doc.background}
          onChange={(hex) =>
            dispatch({
              type: 'setColor',
              id: object.id,
              channel: isLine ? 'stroke' : 'fill',
              ground: view.ground,
              hex,
            })
          }
        />

        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.75 rounded-md border-1 border-gray-6 bg-surface-raised px-2 py-1.5">
            <span
              aria-hidden
              className="size-4 flex-none rounded-sm border-1 border-gray-7"
              style={
                isLine || object.strokeWidth === 0
                  ? { background: 'transparent', borderStyle: 'dashed' }
                  : { background: object.stroke[view.ground] }
              }
            />
            <span className="flex-1 truncate font-mono text-11 text-gray-9">
              {isLine ? 'n/a on a line' : object.strokeWidth > 0 ? object.stroke[view.ground].toUpperCase() : 'no stroke'}
            </span>
          </div>
          <div className="w-17.5 flex-none">
            <NumberField
              label="W"
              name="Stroke width"
              value={object.strokeWidth}
              min={0}
              onCommit={(width) => dispatch({ type: 'setStrokeWidth', id: object.id, width })}
            />
          </div>
        </div>

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
          <NumberField label="W" name="Artboard width" value={doc.size} onCommit={() => {}} disabled />
          <NumberField label="H" name="Artboard height" value={doc.size} onCommit={() => {}} disabled />
        </div>
        <div className="flex gap-1.25">
          {ARTBOARD_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={size === doc.size}
              onClick={() => dispatch({ type: 'setArtboardSize', size: size as ArtboardSize })}
              className={
                size === doc.size
                  ? 'h-6.5 flex-1 rounded-md border-1 border-indigo-9 bg-indigo-3 font-mono text-11 text-indigo-9'
                  : 'h-6.5 flex-1 rounded-md border-1 border-gray-6 bg-surface-raised font-mono text-11 text-gray-11'
              }
            >
              {size}
            </button>
          ))}
        </div>
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
