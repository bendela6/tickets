import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import { ToastProvider } from '../components/toast';
import { TooltipProvider } from '../components/tooltip';
import { states } from './table.demo';

// The virtualizer measures its scroll element through ResizeObserver, and
// jsdom reports 0x0 for everything — without this the visible range is empty
// and axe would audit a table with no rows in it, which is exactly the audit
// that cannot fail. Same mock, same reason, as table-render.test.tsx.
let _originalResizeObserver: typeof ResizeObserver;
beforeAll(() => {
  _originalResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class MockResizeObserver {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      this.cb(
        [
          {
            target,
            contentRect: { width: 1000, height: 400 } as DOMRectReadOnly,
            borderBoxSize: [{ inlineSize: 1000, blockSize: 400 }] as ResizeObserverSize[],
            contentBoxSize: [{ inlineSize: 1000, blockSize: 400 }] as ResizeObserverSize[],
            devicePixelContentBoxSize: [] as ResizeObserverSize[],
          },
        ],
        this,
      );
    }
    unobserve() {}
    disconnect() {}
  };
});
afterAll(() => {
  globalThis.ResizeObserver = _originalResizeObserver;
});

/** The provider context the gallery root hands every demo, mirroring
 *  demos.smoke.test.tsx — a demo audited outside it is not the demo. */
function inGallery(node: ReactNode) {
  return render(
    <TooltipProvider>
      <ToastProvider>{node}</ToastProvider>
    </TooltipProvider>,
  );
}

/**
 * `color-contrast` and `color-contrast-enhanced` are disabled, not tolerated.
 * jsdom loads no stylesheet, so every element computes to transparent-on-
 * transparent and the rule can only ever return "incomplete" noise. Contrast
 * is verified against the real compiled CSS in the browser-driven A11y tab,
 * not here.
 *
 * `region` is disabled for the opposite reason: it asks whether page content
 * sits inside a landmark, which is a question about the PAGE that embeds the
 * table, not about the table. A component fixture has no banner or main.
 */
const RULES: axe.RunOptions = {
  resultTypes: ['violations'],
  rules: {
    'color-contrast': { enabled: false },
    'color-contrast-enhanced': { enabled: false },
    region: { enabled: false },
  },
};

function describeViolations(results: axe.AxeResults): string {
  return results.violations
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(' | ')}`)
    .join('\n');
}

/**
 * Real axe-core against the real DOM the adapter produces, one audit per
 * gallery state — the same idiom as the playground's a11y-integration test,
 * which deliberately runs the true axe runtime rather than a stubbed seam
 * because a canned result cannot tell a correct tree from a broken one.
 *
 * Driving it off `table.demo.tsx`'s exported states rather than a fixture
 * written here means a state added to the gallery is audited the day it lands.
 * That is the point: the gallery is where this component is actually looked
 * at, so the gallery is what has to be accessible.
 */
describe('table — axe', () => {
  it.each(states.map((s) => [s.name, s] as const))(
    'reports no violations in the %s state',
    async (_name, state) => {
      const { container } = inGallery(state.render());
      const results = await axe.run(container, RULES);
      expect(describeViolations(results)).toBe('');
    },
    20000,
  );
});
