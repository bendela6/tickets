// Lets a `style` prop carry CSS custom properties.
//
// React's `CSSProperties` comes from csstype, which lists known properties and
// nothing else, so `style={{ '--panel-w': '300px' }}` is a type error even
// though it is valid and widely used. This teaches the type about the one shape
// it is missing rather than casting at every call site — which is what the old
// `runtimeStyle()` helper did, at the cost of a wrapper around every such style
// object and an import to go with it.
//
// Scoped to `--`-prefixed keys, so ordinary properties keep their exact types
// and a typo like `colr` is still an error.
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style -- `Record` is a type alias and a type alias cannot merge into React's existing `CSSProperties` interface; declaration merging is the whole point of this file.
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}

export {};
