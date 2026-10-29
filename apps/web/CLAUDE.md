# @tickets/web

- Commands: `pnpm --filter @tickets/web test`, `… typecheck`, one file:
  `pnpm --filter @tickets/web test src/components/item-key.test.tsx`.
- Components and tokens are tilewise's `@tilewise/*` packages from npm. To change one, change it in
  tilewise and bump the version here. Components that only tickets uses, like `ItemKey` and
  `RailLabel`, live here.
- Class numbers are pixels: `--spacing` is 1px, so `p-16` is 16px, `rounded-6` 6px and `border-1.5`
  1.5px. Stock Tailwind habits still compile and come out wrong: `p-4` is 4px, and `rounded-md`
  emits nothing.
- Never use arbitrary values like `h-[26px]` or `grid-cols-[200px_1fr]`: use a round number, a named
  utility, or a class in `src/styles.css`, so sizes stay on the design's scale.
- Pair `truncate` with `shrink-0` on rows in a scrolling flex column, or the browser crushes them.
