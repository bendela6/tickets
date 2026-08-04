import { useEffect } from 'react';
import { isPenKey, shapeToolForKey } from './canvas/shape-tools';
import {
  selectedNodeIndex,
  selectedNodeOnly,
  selectedObject,
  type Action,
  type EditorState,
} from './doc/store';

/**
 * Whether the key belongs to whatever the user is typing into. A shape
 * shortcut must not fire while someone is naming a document `rect`.
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useShortcuts({
  state,
  dispatch,
  onSave,
  onExport,
  onResetZoom,
  onFitZoom,
  onToggleSource,
}: {
  state: EditorState;
  dispatch: (action: Action) => void;
  onSave: () => void;
  onExport: () => void;
  onResetZoom: () => void;
  onFitZoom: () => void;
  onToggleSource: () => void;
}): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const accel = event.metaKey || event.ctrlKey;

      if (accel && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
        return;
      }
      if (accel && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
        return;
      }
      if (accel && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        onExport();
        return;
      }
      // ⌘G collects the selection, ⇧⌘G takes a group apart. Above the guard
      // below because the browser has nothing bound to either.
      if (accel && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'ungroupSelection' : 'groupSelection' });
        return;
      }
      // One node only, and that is now a complete answer rather than a deferral:
      // three loose copies of a selection of three is what ⌘D means, and anyone
      // who wanted one copy of the three together presses ⌘G first — which is
      // exactly the thing a group is for.
      const only = selectedNodeOnly(state);
      if (accel && event.key.toLowerCase() === 'd' && only) {
        event.preventDefault();
        dispatch({ type: 'duplicateObject', id: only.id });
        return;
      }
      if (accel && event.key.toLowerCase() === 'a') {
        // Ahead of the plain `a` that adds an arc, which the accelerator guard
        // below would otherwise leave to the browser's select-all.
        event.preventDefault();
        dispatch({ type: 'selectAll' });
        return;
      }
      // ⌘/ shows and hides the SVG source. Not ⌘U: that is the browser's own
      // view-source, and taking it would mean intercepting the one chord a user
      // already presses to see markup and answering with something else. Every
      // ⌘-letter that could stand for source or markup is either the browser's
      // or already this app's; ⌘/ is claimed by neither, on either platform.
      if (accel && event.key === '/') {
        event.preventDefault();
        onToggleSource();
        return;
      }
      // Matched on `code` rather than `key`, because shift turns the `0` key
      // into `)` and the two chords would otherwise need different tests.
      if (accel && (event.code === 'Digit0' || event.code === 'Numpad0')) {
        event.preventDefault();
        if (event.shiftKey) onFitZoom();
        else onResetZoom();
        return;
      }
      // Any other accelerator belongs to the browser — ⌘R must still reload
      // rather than adding a rectangle.
      if (accel) return;

      // The pen owns the plain keyboard for as long as it is active, the same
      // way it owns the pointer. Accelerators are deliberately left above this:
      // ⌘S saving the document is true whatever is being drawn, and a mode that
      // swallowed them would be a mode you could get trapped in.
      if (state.tool === 'pen') {
        // Enter, Escape and the pen's own key are one gesture with three
        // spellings: finish. What that leaves behind is `penEnd`'s decision —
        // a path if there is one, nothing if there is not — rather than three
        // slightly different rules the user has to learn apart.
        if (event.key === 'Enter' || event.key === 'Escape' || isPenKey(event.key)) {
          event.preventDefault();
          dispatch({ type: 'penEnd', close: false });
          return;
        }
        if (event.key === 'Backspace' || event.key === 'Delete') {
          event.preventDefault();
          dispatch({ type: 'penBack' });
        }
        // Everything else is swallowed rather than acted on. A shape key here
        // would drop a preset behind the path being drawn, and the shape would
        // be selected by the time the pen finished and stole the selection back.
        return;
      }
      if (isPenKey(event.key)) {
        event.preventDefault();
        dispatch({ type: 'setTool', tool: 'pen' });
        return;
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && state.selectedIds.size > 0) {
        event.preventDefault();
        const node = selectedNodeIndex(state);
        const shape = selectedObject(state);
        // A selected node takes the key. It takes it even when the shape is at
        // the floor for its kind and nothing can be removed: falling through to
        // deleting the whole object would answer a request to remove one point
        // by removing every point, which is not a smaller version of the same
        // thing. Deselect the node — Escape, or a click on the shape — and the
        // key goes back to meaning the object. A node is only ever selected
        // inside a lone shape, so this precedence never has to choose between
        // one node and several objects.
        if (node !== null && shape) {
          dispatch({ type: 'removeVertex', id: shape.id, index: node });
          return;
        }
        // Every selected object, in one entry: one press of one key is one
        // thing to take back.
        dispatch({ type: 'deleteObjects', ids: [...state.selectedIds] });
        return;
      }
      if (event.key === 'Escape') {
        // Escape means "never mind", and what there is to mind depends on how
        // far in you are. Inside a group it steps out one level, leaving that
        // group selected — one press per level, so the key is how you climb
        // back out of a nest rather than a single leap to the top that would
        // lose where you had got to. Outside every group there is nothing left
        // to leave, so it clears the selection — the whole selection, however
        // many are in it, because leaving two of three would be a third answer.
        if (state.entered.length > 0) dispatch({ type: 'exitGroup' });
        else dispatch({ type: 'selectObject', id: null });
        return;
      }

      const tool = shapeToolForKey(event.key);
      if (tool) {
        event.preventDefault();
        dispatch({ type: 'addObject', kind: tool.kind });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // On the whole state rather than on `selectedId` alone: deciding what
    // Backspace means now reads the node selection and the shape it belongs to,
    // and a handler bound to a stale document would delete the wrong thing.
    // Rebinding one window listener costs nothing beside that.
  }, [dispatch, onExport, onFitZoom, onResetZoom, onSave, onToggleSource, state]);
}
