import { useId } from 'react';
import { Button, Slider, cn } from '@tickets/ui';
import { BOOLEAN_OPS } from '../boolean/ops';
import { useCombine } from '../boolean/use-combine';
import { ShapeGlyph } from '../canvas/shape-tools';
import { ARTBOARD_MAX, ARTBOARD_MIN, ARTBOARD_PRESETS, SNAP_MIN, SNAP_PRESETS } from '../doc/constants';
import { newShadow } from '../doc/defaults';
import {
  aimLine,
  bounds,
  fitToBox,
  isOpenRun,
  lineAngle,
  rotatedBounds,
  type Box,
} from '../doc/geometry';
import { snapTo } from '../doc/snap';
import { selectedNodeOnly, selectedNodes, selectedObject, selectedObjects } from '../doc/store';
import { everyShape, isGroup } from '../doc/tree';
import { useEditor } from '../editor-context';
import type { IconGroup, IconNode, IconObject, Pair, Shadow } from '../doc/types';
import { ColourPairField } from './colour-pair-field';
import { NumberField } from './number-field';
import { RailGroup } from './rail-group';

/**
 * The right rail.
 *
 * It is never blank: with nothing selected the same frame carries the
 * artboard's own size and background, so the rail does not collapse and the
 * document's properties have somewhere to live.
 *
 * Four states, not two. One shape gets everything; one group gets what a group
 * has; several get the properties they genuinely share; none gets the
 * document's own.
 */
export function PropsPanel() {
  const { state } = useEditor();
  const node = selectedNodeOnly(state);
  const object = selectedObject(state);
  const nodes = selectedNodes(state);
  return (
    <div className="flex w-full flex-col">
      <Header node={node} count={nodes.length} />
      {object ? (
        <ObjectProperties object={object} />
      ) : node && isGroup(node) ? (
        <GroupProperties group={node} />
      ) : nodes.length > 1 ? (
        <SelectionProperties nodes={nodes} objects={selectedObjects(state)} />
      ) : (
        <DocumentProperties />
      )}
      {nodes.length > 0 ? <CombineGroup /> : null}
    </div>
  );
}

/**
 * The four boolean operations.
 *
 * Under whichever of the four states above is showing rather than inside the
 * multi-selection one, and offered whenever anything at all is selected. A
 * button that is present and says what it needs teaches that the operations
 * exist and what they take; one that appears only once the selection is already
 * right teaches nothing, because by then you knew. Every refusal is `ops.ts`'s
 * to state, so the rail and the reducer cannot disagree about what may be
 * combined.
 *
 * The reason is bound to the buttons with `aria-describedby` rather than left
 * as text near them: a disabled control that gives no reason is the same dead
 * end whether or not there is a sentence somewhere on screen.
 */
function CombineGroup() {
  const { refusal, failure, running, run } = useCombine();
  const reasonId = useId();
  const reason = refusal ?? failure;

  return (
    <RailGroup label="COMBINE">
      <div className="grid grid-cols-2 gap-1.25">
        {BOOLEAN_OPS.map(({ op, label }) => (
          <Button
            key={op}
            type="button"
            variant="subtle"
            tone="gray"
            size="sm"
            disabled={refusal !== null || running}
            aria-describedby={refusal === null ? undefined : reasonId}
            onClick={() => run(op)}
          >
            {label}
          </Button>
        ))}
      </div>
      {reason === null ? null : (
        <span id={reasonId} className="font-mono text-9/relaxed text-pretty text-gray-9">
          {reason}
        </span>
      )}
    </RailGroup>
  );
}

function Header({ node, count }: { node: IconNode | null; count: number }) {
  // A glyph names a kind, and a selection of several has no single kind to
  // name — so the slot goes empty rather than showing whichever one is first.
  const several = node === null && count > 1;
  const name = node?.name ?? (several ? `${count} objects` : 'document');
  const kind =
    node === null
      ? several
        ? 'SELECTION'
        : 'DOCUMENT'
      : isGroup(node)
        ? 'GROUP'
        : node.geometry.kind.toUpperCase();
  const object = node !== null && !isGroup(node) ? node : null;
  return (
    <div className="flex h-11 flex-none items-center gap-2.25 border-b-1 border-gray-6 px-3.5">
      {several || (node !== null && isGroup(node)) ? null : (
        <span className="flex-none text-gray-11">
          <ShapeGlyph kind={object ? object.geometry.kind : 'rect'} />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-mono text-12 font-500 text-gray-12">
        {name}
      </span>
      <span className="flex-none font-sans text-9 font-500 tracking-widest text-gray-9">
        {kind}
      </span>
    </div>
  );
}

const samePair = (a: Pair, b: Pair): boolean => a.light === b.light && a.dark === b.dark;

/**
 * The one look every pressed-or-not chip in this rail wears — artboard presets,
 * snap presets, the shadow switch — so a fourth cannot arrive a shade off.
 */
const chip = (current: boolean): string =>
  cn(
    'h-6.5 rounded-md border-1 font-mono text-10',
    current
      ? 'border-indigo-9 bg-indigo-3 text-indigo-9'
      : 'border-gray-6 bg-surface-raised text-gray-11',
  );

/**
 * Blur and shadow: the two things done to an object after it is drawn.
 *
 * One component for a shape and for a group, because the model gives both the
 * same two fields and for the same reason — a shadow is thrown by an outline,
 * and a group has exactly one outline however many shapes are inside it.
 *
 * **The shadow is a press, not five fields greyed out.** A node with none shows
 * a single button; pressing it writes a shadow anyone would keep and the fields
 * appear underneath. Disabled fields would ask the reader to work out whether a
 * shadow at zero offset and zero radius is the same as no shadow, and it is
 * not: the document either carries the field or it does not.
 *
 * Every row commits on blur or Enter and sends the whole shadow back with one
 * number changed, so each is exactly one undo entry.
 */
function EffectsFields({ node }: { node: IconNode }) {
  const { state, dispatch, view } = useEditor();
  const { doc } = state;
  const ids = [node.id];
  const shadow = node.shadow;
  const setShadow = (next: Shadow) => dispatch({ type: 'setShadow', ids, shadow: next });

  return (
    <div className="flex flex-col gap-1.5">
      <NumberField
        label="BLUR"
        name="Blur"
        value={node.blur ?? 0}
        min={0}
        step={doc.snap}
        onCommit={(blur) => dispatch({ type: 'setBlur', ids, blur })}
      />

      <button
        type="button"
        aria-pressed={shadow !== undefined}
        onClick={() =>
          dispatch({
            type: 'setShadow',
            ids,
            shadow: shadow === undefined ? newShadow(doc.artboard, doc.snap) : null,
          })
        }
        className={chip(shadow !== undefined)}
      >
        SHADOW
      </button>

      {shadow === undefined ? null : (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField
              label="X"
              name="Shadow x"
              value={shadow.dx}
              step={doc.snap}
              onCommit={(dx) => setShadow({ ...shadow, dx })}
            />
            <NumberField
              label="Y"
              name="Shadow y"
              value={shadow.dy}
              step={doc.snap}
              onCommit={(dy) => setShadow({ ...shadow, dy })}
            />
          </div>
          <NumberField
            label="RADIUS"
            name="Shadow radius"
            value={shadow.blur}
            min={0}
            step={doc.snap}
            onCommit={(blur) => setShadow({ ...shadow, blur })}
          />
          <NumberField
            label="OPACITY"
            name="Shadow opacity"
            value={shadow.opacity}
            min={0}
            max={100}
            suffix="%"
            onCommit={(opacity) => setShadow({ ...shadow, opacity })}
          />
          {/* No contrast grade. A shadow is not read against the ground — it is
              the ground, partly covered — so a ratio printed here would be a
              measurement of the wrong thing wearing an official-looking badge. */}
          <ColourPairField
            label="SHADOW"
            value={shadow.colour}
            ground={view.ground}
            against={doc.background}
            showContrast={false}
            onChange={(hex) =>
              setShadow({ ...shadow, colour: { ...shadow.colour, [view.ground]: hex } })
            }
          />
        </>
      )}
    </div>
  );
}

/** Whether every object answers a question the same way. */
function agree<T>(
  objects: readonly IconObject[],
  read: (object: IconObject) => T,
  same: (a: T, b: T) => boolean = Object.is,
): boolean {
  const first = objects[0];
  if (first === undefined) return true;
  const answer = read(first);
  return objects.every((object) => same(read(object), answer));
}

/**
 * The rail for a selection of several.
 *
 * Only the properties that mean the same thing for all of them: a colour, a
 * stroke, an opacity. X, Y, width, corner radius and the point count are left
 * out rather than averaged or blanked — they are per-shape by nature, and a
 * field offering to set three shapes' X to one number is offering to stack
 * them, which is not what anyone typing in an X field is asking for.
 *
 * The blur and the shadow are left out on the same grounds, and it is worth
 * saying which. "Shadow these three" has two readings — one shadow under the
 * lot, or three separate ones that overlap and seam where they cross — and the
 * one people mean is the first. ⌘G says it exactly: a group takes the shadow,
 * throws one, and undoes as one thing. A field here would quietly do the other.
 *
 * Where a shared control's objects disagree it says `mixed` instead of showing
 * one of them, and editing it writes to every one of them as a single entry.
 */
function SelectionProperties({ nodes, objects }: { nodes: IconNode[]; objects: IconObject[] }) {
  const { state, dispatch, view } = useEditor();
  const first = objects[0];
  // A selection of nothing but groups shares no paint at all — a group has
  // none. It still gets a count, which is the true thing left to say.
  if (first === undefined) return <SelectionCount count={nodes.length} />;

  const ids = objects.map((object) => object.id);
  // A run has no area, so a fill would paint nothing on it. One run in the
  // selection is enough to withdraw the field: a control that silently skipped
  // some of what it was pointed at would be worse than not offering it.
  const anyRun = objects.some((object) => isOpenRun(object.geometry));

  return (
    <>
      <RailGroup label="APPEARANCE">
        {anyRun ? null : (
          <ColourPairField
            label="FILL"
            value={first.fill}
            mixed={!agree(objects, (object) => object.fill, samePair)}
            ground={view.ground}
            against={state.doc.background}
            onChange={(hex) =>
              dispatch({ type: 'setColor', ids, channel: 'fill', ground: view.ground, hex })
            }
          />
        )}

        <ColourPairField
          label="STROKE"
          value={first.stroke}
          mixed={!agree(objects, (object) => object.stroke, samePair)}
          ground={view.ground}
          against={state.doc.background}
          onChange={(hex) =>
            dispatch({ type: 'setColor', ids, channel: 'stroke', ground: view.ground, hex })
          }
        />

        <NumberField
          label="STROKE WIDTH"
          name="Stroke width"
          value={first.strokeWidth}
          mixed={!agree(objects, (object) => object.strokeWidth)}
          // A run is drawn by its stroke alone, so it cannot go to zero while
          // one is in the selection.
          min={anyRun ? 1 : 0}
          onCommit={(width) => dispatch({ type: 'setStrokeWidth', ids, width })}
        />

        <div className="flex flex-col gap-1.5">
          <NumberField
            label="OPACITY"
            value={first.opacity}
            mixed={!agree(objects, (object) => object.opacity)}
            min={0}
            max={100}
            suffix="%"
            onCommit={(opacity) => dispatch({ type: 'setOpacity', ids, opacity })}
          />
          {/* The slider is withdrawn while they disagree rather than parked on
              one object's value: a slider has a position, and a position is a
              claim this control cannot make. The field above still edits. */}
          {agree(objects, (object) => object.opacity) ? (
            <Slider
              label={`${objects.length} objects opacity`}
              size="sm"
              value={first.opacity}
              valueText={`${first.opacity}%`}
              onChange={(opacity) => dispatch({ type: 'setOpacity', ids, opacity })}
            />
          ) : null}
        </div>

      </RailGroup>

      <SelectionCount count={nodes.length} />
    </>
  );
}

function SelectionCount({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-1.25 px-3.5 py-3.25">
      <span className="font-sans text-11/relaxed text-gray-11">{count} objects selected.</span>
      <span className="font-mono text-10 text-gray-9">
        position and size belong to one shape — ⌘G makes these one object
      </span>
    </div>
  );
}

/**
 * The rail for a group.
 *
 * Position, turn and scale — the three things its transform holds — and the
 * appearance it genuinely has of its own: an opacity, a blur and a shadow. No
 * fill and no stroke, because it has none: a group is where its children are,
 * and its children each state their own paint. The three it does get are the
 * three that are about the group as one thing rather than about the paint of
 * anything inside it.
 */
function GroupProperties({ group }: { group: IconGroup }) {
  const { dispatch } = useEditor();
  const inside = everyShape(group.children).length;
  const set = (transform: Partial<IconGroup['transform']>) =>
    dispatch({
      type: 'setGroupTransform',
      id: group.id,
      transform: { ...group.transform, ...transform },
    });

  return (
    <>
      <RailGroup label="PLACEMENT">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="X" value={group.transform.x} onCommit={(x) => set({ x })} />
          <NumberField label="Y" value={group.transform.y} onCommit={(y) => set({ y })} />
        </div>
        <NumberField
          label="ROTATION"
          value={group.transform.rotation}
          suffix="°"
          onCommit={(rotation) => dispatch({ type: 'rotateObject', id: group.id, degrees: rotation })}
        />
        {/* A percentage, and one field rather than two: the model holds a single
            scale, and a group that could be stretched on one axis would have to
            answer what that does to a circle inside it. */}
        <NumberField
          label="SCALE"
          name="Scale"
          value={Math.round(group.transform.scale * 100)}
          min={1}
          suffix="%"
          onCommit={(percent) => set({ scale: percent / 100 })}
        />
      </RailGroup>

      <RailGroup label="APPEARANCE">
        <div className="flex flex-col gap-1.5">
          <NumberField
            label="OPACITY"
            value={group.opacity}
            min={0}
            max={100}
            suffix="%"
            onCommit={(opacity) => dispatch({ type: 'setOpacity', ids: [group.id], opacity })}
          />
          <Slider
            label={`${group.name} opacity`}
            size="sm"
            value={group.opacity}
            valueText={`${group.opacity}%`}
            onChange={(opacity) => dispatch({ type: 'setOpacity', ids: [group.id], opacity })}
          />
        </div>

        <EffectsFields node={group} />
      </RailGroup>

      <div className="flex flex-col gap-1.25 px-3.5 py-3.25">
        <span className="font-sans text-11/relaxed text-gray-11">
          {inside} shape{inside === 1 ? '' : 's'} inside.
        </span>
        <span className="font-mono text-10 text-gray-9">
          double-click on the artboard to go in · ⇧⌘G takes it apart
        </span>
      </div>
    </>
  );
}

function ObjectProperties({ object }: { object: IconObject }) {
  const { state, dispatch, view } = useEditor();
  const isRun = isOpenRun(object.geometry);

  return (
    <>
      <PositionGroup object={object} />

      <RailGroup label="APPEARANCE">
        {/* A run has no area, so a fill would paint nothing. Everything else
            gets both, and both are editable — a shape that can be given a
            stroke width it cannot colour is not a finished control. */}
        {isRun ? null : (
          <ColourPairField
            label="FILL"
            value={object.fill}
            ground={view.ground}
            against={state.doc.background}
            onChange={(hex) =>
              dispatch({
                type: 'setColor',
                ids: [object.id],
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
              ids: [object.id],
              channel: 'stroke',
              ground: view.ground,
              hex,
            })
          }
        />

        <NumberField
          label={isRun ? 'THICKNESS' : 'STROKE WIDTH'}
          name={isRun ? 'Thickness' : 'Stroke width'}
          value={object.strokeWidth}
          min={isRun ? 1 : 0}
          onCommit={(width) => dispatch({ type: 'setStrokeWidth', ids: [object.id], width })}
        />

        <div className="flex flex-col gap-1.5">
          <NumberField
            label="OPACITY"
            value={object.opacity}
            min={0}
            max={100}
            suffix="%"
            onCommit={(opacity) => dispatch({ type: 'setOpacity', ids: [object.id], opacity })}
          />
          <Slider
            label={`${object.name} opacity`}
            size="sm"
            value={object.opacity}
            valueText={`${object.opacity}%`}
            onChange={(opacity) => dispatch({ type: 'setOpacity', ids: [object.id], opacity })}
          />
        </div>

        <EffectsFields node={object} />
      </RailGroup>

      <ShapeSpecific object={object} />
    </>
  );
}

/**
 * One line, rounded to whole units — this is a readout, not a field anyone
 * types into, so it does not owe sub-unit precision the way a dragged handle
 * would.
 */
function formatOnArtboard(box: Box): string {
  return `${Math.round(box.x)}, ${Math.round(box.y)} · ${Math.round(box.w)} × ${Math.round(box.h)}`;
}

/** A box stated on the document's grid. */
const gridBox = (box: Box, step: number): Box => ({
  x: snapTo(box.x, step),
  y: snapTo(box.y, step),
  w: snapTo(box.w, step),
  h: snapTo(box.h, step),
});

/**
 * A row that states something rather than accepting it: same frame as a
 * `NumberField` so it sits in the rail's rhythm, but no input, because nothing
 * here would know what to do with a typed answer.
 */
function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-7.5 items-center gap-1.5 rounded-md border-1 border-gray-6 bg-surface-raised px-2.25">
      <span className="flex-none font-mono text-9 text-gray-9">{label}</span>
      <span className="min-w-0 flex-1 text-right font-mono text-12 text-gray-12">{value}</span>
    </div>
  );
}

/**
 * Where the object is, stated in the terms the shape is actually defined by.
 *
 * A line is two points, so quoting it an X/Y/W/H box describes a by-product of
 * where its ends happen to be — and offers a height field that really means
 * thickness. A circle is a centre and a radius. A point list has no natural
 * numbers of its own beyond the points themselves, so it is given the box it
 * occupies, which scales it: a field per vertex would be a table, not a rail.
 * A path is its commands, and the same answer holds for the same reason.
 * Every shape still gets rotation, because rotation is a transform on top of
 * geometry rather than part of it.
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

  // The X/Y/W/H (or CX/CY/RADIUS) fields above stay in the shape's own,
  // unrotated terms — correct, and what gets exported — so a turned shape
  // needs a second, read-only readout of where that geometry actually lands
  // once the rotation is applied.
  const onArtboard =
    object.rotation !== 0 ? (
      <ReadOnlyRow label="ON ARTBOARD" value={formatOnArtboard(rotatedBounds(object))} />
    ) : null;

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
        <NumberField
          label="ROTATION"
          value={Math.round(lineAngle(geometry))}
          suffix="°"
          onCommit={(degrees) => setGeometry(aimLine(geometry, degrees), `rotate ${object.name}`)}
        />
      </RailGroup>
    );
  }

  if (geometry.kind === 'circle') {
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
        {onArtboard}
      </RailGroup>
    );
  }

  const box = bounds(object);

  if (geometry.kind === 'polyline' || geometry.kind === 'polygon' || geometry.kind === 'path') {
    // Every edit is the same one — a new box for the points to be scaled into
    // — so all four fields go through `fitToBox` and differ only in wording.
    const toBox = (next: Box, label: string) => setGeometry(fitToBox(object, next), label);
    // A path's box is measured through a flattened stand-in for its curves, so
    // it carries a fraction of a unit that is nobody's business: no drag could
    // land on it and typing it back would not reproduce it. The fields state it
    // on the document's own grid, which the shape is nearer to than one step.
    const stated = geometry.kind === 'path' ? gridBox(box, step) : box;
    // A path is defined by its commands, so what it counts is commands. There
    // is no field per node here for the same reason there is none per vertex:
    // the rail would become a table.
    const detail =
      geometry.kind === 'path'
        ? { label: 'SEGMENTS', value: String(geometry.segments.length) }
        : { label: 'POINTS', value: String(geometry.points.length) };
    return (
      <RailGroup label="POSITION &amp; SIZE">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField
            label="X"
            value={stated.x}
            step={step}
            onCommit={(x) => toBox({ ...stated, x }, `move ${object.name}`)}
          />
          <NumberField
            label="Y"
            value={stated.y}
            step={step}
            onCommit={(y) => toBox({ ...stated, y }, `move ${object.name}`)}
          />
          <NumberField
            label="W"
            name="Width"
            value={stated.w}
            step={step}
            min={1}
            onCommit={(w) => toBox({ ...stated, w }, `resize ${object.name}`)}
          />
          <NumberField
            label="H"
            name="Height"
            value={stated.h}
            step={step}
            min={1}
            onCommit={(h) => toBox({ ...stated, h }, `resize ${object.name}`)}
          />
        </div>
        <ReadOnlyRow label={detail.label} value={detail.value} />
        {rotation}
        {onArtboard}
      </RailGroup>
    );
  }

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
      {onArtboard}
    </RailGroup>
  );
}

/**
 * The one group that depends on which shape is selected — corner radius for a
 * rectangle, and nothing for anything else. A polygon used to offer a side
 * count; it is a list of points now, and a count cannot describe one.
 *
 * A separate component rather than a ternary inside `ObjectProperties`,
 * because narrowing `object.geometry.kind` in a JSX condition does not narrow
 * it inside the callbacks underneath: a `const` here does what a condition
 * there cannot.
 */
function ShapeSpecific({ object }: { object: IconObject }) {
  const { dispatch } = useEditor();
  const geometry = object.geometry;

  if (geometry.kind !== 'rect') return null;

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
                className={cn(chip(current), 'flex-1')}
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
              className={cn(chip(preset === doc.snap), 'flex-1')}
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
