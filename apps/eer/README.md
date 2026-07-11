# @tickets/eer

Interactive **EER model viewer** — a React + TypeScript + Tailwind app (same stack as
`apps/web`). Ported from the standalone `docs/opus/eer-viewer` prototype.

```sh
pnpm --filter @tickets/eer dev     # http://localhost:4630  (also launched by `pnpm dev`)
pnpm --filter @tickets/eer build
pnpm --filter @tickets/eer typecheck
```

## Architecture

The diagram is performance-sensitive (edges redraw on every drag frame; focus/hover
must never reflow), so it stays **imperative** and is wrapped in React:

- `src/engine/` — the framework-agnostic diagram engine (TypeScript):
  - `model.ts` — validate + normalize the JSON model
  - `geometry.ts` — card sizing + port positions (mirrors the CSS box model)
  - `layout.ts` — deterministic group packing
  - `routing.ts` — A\* obstacle-avoiding orthogonal router (avoid / ortho line modes)
  - `render.ts` — builds the DOM/SVG scene; edges, ports, focus/dim classes
  - `checks.ts` — the runnable quality assertions (Self-check button)
  - `diagram.ts` — `EerDiagram` controller: interactions, fit/center, search, events
- `src/components/` — React + Tailwind chrome (top bar, detail panel, overlays) that
  drives the engine via a ref and re-renders from its `onSelect` callback.

## The model

Driven entirely by JSON — `src/model/eer-model.json` (the opus event-sourcing schema).
Point the viewer at another model with `?model=<url>` (fetched over http). The format
is documented in [`docs/opus/eer-schema.md`](../../docs/opus/eer-schema.md).

## Controls

`wheel` zoom · `middle-drag` pan · `left-drag` move an entity or a whole zone ·
`click` entity → focus its relationships · `click` a zone → show only its connections ·
`hover` a field → light its edges · `click` an edge → isolate it · `Esc` clear.
Top bar: search, zone/edge filters, **Lines** mode (curved → avoid → ortho), Fit,
Rearrange, and **Self-check** (also `window.__eer.runChecks()` in dev).
