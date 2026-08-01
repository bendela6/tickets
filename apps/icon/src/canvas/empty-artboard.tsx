import { useEditor } from '../editor-context';
import { ShapeGlyph, SHAPE_TOOLS } from './shape-tools';

/**
 * The invitation lives on the artboard, not in a modal or a tour: one dashed
 * well per shape, sized as a real hit target, plus the shortcut that replaces
 * them once you know it. The same affordances sit in the left rail, so this
 * set can disappear forever after the first shape.
 */
export function EmptyArtboard() {
  const { dispatch } = useEditor();
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
      <span className="font-mono text-11 tracking-wide text-gray-9">place your first shape</span>
      <div className="pointer-events-auto flex gap-2.5">
        {SHAPE_TOOLS.map((tool) => (
          <button
            key={tool.kind}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            onClick={() => dispatch({ type: 'addObject', kind: tool.kind })}
            className="flex size-14 items-center justify-center rounded-lg border-1 border-dashed border-gray-7 text-gray-9 hover:text-gray-11"
          >
            <ShapeGlyph kind={tool.kind} size={22} />
          </button>
        ))}
      </div>
      <span className="font-mono text-10 text-gray-9">
        click one, or press {SHAPE_TOOLS.map((tool) => tool.key).join(' · ')}
      </span>
    </div>
  );
}
