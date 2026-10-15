# @bh/hooks

[//]: # 'written by pnpm docs:index from each page’s frontmatter; edit the pages, not this file'

Every page in this package, as the docs site groups them. Each link is the page’s
markdown copy: its prose, its examples’ code, and its props tables from the types.

## Hooks

- [Overview](../docs/overview.md): React hooks that hold state and behaviour and draw nothing, shared by bh's packages and the apps.
- [Writing a hook](../docs/writing-a-hook.md): The shape every hook in @bh/hooks takes, options in and state, actions and prop getters out with no markup, and how its tests and its page are laid out.
- [useAction](../docs/use-action.md): An async action run from the page, a save or a send, with whether it is going, what went wrong, and what it gave back.
- [useDebouncedCallback](../docs/use-debounced-callback.md): A callback made once its calls stop for a delay, with the last call's arguments, which can be made now or dropped, and says whether one is waiting.
- [useDebouncedValue](../docs/use-debounced-value.md): A value that follows another once it has stopped changing for a delay, as a search follows its field once the typing stops.
- [useDisclosure](../docs/use-disclosure.md): Open and fold a region from a button, with the props for both and no markup of its own.
- [useDrag](../docs/use-drag.md): A handle dragged by the pointer, from where it went down, for a resize handle, a divider, a scrollbar's thumb or a card on a canvas.
- [useElementSize](../docs/use-element-size.md): An element's width and height, measured before it paints and again whenever it changes size, for a chart or a layout drawn to the room it has.
- [useHotkeys](../docs/use-hotkeys.md): Keys that work anywhere on the page, written as Kbd writes them, which leave alone a key the reader is typing or the focused control uses.
- [useIsClipped](../docs/use-is-clipped.md): Whether a text runs past its box, measured again when the box or the text changes, for a hint that shows only when there is more to read.
- [useMediaQuery](../docs/use-media-query.md): Whether a CSS media query matches, now and as it changes, for a layout that follows the window or the system's settings.
- [useNow](../docs/use-now.md): The time now, ticking every second or every interval it is given, on one timer for every clock on the page, for a countdown or a "saved 3 minutes ago".
- [usePersistedState](../docs/use-persisted-state.md): useState that remembers, in localStorage under the app's key, and keeps every place using the key in step, on the page and across the app's tabs.
- [useResizeHandle](../docs/use-resize-handle.md): A separator dragged, or moved with the arrow keys, to resize what it sits beside, in pixels or as a share of a box, with its props and no markup of its own.
- [useScrollSpy](../docs/use-scroll-spy.md): Which of a page's sections is in view, by their ids, for an "On this page" list that lights it.
