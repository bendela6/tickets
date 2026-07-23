# @tickets/ui Phase 1 — Tokens Package Design

Phase 1 of the shared UI library roadmap (`docs/superpowers/plans/2026-07-23-shared-ui-library-roadmap.md`). Creates the `@tickets/ui` workspace package holding the design-token pipeline and shared styling infrastructure, consumed by `apps/web` immediately and `apps/eer` minimally (cn/runtime-style only). No visual changes to any screen.

Evidence base: six-agent UI audit, 2026-07-23 — report artifact <https://claude.ai/code/artifact/81d0ef82-564a-4b4c-8de7-a4748f5606b8>.

## Decisions (locked with user)

1. **Location:** `packages/web/ui`, package name `@tickets/ui` — beside `@tickets/form`, matching the convention that React-web-specific packages live under `packages/web/*`.
2. **Lint scope:** token lint scripts move into the package and scan **both** apps/web and apps/eer.
3. **eer baseline:** ratchet — a committed `eer-baseline.json` records eer's current violations; the gate fails on any web violation and on **new** eer violations only. Phase 6 drives the baseline to zero, then deletes it.
4. **New tokens:** the full audit-proposed set lands in P1 as inert definitions, one commit per group.
5. **Non-color tokens stay hand-authored** (option a): the generator continues to emit only color/shadow regions between markers; radii/text/tracking/z/border/ring tokens are hand-written in the `@theme inline` section of the generated-file's static part, exactly as existing radii/text sizes are today. Generator unification is explicitly out of scope.

## Package shape

```
packages/web/ui/                      @tickets/ui  (private, type: module)
├── package.json                      exports: ./tokens.css ./cn ./variants ./runtime-style ./swatches
├── tsconfig.json                     modeled on packages/web/form
├── vitest.config.ts
├── scripts/
│   ├── build-tokens.mjs              moved; paths updated (../src/tokens → ../src/tokens.css)
│   ├── scan-hardcoded-values.mjs     moved; scans apps/web + apps/eer; consumes eer-baseline.json
│   ├── check-design-tokens.mjs       moved
│   └── eer-baseline.json             NEW — ratchet state (violation list/hashes per file)
└── src/
    ├── tokens/                       moved from apps/web/src/styles/tokens/ (3 JSON files)
    ├── tokens.css                    generated (was apps/web/src/styles/instrument.css); committed
    ├── cn.ts + cn.test.ts            union font-size groups: ui, meta, label, 3xs, 2xs
    ├── variants.ts + variants.test.ts  moved as-is from apps/web/src/ui/
    ├── runtime-style.ts + runtime-style.test.ts  moved from apps/eer/src/ui/ (test is new)
    └── swatches.ts + swatches.test.ts  NEW — color-picker presets derived from token values
```

Scripts: `tokens:build`, `tokens:lint`, `tokens:check`, `tokens:verify` (build → `git diff --exit-code src/tokens.css` → lint → check), plus `typecheck`, `test`.

## App changes

**apps/web**
- `package.json`: add `"@tickets/ui": "workspace:*"`; delete the four `tokens:*` scripts; `scripts/` folder deleted.
- `src/main.tsx`: `import '@tickets/ui/tokens.css'` replaces `import './styles/instrument.css'`.
- Delete `src/styles/instrument.css`, `src/styles/tokens/`, `src/ui/cn.ts`, `src/ui/cn.test.ts`, `src/ui/variants.ts`, `src/ui/variants.test.ts`. All imports of `../ui/cn` / `./cn` / `../ui/variants` across the app repoint to `@tickets/ui/cn` and `@tickets/ui/variants` (mechanical find/replace; ~80 files import cn).
- The 28 component files in `src/ui/` stay put — they move in Phase 3.
- Font loading (`@fontsource/*` imports) stays in web.

**apps/eer**
- `package.json`: add `"@tickets/ui": "workspace:*"`.
- Delete `src/ui/cn.ts` and `src/ui/runtime-style.ts`; imports repoint to `@tickets/ui/cn` and `@tickets/ui/runtime-style`. Behavior-identical: the shared cn registers the union of both apps' font-size token groups.
- `src/ui/color-mix.ts` stays (eer-only). Nothing else in eer changes.

**CI/turbo:** whatever pipeline invoked web's `tokens:verify` now invokes it filtered to `@tickets/ui` (detailed plan confirms the current wiring — grep turbo.json / deploy scripts / hooks for `tokens:`).

## New tokens (inert until later phases consume them)

Hand-authored in the static `@theme inline` section of `tokens.css`, one commit per group:

| Group | Tokens | Values |
|---|---|---|
| Type scale | `text-nano / micro / body / title / heading / display` | 9 / 10 / 14 / 16 / 20 / 24px, each with a line-height chosen to match current usage at audit sites |
| Radii | `radius-xs / sm / xl` | 4 / 6 / 10px (existing ctrl 5 / card 8 / panel 12 unchanged) |
| Border | `border-hair` | 1.5px |
| Focus ring | `ring-focus` | 3px |
| Tracking | `tracking-wide / wider / widest` | .06 / .08 / .09em |
| Z-scale | `z-sticky / scrim / overlay` | 10 / 40 / 50 |

Off-scale sizes found in the audit (18, 22, half-px) are normalized onto this scale **at consumption time** in later phases, where any deliberate ±2px shift is reviewed per screen. P1 changes no rendering.

## Swatches

`swatches.ts` exports the color-picker preset list currently duplicated as hex arrays in `settings/types-tab.tsx:17` and `settings/workflow-tab.tsx:23`. Values are derived from the token JSON via `resolveTokenMaps()` at build time (or a small generated module), so a rebrand updates the presets. The two settings files import it; their local `SWATCHES` consts are deleted. This is the only P1 change inside web component code besides import repoints.

## Ratchet baseline mechanics

`scan-hardcoded-values.mjs` gains a `--baseline scripts/eer-baseline.json` mode: violations under `apps/eer` are compared against the baseline; exit non-zero if any web violation exists OR any eer violation not present in the baseline. Baseline entries key on file + violation content (not line numbers, which drift). A `--update-baseline` flag regenerates it deliberately. Baseline is committed and shrinks over time; the gate output prints the current eer count so progress is visible.

## Testing & verification

- Package: cn union test (a color class survives adjacent to each custom text-size class — the twMerge trap), variants tests (moved), swatches-match-token test, generator round-trip (build twice → identical output), baseline-mode tests for the scanner.
- Monorepo: `pnpm typecheck`, `pnpm --filter @tickets/web test`, `pnpm --filter @tickets/eer test` (if present), `pnpm build`, `pnpm --filter @tickets/ui tokens:verify`.
- Visual: web renders pixel-identical — `tokens.css` matches the old `instrument.css` byte-for-byte except the added inert token vars; spot-check /gallery and one screen per area in both themes.

## Out of scope

Generator support for non-color token types; consuming any new token; moving the 28 ui components (P3); any eer restyling (P6); widening lint to packages/.
