import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { collectDemos, definePlayground, isDemoError } from '@tickets/ui';
import { setAxeForTests } from './axe';
import { ComponentPage } from './component-page';

// Regression test for the "audit always runs against a display:none subtree"
// bug: the a11y tab's target lived under `hidden` (the Preview pane), and
// axe-core's default excludeHidden skips hidden trees entirely, so every
// audit reported 0 violations / 0 passes no matter what was rendered. That
// false all-clear can't be caught by a seam-mocked test (setAxeForTests
// hands back canned results regardless of DOM visibility) — it requires
// running *real* axe-core against the *real* DOM the app produces. So this
// test deliberately does NOT stub the axe seam: it clears it, renders a
// demo with a deliberately inaccessible playground element, and asserts
// real axe surfaces real violations.
//
// react-resizable-panels needs real layout math jsdom can't provide;
// mock it with a pass-through like component-page.test.tsx does.
type Layout = Record<string, number>;
vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Separator: () => <div />,
}));

const demos = collectDemos({
  broken: {
    meta: { title: 'Broken', group: 'Regression' },
    states: [{ name: 'default', render: () => <b>state</b> }],
    playground: definePlayground({
      controls: {},
      // Deliberately inaccessible markup: an icon-only button with no
      // accessible name (rule: button-name) and an img with no alt text
      // (rule: image-alt). axe-core catches both from static DOM structure
      // alone, so no color/contrast computation is needed for this to work
      // reliably in jsdom.
      render: () => (
        <div>
          <button type="button" />
          <img src="data:," />
        </div>
      ),
    }),
  },
});
const demo = demos[0];
if (!demo || isDemoError(demo)) throw new Error('fixture demo failed to collect');

describe('A11y tab — real axe-core regression', () => {
  beforeEach(() => {
    // vitest's jsdom environment never loads the app's compiled Tailwind
    // CSS (styles.css isn't imported anywhere in the module graph under
    // test), so the production `hidden` className has *no* effect on
    // getComputedStyle here by default — without this rule, axe would see
    // every element as visible regardless of the `hidden` class, and this
    // test couldn't tell the pre-fix bug apart from the fix. Inject the one
    // Tailwind utility rule this test actually depends on so
    // `className="hidden"` produces real `display:none` the way it does in
    // the built app, letting axe's `excludeHidden` behave for real.
    const style = document.createElement('style');
    style.textContent = '.hidden { display: none; }';
    document.head.appendChild(style);

    // Clear any cached fake from other tests' use of the seam so this test
    // exercises the real, lazily-imported axe-core module.
    setAxeForTests(null);
  });

  afterEach(() => {
    setAxeForTests(null);
    localStorage.clear();
    document.querySelectorAll('style').forEach((el) => el.remove());
  });

  it('finds real violations in the (temporarily unhidden) preview DOM', async () => {
    render(<ComponentPage demo={demo} />);

    fireEvent.click(screen.getByRole('tab', { name: 'A11y' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run audit' }));

    await waitFor(
      () => {
        expect(screen.queryByText('no audit yet')).toBeNull();
        expect(screen.queryByText('auditing…')).toBeNull();
      },
      { timeout: 10000 },
    );

    // Real axe-core, run against a genuinely visible DOM, must catch at
    // least one of the two deliberate violations. Before the fix, the
    // preview stayed `display:none` during the audit and axe's default
    // excludeHidden meant this assertion would fail (0 violations, an
    // "All clear" banner instead).
    const buttonNameViolation = screen.queryByText('button-name');
    const imageAltViolation = screen.queryByText('image-alt');
    expect(buttonNameViolation || imageAltViolation).toBeTruthy();
  }, 15000);
});
