// @bh/hooks: the React hooks bh's packages and the apps share. A hook holds
// state and behaviour and draws nothing; the component that calls it draws.
// Each one is exported here as it moves in from the package that had it.
export { useAction, type ActionOutcome, type UseActionResult } from './use-action';
export {
  useDebouncedCallback,
  type UseDebouncedCallbackOptions,
  type UseDebouncedCallbackResult,
} from './use-debounced-callback';
export { useDebouncedValue, type UseDebouncedValueOptions } from './use-debounced-value';
export {
  useDisclosure,
  type DisclosureRegionProps,
  type DisclosureTriggerProps,
  type UseDisclosureOptions,
  type UseDisclosureResult,
} from './use-disclosure';
export {
  useDrag,
  type DragHandleProps,
  type DragMove,
  type DragStart,
  type UseDragOptions,
  type UseDragResult,
} from './use-drag';
export {
  useElementSize,
  type MeasuredBox,
  type UseElementSizeOptions,
  type UseElementSizeResult,
} from './use-element-size';
export { useHotkeys, type HotkeyHandler, type UseHotkeysOptions } from './use-hotkeys';
export { useIsClipped, type UseIsClippedResult } from './use-is-clipped';
export { useMediaQuery, type UseMediaQueryOptions } from './use-media-query';
export { useNow, type UseNowOptions } from './use-now';
export {
  readStored,
  usePersistedState,
  writeStored,
  type SetPersisted,
  type StoredIn,
  type UsePersistedStateOptions,
} from './use-persisted-state';
export {
  useResizeHandle,
  type ResizeEdge,
  type ResizeOrientation,
  type ResizeSeparatorProps,
  type ResizeUnit,
  type UseResizeHandleOptions,
  type UseResizeHandleResult,
} from './use-resize-handle';
export { useScrollSpy, type UseScrollSpyOptions, type UseScrollSpyResult } from './use-scroll-spy';
