// Lazy axe-core singleton: nothing in this module runs until getAxe()
// is first called (from A11y tab mount), so axe-core's runtime ends up
// in a chunk the entry bundle never touches — verified post-build by
// checking apps/web/dist/assets for a separate axe chunk not referenced
// by the entry's static imports.
//
// setAxeForTests lets component tests swap in a fake that returns
// synchronously with canned results, keeping those tests fast and
// independent of the axe-core runtime machinery.
import type { AxeResults } from 'axe-core';

type RunAxe = (el: Element) => Promise<AxeResults>;
let axePromise: Promise<RunAxe> | null = null;

export function setAxeForTests(fn: RunAxe | null) {
  axePromise = fn ? Promise.resolve(fn) : null;
}

export function getAxe(): Promise<RunAxe> {
  axePromise ??= import('axe-core').then((axe) => (el: Element) =>
    (axe.default ?? axe).run(el, { resultTypes: ['violations', 'passes'] }),
  );
  return axePromise;
}
