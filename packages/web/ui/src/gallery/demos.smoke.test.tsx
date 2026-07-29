import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { packageDemos } from './demos';
import { DEFAULT_VIEW, TONE_SETS } from './states';
import { ToastProvider } from '../components/toast';
import { TooltipProvider } from '../components/tooltip';
import { isDemoError, type CollectedDemo } from './types';

/**
 * The context the gallery root hands every demo (playground/dev/main.tsx, and
 * gallery-route in apps/web). Reproduced rather than avoided: a demo that
 * needs a provider the root does NOT supply is genuinely broken, and this is
 * the line that decides which is which.
 */
function inGallery(node: ReactNode) {
  return render(
    <TooltipProvider>
      <ToastProvider>{node}</ToastProvider>
    </TooltipProvider>,
  );
}

/**
 * Every demo, every state, actually rendered.
 *
 * The gallery is the only place most of these components are exercised, and
 * until this existed a broken one was invisible until somebody opened its
 * page — the Elevation demo asked for a shadow token that had been renamed
 * out from under it and took its own page down for months, because nothing
 * ever called its render.
 *
 * This asserts nothing about what a demo looks like. It asserts that it
 * renders at all, which is the floor every other check stands on.
 */
// `!isDemoError(d)` in a plain arrow does not narrow — the guard names the
// error branch, so the negation needs its own predicate to reach the other.
type LiveDemo = Extract<CollectedDemo, { slug: string }>;
const live = packageDemos.filter((demo): demo is LiveDemo => !isDemoError(demo));

describe('every package demo', () => {
  it('collects without error', () => {
    expect(packageDemos.filter(isDemoError)).toEqual([]);
    expect(live.length).toBeGreaterThan(20);
  });

  it.each(live.map((demo) => [demo.slug, demo] as const))('%s renders every state', (_slug, demo) => {
    for (const state of demo.states) {
      expect(() => inGallery(state.render(DEFAULT_VIEW))).not.toThrow();
    }
  });

  // A section that reads the view must survive every position of the switch,
  // not just the default — narrowing the tone set is what empties a list.
  it.each(live.filter((d) => d.states.some((s) => s.defined)).map((d) => [d.slug, d] as const))(
    '%s renders its authored states through every tone set',
    (_slug, demo) => {
      for (const tones of Object.values(TONE_SETS)) {
        for (const state of demo.states) {
          expect(() => inGallery(state.render({ tones }))).not.toThrow();
        }
      }
    },
  );

  it.each(live.filter((d) => d.playground).map((d) => [d.slug, d] as const))(
    '%s renders its playground at the default controls',
    (_slug, demo) => {
      const playground = demo.playground!;
      const values = Object.fromEntries(
        Object.entries(playground.controls).map(([key, def]) => [key, def.initial]),
      );
      expect(() => inGallery(playground.render(values as never))).not.toThrow();
    },
  );
});
