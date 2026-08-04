import { Button } from '@tickets/ui';
import { ELEMENT_TYPES, type IconDoc } from '../doc';
import type { StudioAction } from '../state';
import { SliderRow } from './slider-row';

const selectClass =
  'h-28 min-w-0 flex-1 rounded-md border-1 border-gray-6 bg-gray-2 px-6 font-mono text-12 text-gray-12';

/** Per-type numeric controls. Switches on `element.type` rather than
 * deriving fields generically, because each type's ranges differ and — per
 * `ElementPatch`'s own doc comment in state.ts — a patch built by copying
 * keys across element types typechecks even though it can never apply. */
function ElementFields({
  element, dispatch,
}: {
  element: IconDoc['elements'][number];
  dispatch: (action: StudioAction) => void;
}) {
  const { id } = element;
  switch (element.type) {
    case 'stick':
      return (
        <>
          <SliderRow
            label={`${id} angle`} min={0} max={180}
            value={element.angle}
            format={(v) => `${v}°`}
            onChange={(angle) => dispatch({ type: 'updateElement', id, patch: { angle } })}
          />
          <SliderRow
            label={`${id} reach`} min={2} max={24} step={0.5}
            value={element.reach}
            onChange={(reach) => dispatch({ type: 'updateElement', id, patch: { reach } })}
          />
          <SliderRow
            label={`${id} weight`} min={0.5} max={12} step={0.25}
            value={element.weight}
            onChange={(weight) => dispatch({ type: 'updateElement', id, patch: { weight } })}
          />
        </>
      );
    case 'ring':
      return (
        <>
          <SliderRow
            label={`${id} radius`} min={2} max={24} step={0.5}
            value={element.radius}
            onChange={(radius) => dispatch({ type: 'updateElement', id, patch: { radius } })}
          />
          <SliderRow
            label={`${id} weight`} min={0.5} max={12} step={0.25}
            value={element.weight}
            onChange={(weight) => dispatch({ type: 'updateElement', id, patch: { weight } })}
          />
        </>
      );
    case 'dot': {
      const [x, y] = element.at;
      return (
        <>
          <SliderRow
            label={`${id} x`} min={0} max={48}
            value={x}
            onChange={(nx) => dispatch({ type: 'updateElement', id, patch: { at: [nx, y] } })}
          />
          <SliderRow
            label={`${id} y`} min={0} max={48}
            value={y}
            onChange={(ny) => dispatch({ type: 'updateElement', id, patch: { at: [x, ny] } })}
          />
          <SliderRow
            label={`${id} radius`} min={1} max={16} step={0.5}
            value={element.radius}
            onChange={(radius) => dispatch({ type: 'updateElement', id, patch: { radius } })}
          />
        </>
      );
    }
  }
}

export function ElementPanel({
  doc, dispatch,
}: {
  doc: IconDoc;
  dispatch: (action: StudioAction) => void;
}) {
  const inkNames = Object.keys(doc.inks);

  return (
    <section className="flex flex-col gap-12">
      <h2 className="font-mono text-11 uppercase tracking-wider text-gray-11">Elements</h2>

      <div className="flex flex-col gap-12">
        {doc.elements.map((element) => (
          <section
            key={element.id}
            role="group"
            aria-label={`${element.id} element`}
            className="flex flex-col gap-8 rounded-lg border-1 border-gray-6 bg-gray-2 p-8"
          >
            <div className="flex items-center gap-8">
              <span className="flex-1 font-mono text-12 text-gray-12">
                {element.id} <span className="text-gray-11">· {element.type}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => dispatch({ type: 'removeElement', id: element.id })}
              >
                remove {element.id}
              </Button>
            </div>

            <div className="flex items-center gap-8">
              <span className="w-96 shrink-0 font-mono text-12 text-gray-11">{element.id} ink</span>
              <select
                aria-label={`${element.id} ink`}
                className={selectClass}
                value={element.ink}
                onChange={(e) =>
                  dispatch({ type: 'updateElement', id: element.id, patch: { ink: e.target.value } })
                }
              >
                {inkNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-8 font-mono text-12 text-gray-11">
              <input
                aria-label={`${element.id} spin`}
                type="checkbox"
                checked={element.spin ?? false}
                onChange={(e) =>
                  dispatch({ type: 'updateElement', id: element.id, patch: { spin: e.target.checked } })
                }
              />
              spin
            </label>

            <ElementFields element={element} dispatch={dispatch} />
          </section>
        ))}
      </div>

      <div className="flex flex-wrap gap-6">
        {ELEMENT_TYPES.map((type) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            onClick={() => dispatch({ type: 'addElement', elementType: type })}
          >
            add {type}
          </Button>
        ))}
      </div>
    </section>
  );
}
