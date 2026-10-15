// Pager, in a real router: a link to each page it is handed, named by the way
// it lies and the page's name, that goes there and tells the app; only one at
// either end of the order, nothing with neither; and the group's name the
// app's to change.

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useRouterState,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pager, type PagerProps } from './pager';

/** The path on screen, so a test can see where a link went. */
function Where() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return <p data-testid="where">{pathname}</p>;
}

/** Renders the pager at `/`, in a router where every path draws it. */
async function renderPager(props: PagerProps) {
  const root = createRootRoute({
    component: () => {
      return (
        <>
          <Where />
          <Pager {...props} />
        </>
      );
    },
  });
  const anywhere = createRoute({ getParentRoute: () => root, path: '$', component: () => null });
  const router = createRouter({
    routeTree: root.addChildren([anywhere]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByTestId('where');
}

// The router puts the window back at the top as each page loads; jsdom can't scroll.
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const LABELLING = { label: 'Labelling', path: '/boxes/labelling' };
const STACKING = { label: 'Stacking', path: '/boxes/stacking' };

describe('Pager', () => {
  it('links to the page before and the page after, each named by the way it lies', async () => {
    await renderPager({ previous: LABELLING, next: STACKING });
    const pager = screen.getByRole('navigation', { name: 'Previous and next' });
    expect(pager).toBeInTheDocument();
    const previous = screen.getByRole('link', { name: 'Previous, Labelling' });
    const next = screen.getByRole('link', { name: 'Next, Stacking' });
    expect(previous).toHaveAttribute('href', '/boxes/labelling');
    expect(previous).toHaveAttribute('rel', 'prev');
    expect(next).toHaveAttribute('href', '/boxes/stacking');
    expect(next).toHaveAttribute('rel', 'next');
  });

  it('shows the way and the name on each link', async () => {
    await renderPager({ previous: LABELLING, next: STACKING });
    expect(screen.getByRole('link', { name: 'Next, Stacking' })).toHaveTextContent('NextStacking');
  });

  it('goes to the page picked', async () => {
    await renderPager({ previous: LABELLING, next: STACKING });
    await userEvent.click(screen.getByRole('link', { name: 'Next, Stacking' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/boxes/stacking');
    await userEvent.click(screen.getByRole('link', { name: 'Previous, Labelling' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/boxes/labelling');
  });

  it('tells the app which page the reader followed, and goes there all the same', async () => {
    const onNavigate = vi.fn();
    await renderPager({ previous: LABELLING, next: STACKING, onNavigate });
    await userEvent.click(screen.getByRole('link', { name: 'Next, Stacking' }));
    expect(onNavigate).toHaveBeenCalledWith(STACKING);
    expect(screen.getByTestId('where')).toHaveTextContent('/boxes/stacking');
  });

  it('has only the next on the first page', async () => {
    await renderPager({ next: STACKING });
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual([
      'Next, Stacking',
    ]);
  });

  it('has only the previous on the last page', async () => {
    await renderPager({ previous: LABELLING });
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual([
      'Previous, Labelling',
    ]);
  });

  it('draws nothing with neither, so a page that stands alone needs no condition', async () => {
    await renderPager({});
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('takes the app’s name for the group', async () => {
    await renderPager({ next: STACKING, label: 'More on boxes' });
    expect(screen.getByRole('navigation', { name: 'More on boxes' })).toBeInTheDocument();
  });
});
