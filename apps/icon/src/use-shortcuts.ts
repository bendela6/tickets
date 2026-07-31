import { useEffect } from 'react';
import { shapeToolForKey } from './canvas/shape-tools';
import type { Action, EditorState } from './doc/store';

/**
 * Whether the key belongs to whatever the user is typing into. A shape
 * shortcut must not fire while someone is naming a state `rect`.
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
}: {
  state: EditorState;
  dispatch: (action: Action) => void;
  onSave: () => void;
  onExport: () => void;
  onResetZoom: () => void;
  onFitZoom: () => void;
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
      if (accel && event.key.toLowerCase() === 'd' && state.selectedId) {
        event.preventDefault();
        dispatch({ type: 'duplicateObject', id: state.selectedId });
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

      if ((event.key === 'Backspace' || event.key === 'Delete') && state.selectedId) {
        event.preventDefault();
        dispatch({ type: 'deleteObject', id: state.selectedId });
        return;
      }
      if (event.key === 'Escape') {
        dispatch({ type: 'selectObject', id: null });
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
  }, [dispatch, onExport, onFitZoom, onResetZoom, onSave, state.selectedId]);
}
